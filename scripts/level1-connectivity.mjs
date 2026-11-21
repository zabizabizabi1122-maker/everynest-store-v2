import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const raw = fs.readFileSync(path.resolve(".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)="(.*)"$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  return env;
}

const env = loadEnv();
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
}

async function expectAllowed(name, promise) {
  const { data, error } = await promise;
  if (error) record(name, false, `${error.code ?? ""} ${error.message}`);
  else record(name, true, `rows=${Array.isArray(data) ? data.length : "n/a"}`);
}

async function expectDenied(name, promise) {
  const { data, error } = await promise;
  if (error) record(name, true, `denied: ${error.code ?? ""} ${error.message}`.slice(0, 110));
  else record(name, false, `NOT denied (returned ${JSON.stringify(data).slice(0, 60)})`);
}

await expectAllowed("anon SELECT categories", supabase.from("categories").select("id").limit(5));
await expectAllowed("anon SELECT products", supabase.from("products").select("id").limit(5));
await expectAllowed(
  "anon SELECT product_variants",
  supabase.from("product_variants").select("id").limit(5),
);
await expectDenied("anon SELECT profiles", supabase.from("profiles").select("id").limit(5));
await expectDenied(
  "anon SELECT stock_movements",
  supabase.from("stock_movements").select("id").limit(5),
);
await expectDenied("anon SELECT audit_log", supabase.from("audit_log").select("id").limit(5));
await expectDenied(
  "anon INSERT categories",
  supabase.from("categories").insert({ name: "x", slug: "x-anon-test" }).select(),
);
await expectDenied(
  "anon RPC adjust_stock",
  supabase.rpc("adjust_stock", {
    p_variant_id: "00000000-0000-4000-8000-000000000000",
    p_change: 1,
    p_reason: "purchase",
  }),
);
await expectAllowed(
  "anon LIST product-images bucket",
  supabase.storage.from("product-images").list("", { limit: 5 }),
);

let pass = 0;
for (const result of results) {
  console.log(
    `${result.ok ? "PASS" : "FAIL"}  ${result.name.padEnd(32)} ${result.detail}`,
  );
  if (result.ok) pass += 1;
}

console.log(`\n${pass}/${results.length} checks passed`);
process.exitCode = pass === results.length ? 0 : 1;
