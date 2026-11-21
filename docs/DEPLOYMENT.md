# EveryNest — deployment, rollback, backup and maintenance

This document is the runbook for taking EveryNest live. **No hosting or production
deployment has been performed.** Every step below is a manual action for the
owner; the application is currently linked only to the development Supabase
project `zabi-store-dev` (`bnmvzfeatuewmwuqfdnc`).

Read `AGENTS.md` §14 alongside this file. The non-negotiable rules are:

1. Development and production Supabase projects are separate. Never test against production.
2. Never run `db reset` against production.
3. Preview migrations with `--dry-run`, verify the linked project reference, and
   apply production migrations **only after explicit owner approval**.
4. Never place a secret, service-role key or DB password in `NEXT_PUBLIC_*`,
   source control, or chat.

---

## 1. Prerequisites

- Node.js 22+ (verified on 24.17.0), npm 11+.
- A Vercel account and a Git repository containing this project (it is not a Git
  repo in the current workspace — initialise and push it first).
- A **new, empty** Supabase project for production. Never reuse the dev project.
- Custom SMTP configured in the production Supabase project (the built-in email
  sender is rate limited and unsuitable for real signups).
- A custom domain and DNS access (optional but recommended).

## 2. Production Supabase setup (one-time, owner action)

1. Create the production project and note its project reference.
2. In the Supabase Dashboard → **Authentication → URL Configuration**:
   - Site URL: `https://<your-domain>`
   - Redirect URLs: `https://<your-domain>/auth/callback`
   - Keep **Confirm email** ON and configure SMTP.
3. In the Supabase Dashboard → **Storage**, confirm the `product-images` bucket
   exists with the migration-defined policies (public read, staff-only write).
   The bucket is created by `supabase/migrations/..._level1_storage.sql`.
4. enable **Point-in-Time Recovery** (PITR) on the production project before any
   customer data exists. See §6.
5. Link the CLI **locally** (the token stays on your machine):

   ```bash
   npx supabase login
   npx supabase link --project-ref <production-project-ref>
   ```

   Verify the printed target says the production reference **before** continuing.

6. Apply migrations with the reviewed plan:

   ```bash
   npm run db:push:dry          # must list every production-pending migration
   npm run db:push              # only after the owner approves the dry-run output
   npm run db:migrations        # confirm local and remote versions match
   ```

   This only applies missing migrations; it never resets or deletes data.
   **Do not run the development seed (`supabase/seed.sql`) in production.**
7. Generate types from the production schema and commit them if they changed:

   ```bash
   npm run db:types
   ```

8. Create the first admin manually from the Dashboard SQL editor (database-owner
   context), never from a form or signup metadata:

   ```sql
   update public.profiles
      set role = 'admin'
    where id = (select id from auth.users where email = '<owner-email>');
   ```

   The role-change guard trigger permits this trusted context; the change is
   audited where technically possible (a manual database-owner change may have a
   null application `actor_id` — this is a documented limitation).

## 3. Vercel deployment

1. Push the repository to your Git host. Confirm `.env.local` is **not** tracked
   (`.gitignore` excludes `.env*` except `.env.example`).
2. Import the repository in Vercel. Framework preset: **Next.js**.
3. Build command: `npm run build`. Output: framework default (`.next`).
4. Add these **environment Variables** for Production (and Preview, pointing at
   a separate preview Supabase project):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Production project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production `sb_publishable_...` key |

   These are public values by design. Do **not** add a secret/service-role key.
5. Deploy. Verify the build log shows the expected routes (31 routes including
   `/admin/customers`, `/admin/coupons`, `/admin/reviews`, `/wishlist`,
   `/account/addresses`) and no TypeScript/lint errors.
6. Point the custom domain at the deployment and confirm HTTPS.

### Post-deployment smoke checklist

- `https://<domain>/` returns 200 and shows the storefront.
- `/products` lists the catalogue; a product page shows price, reviews section
  and wishlist prompt.
- `/admin` redirects an anonymous visitor to `/login`.
- `/account`, `/checkout`, `/admin/*` redirect anonymous visitors (307).
- Sign up one throwaway customer, place a COD order, and confirm it appears at
  `/admin/orders`. Cancel it afterwards to restore stock.
- Confirm no `NEXT_PUBLIC_*` value contains the word `secret` or `service_role`.

## 4. CI

`.github/workflows/ci.yml` runs on push and pull request:

- **Always**: `npm ci`, lint, typecheck, unit tests, production build,
  `npm audit --omit=dev`.
- **Opt-in DB job**: set repository variable `ENABLE_DB_TESTS=true` to start a
  local Supabase stack in CI (Docker is available on `ubuntu-latest`) and run
  migrations, the seed verifier and pgTAP.
- **Opt-in v2v job**: set `ENABLE_v2v=true` and configure the `v2v_*` secrets
  documented in `playwright.config.ts` and `e2e/storefront-flow.spec.ts`.
  It must target a **disposable** test project, never production.

Do not enable a job until it has actually passed against its target environment;
a green badge is only meaningful if the job ran.

## 5. Rollback

### Application rollback (safe, reversible)

1. In Vercel → Deployments, select the last known-good deployment and choose
   **Promote to Production**. This is instantaneous and does not touch the database.
2. Redeploy from a corrected commit after diagnosing the failure.

### Database rollback (forward-fix only)

Supabase migrations are append-only in this project. There are no down
migrations, and **resetting or restoring a production database is destructive**.

1. Diagnose with read-only queries and logs. Do not guess.
2. Write a **new numbered migration** that reverses the change safely (for
   example, `ALTER TABLE ... DROP CONSTRAINT ...` followed by the previous
   definition). Preserve historical data.
3. Dry-run, verify the linked production reference, apply, and mark applied:

   ```bash
   npx supabase db push --remote --dry-run
   npx supabase db query --remote --file supabase/migrations/<new-version>_fix.sql --yes
   npx supabase migration repair --status applied <new-version> --remote --yes
   ```

4. Regenerate types with `npm run db:types`.

If data was actually corrupted, use the point-in-time recovery procedure in §6
**only with explicit owner approval**, because it replaces the whole database.

## 6. Backups

- **PITR**: enable Point-in-Time Recovery on the production Supabase project.
  It allows restoring to a chosen moment; confirm the retention window offered
  by your plan and record it here: `<fill in after enabling>`.
- **Logical exports** (weekly, or before any risky migration). Store them outside
  Supabase, encrypted, with restricted access:

  ```bash
  # From the linked project; choose a timestamped filename.
  pg_dump "$(npx supabase db url --remote)" \
    --format=custom --file=backup-$(date +%Y%m%d).dump
  ```

  Do not paste the connection string into chat or commit it.
- **Storage bucket**: `product-images` is not covered by `pg_dump`. Keep an
  independent copy of uploaded images and document the restore path here:
  `<fill in after configuring>`.
- **Auth users** live in `auth`, which `pg_dump` includes when run with the
  database role that can read it. Verify your export contains `auth.users`
  before relying on it.
- Test a restore into a **separate** project at least once. An untested backup is
  not a backup.

## 7. Routine maintenance

| Cadence | Task |
|---|---|
| Weekly | Review Supabase logs for auth errors and RPC failures; check disk usage. |
| Weekly | Run `npm audit --omit=dev`; update dependencies deliberately. |
| Before each release | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run db:checks`. |
| After each migration | `npm run db:migrations` and `npm run db:types`; commit types. |
| Monthly | Verify PITR is still enabled and a restore has been tested. |
| Monthly | Review admin accounts (`profiles.role`) and remove ex-staff access. |
| Quarterly | Rotate the Supabase publishable key only as part of a planned key migration; review Vercel environment variables. |

### Security invariants to re-check after any change

- RLS is enabled on every application table.
- `anon` has no write privileges and no EXECUTE on any `SECURITY DEFINER` RPC.
- Customers cannot read other profiles, orders, suppliers, stock movements or audit logs.
- `product_variants.stock` cannot be updated by application roles directly;
  stock changes only through trusted RPCs.
- Admin role is read from `public.profiles` on every request — never from a
  cookie, JWT claim or form field.
- No secret appears in source, docs or a `NEXT_PUBLIC_*` variable.

## 8. Approval gates

| Action | Who approves |
|---|---|
| Start Level work | Owner explicitly approves each level. |
| Apply migrations to production | Owner, after reviewing the dry-run output. |
| Promote a Vercel deployment to production | Owner. |
| Restore from backup / PITR | Owner, explicitly, with a written incident note. |
| Add a new dependency or change the stack | Owner (per `AGENTS.md` §3). |

**Status at the end of Level 12: nothing in §2–§3 has been executed.** Only the
local build, tests, and the development project have been touched.
