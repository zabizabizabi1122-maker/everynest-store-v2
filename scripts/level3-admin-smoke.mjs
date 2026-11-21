import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/**
 * Level 3 admin access-control smoke test (development project only).
 *
 * Requires three confirmed accounts in the DEVELOPMENT project:
 *   - a customer
 *   - a staff member
 *   - an admin
 *
 * Their emails/passwords are supplied through environment variables; nothing is
 * hardcoded, so no credentials live in the repository:
 *
 *   EVERYNEST_CUSTOMER_EMAIL / EVERYNEST_CUSTOMER_PASSWORD
 *   EVERYNEST_STAFF_EMAIL    / EVERYNEST_STAFF_PASSWORD
 *   EVERYNEST_ADMIN_EMAIL    / EVERYNEST_ADMIN_PASSWORD
 *   EVERYNEST_BASE_URL       (default http://localhost:3000)
 *
 * What it proves against the real database (PostgREST, not the UI):
 *   - anonymous visitors are redirected away from /admin;
 *   - each role's row in `profiles` has the expected value;
 *   - staff/admin can read staff-only tables, customers cannot;
 *   - customers cannot write admin-only data (suppliers).
 *
 * The page-level checks per role are done in a browser, because session cookies
 * belong to `@supabase/ssr` and must not be forged by a test.
 */

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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const baseUrl = process.env.EVERYNEST_BASE_URL ?? "http://localhost:3000";

const accounts = [
  { role: "customer", email: process.env.EVERYNEST_CUSTOMER_EMAIL, password: process.env.EVERYNEST_CUSTOMER_PASSWORD },
  { role: "staff", email: process.env.EVERYNEST_STAFF_EMAIL, password: process.env.EVERYNEST_STAFF_PASSWORD },
  { role: "admin", email: process.env.EVERYNEST_ADMIN_EMAIL, password: process.env.EVERYNEST_ADMIN_PASSWORD },
];

const missing = accounts.filter((account) => !account.email || !account.password);
if (missing.length > 0) {
  console.error(
    `Missing credentials for: ${missing.map((account) => account.role).join(", ")}. See the script header.`,
  );
  process.exit(2);
}

const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail });

function makeClient(accessToken) {
  return createClient(url, key, {
    auth: { persistSession: false },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}

// -----------------------------------------------------------------------------
// 1. Anonymous request to /admin (through the running Next.js server).
// -----------------------------------------------------------------------------
try {
  const response = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";

  record(
    "anonymous /admin redirects to login",
    response.status === 307 && location.includes("/login?next=%2Fadmin"),
    `${response.status} ${location.slice(0, 80)}`,
  );
} catch (error) {
  record("anonymous /admin redirects to login", false, `server not reachable: ${error.message}`);
}

// -----------------------------------------------------------------------------
// 2. Per-role database checks.
// -----------------------------------------------------------------------------
for (const account of accounts) {
  const client = makeClient();

  const { data: sessionData, error: signInError } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (signInError || !sessionData.session) {
    record(`${account.role}: login`, false, signInError?.message ?? "no session");
    continue;
  }

  record(`${account.role}: login`, true, "session issued");

  const authed = makeClient(sessionData.session.access_token);

  const { data: ownProfile, error: profileError } = await authed
    .from("profiles")
    .select("role")
    .eq("id", sessionData.user.id)
    .maybeSingle();

  record(
    `${account.role}: profile role`,
    !profileError && ownProfile?.role === account.role,
    profileError ? profileError.message : `role=${ownProfile?.role ?? "missing"}`,
  );

  // `suppliers` is staff-readable only (RLS: suppliers_select_staff).
  const { data: suppliers, error: suppliersError } = await authed
    .from("suppliers")
    .select("id")
    .limit(5);

  const supplierRows = suppliers?.length ?? 0;
  if (account.role === "customer") {
    record(
      "customer cannot read staff-only suppliers",
      !suppliersError && supplierRows === 0,
      suppliersError ? `denied: ${suppliersError.code ?? ""}` : `rows=${supplierRows}`,
    );
  } else {
    record(
      `${account.role} can read suppliers`,
      !suppliersError && supplierRows > 0,
      suppliersError ? suppliersError.message : `rows=${supplierRows}`,
    );
  }

  // `audit_log` is admin-readable only (RLS: audit_log_select_admin).
  const { data: audit, error: auditError } = await authed
    .from("audit_log")
    .select("id")
    .limit(1);

  if (account.role === "admin") {
    record("admin can query audit_log", !auditError, auditError ? auditError.message : `rows=${audit?.length ?? 0}`);
  } else {
    record(
      `${account.role} cannot read admin audit_log`,
      Boolean(auditError) || (audit?.length ?? 0) === 0,
      auditError ? `denied: ${auditError.code ?? ""}` : `rows=${audit?.length ?? 0}`,
    );
  }

  // Supplying a supplier is admin-only. Customers and staff must be refused by
  // the database, not just hidden by the UI.
  if (account.role !== "admin") {
    const { error: insertError } = await authed
      .from("suppliers")
      .insert({ name: `Level 3 denied ${account.role}`, is_active: true })
      .select("id");

    record(
      `${account.role} cannot create a supplier`,
      Boolean(insertError),
      insertError ? `denied: ${insertError.code ?? ""}` : "NOT denied (row created)",
    );
  }

  await authed.auth.signOut();
}

// -----------------------------------------------------------------------------
// Report
// -----------------------------------------------------------------------------
let passed = 0;
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name.padEnd(44)} ${result.detail}`);
  if (result.ok) passed += 1;
}

console.log(`\n${passed}/${results.length} checks passed`);
process.exitCode = passed === results.length ? 0 : 1;
