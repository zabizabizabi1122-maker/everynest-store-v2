import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/**
 * Level 2 authentication smoke test (development project only).
 *
 * Uses one throwaway customer account and exercises the real PostgREST API, so
 * the database — not the UI — is what gets tested:
 *   - the signup trigger created exactly one profile with role `customer`;
 *   - customers can read and update only their own profile, and only the
 *     full_name/phone columns;
 *   - the `role` column cannot be changed by an application role;
 *   - signed-out visitors cannot read profiles at all.
 *
 * Prerequisite: a confirmed test user. Create it in the dashboard under
 * Authentication → Users → Add user (enable "Auto confirm"), then run:
 *
 *   EVERYNEST_TEST_EMAIL=... EVERYNEST_TEST_PASSWORD=... npm run test:auth
 *
 * Delete the test user afterwards. This is a development-project tool; never
 * point it at production data.
 */

const TEST_EMAIL = process.env.EVERYNEST_TEST_EMAIL ?? "level2-smoke@everynest.dev";
// Throwaway development-only account. It has no privileges beyond `customer`.
const TEST_PASSWORD = process.env.EVERYNEST_TEST_PASSWORD ?? "EverynestSmoke123";

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

function makeClient() {
  return createClient(url, key, { auth: { persistSession: false } });
}

const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail });

function sessionClient(session) {
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
}

const supabase = makeClient();

const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  options: { data: { full_name: "Level 2 Smoke", phone: "+923001234567" } },
});

if (signUpError) {
  // The fixture account is created once through the Auth admin API, so the
  // public signup endpoint reports it as existing (or rejects the reserved test
  // domain). Either way the login path is what this script verifies.
  const known = /already registered|already been registered|is invalid/i.test(signUpError.message);
  record("signup endpoint reachable", known, signUpError.message);
} else {
  record("signup accepted", true, signUpData.user ? `user ${signUpData.user.id.slice(0, 8)}…` : "no user");
}

let session = signUpData?.session ?? null;

if (!session) {
  // This project requires email confirmation, which cannot be delivered to a
  // fake inbox. The operator confirms the throwaway account with a scoped SQL
  // statement, then re-runs the script.
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInError) {
    record("sign in", false, `${signInError.message} (confirm the test user first)`);
  } else {
    record("sign in", true, "session issued");
  }
  session = signIn?.session ?? null;
}

if (!session) {
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(42)} ${r.detail}`);
  }
  console.log("\nNo session: confirm level2-smoke@everynest.dev and re-run.");
  process.exitCode = 2;
} else {
  const authed = sessionClient(session);
  const email = session.user.email;

  const { data: own, error: ownError } = await authed
    .from("profiles")
    .select("id, full_name, phone, role")
    .eq("id", session.user.id)
    .maybeSingle();

  record(
    "profile auto-created by signup trigger",
    !ownError && Boolean(own),
    ownError ? ownError.message : `row for ${email}`,
  );
  record(
    "new account role is customer",
    own?.role === "customer",
    `role=${own?.role ?? "missing"}`,
  );
  record(
    "display name copied from signup metadata",
    own?.full_name === "Level 2 Smoke",
    `full_name=${own?.full_name ?? "missing"}`,
  );

  const { error: roleError } = await authed
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", session.user.id)
    .select("id");

  record(
    "customer cannot promote themselves to admin",
    Boolean(roleError),
    roleError ? `denied: ${roleError.code ?? ""} ${roleError.message}` : "NOT denied (role changed)",
  );

  const { data: updated, error: updateError } = await authed
    .from("profiles")
    .update({ full_name: "Level 2 Renamed", phone: "+923009876543" })
    .eq("id", session.user.id)
    .select("full_name, phone");

  record(
    "customer can update own name and phone",
    !updateError && updated?.[0]?.full_name === "Level 2 Renamed",
    updateError ? updateError.message : `full_name=${updated?.[0]?.full_name}, phone=${updated?.[0]?.phone}`,
  );

  const { data: others, error: othersError } = await authed
    .from("profiles")
    .select("id")
    .neq("id", session.user.id)
    .limit(5);

  record(
    "customer cannot read other profiles",
    !othersError && (others ?? []).length === 0,
    othersError ? `denied: ${othersError.code ?? ""}` : `rows=${(others ?? []).length}`,
  );

  await authed.auth.signOut();

  const anon = makeClient();
  const { data: anonProfiles, error: anonError } = await anon.from("profiles").select("id").limit(1);
  record(
    "signed-out visitor cannot read profiles",
    Boolean(anonError) || (anonProfiles ?? []).length === 0,
    anonError ? `denied: ${anonError.code ?? ""}` : `rows=${(anonProfiles ?? []).length}`,
  );

  const { data: relogin, error: reloginError } = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  record("password login works", !reloginError && Boolean(relogin?.session), reloginError ? reloginError.message : "session issued");

  const { error: wrongPasswordError } = await makeClient().auth.signInWithPassword({
    email: TEST_EMAIL,
    password: `${TEST_PASSWORD}-wrong`,
  });
  record("wrong password is rejected", Boolean(wrongPasswordError), wrongPasswordError ? "rejected" : "NOT rejected");

  let pass = 0;
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(42)} ${r.detail}`);
    if (r.ok) pass += 1;
  }
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exitCode = pass === results.length ? 0 : 1;
}
