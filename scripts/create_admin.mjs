// scripts/create_admin.mjs
// Creates/updates the admin profile role in the development Supabase project.
// This script runs locally using the Supabase CLI, which executes as the
// database owner, so it can modify the `profiles.role` column directly.
// It reads the admin email from environment variables defined in .env.local.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPath = path.resolve(".env.local");
  const raw = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
  return env;
}

const env = loadEnv();
if (!env.EVERYNEST_ADMIN_EMAIL) {
  console.error("Missing EVERYNEST_ADMIN_EMAIL in .env.local");
  process.exit(1);
}

const sql = `
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = '${env.EVERYNEST_ADMIN_EMAIL}'
);
`;

const sqlPath = path.resolve("scripts", "upgrade_admin.sql");
writeFileSync(sqlPath, sql);

console.log("Running supabase db query to promote admin role …");
try {
  execSync(`supabase db query --file ${sqlPath} --yes`, { stdio: "inherit" });
  console.log("✅ Admin role set successfully.");
} catch (e) {
  console.error("❌ Failed to set admin role", e);
  process.exit(1);
}
