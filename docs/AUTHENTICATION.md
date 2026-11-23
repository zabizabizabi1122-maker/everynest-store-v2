# EveryNest admin authentication

EveryNest uses **Supabase Auth as the single source of truth** for admin identities,
passwords, sessions, email confirmation and password-reset links. The app does not
create a second user table, does not store tokens in `localStorage`, and does not
implement its own password or verification-token hashing. Supabase handles those
security-sensitive jobs.

The Next.js layer adds server guards, hardened cookies, throttling, and the admin UI.

## What was implemented

- Persistent sessions in Google-style HTTP-only, SameSite=Lax cookies (Secure in production).
- Access-token expiry handling plus Supabase refresh-token rotation and reuse detection.
- Configurable cookie lifetime via `AUTH_SESSION_MAX_AGE_SECONDS`.
- Automatic session check and server-side logout when a session expires or becomes invalid.
- Server-side `getUser()` verification on every admin page/action, plus RBAC from `profiles` and trusted RPCs.
- Login checks: validation, email confirmation, active status, admin role, and throttling after repeated failures.
- Generic errors so the login/resend forms cannot probe which emails exist.
- Email verification notice, success, failure, and resend pages with a 60-second cooldown.
- Password recovery with Supabase single-use, time-limited links; all sessions are ended after a successful reset.
- Admin accounts are created unverified by a Super Admin through **Admin Management**. There is intentionally no public admin signup page.

## Environment variables

Add these to `.env.local` locally and to Vercel for production:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Public key. Never use a secret key here. |
| `SUPABASE_SERVICE_ROLE_KEY` | For Admin Management | Server-only key used to create admins, roll back failed creation, and reset admin passwords. |
| `APP_URL` | Recommended in production | Canonical origin used in verification/reset links, e.g. `https://your-domain.com`. |
| `AUTH_SESSION_MAX_AGE_SECONDS` | Optional | Browser session cookie lifetime in seconds. Default `2592000` (30 days). Minimum 60, maximum 34560000. |

SMTP credentials are **not** Next.js environment variables. Configure them in the
Supabase Dashboard:

1. Open **Project Settings → Auth → Settings → SMTP**.
2. Enable custom SMTP and enter your provider values:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASSWORD`
   - `SMTP_FROM_EMAIL` (sender address)
3. Save the settings and send a test email from the dashboard.

Use a real email provider in production. Supabase's built-in sender is rate-limited
and meant for development.

## Supabase Auth settings

In the Supabase Dashboard for the correct project:

1. **Authentication → Providers → Email**
   - Keep Email enabled.
   - Keep **Confirm email ON**.
   - Keep **Secure password change ON** so a password change ends other sessions.
   - Set minimum password length to 12 if your project allows it.
   - Keep rate limits enabled.
2. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` locally, `https://your-domain.com` in production.
   - Redirect URLs must include both:
     - `http://localhost:3000/auth/callback`
     - `https://your-domain.com/auth/callback`
3. **Authentication → Email Templates**
   - Confirmation template: paste `supabase/templates/confirmation.html`.
   - Recovery template: paste `supabase/templates/recovery.html`.
   - Password changed notification: paste `supabase/templates/password_changed_notification.html`.
   - Recommended subjects are listed in `supabase/config.toml`.

`supabase/config.toml` already contains the equivalent local-stack settings, including
`enable_confirmations = true` and the template paths, for teams using `supabase start`.

## Database setup

Apply `supabase/migrations/20261123120000_auth_security.sql` before using the new login
throttle and verification resend cooldown:

```powershell
npx supabase db push --remote
npx supabase gen types typescript --remote --schema public > src/types/database.types.ts
```

The migration adds only two small private tables:

- `public.auth_login_throttle` — failed-attempt counter keyed by email and a hashed client IP.
- `public.email_verification_throttle` — 60-second resend cooldown per email.

No passwords, access tokens, refresh tokens, verification tokens, or reset tokens are
stored in these tables.

## Main flows

1. **Create admin** — Super Admin submits name, email, password, role and permissions.
   A separate publishable-key client creates the unverified user and requests the
   confirmation email. The current admin's cookies are untouched. `claim_admin_account`
   then applies the role/permissions, with Auth-user rollback if that step fails.
2. **Verify email** — the emailed link opens `/auth/callback?type=verification`. The
   single-use code is exchanged, the user is re-checked with `getUser()`, the profile is
   checked, and the browser lands on the success page. Bad, expired, or reused links
   go to the failure page.
3. **Sign in** — credentials are validated, throttle checked, confirmation and
   role/status verified, then a server-verified session is written to hardened cookies.
   Invalid non-admin sessions are signed out.
4. **Stay signed in / expire** — the proxy refreshes sessions on protected routes. An
   invisible monitor in the admin shell checks `/auth/session` on load, every 60 seconds,
   and when the tab becomes visible. If invalid, it logs out server-side and redirects to
   `/login?notice=session-expired`.
5. **Reset password** — a generic success message is always shown to prevent email
   enumeration. Supabase sends a single-use recovery link. After a successful password
   update, all sessions are signed out and the admin is sent back to login.

## Operational notes

- Never paste service-role keys, SMTP passwords, or admin passwords into chat, source files,
  or `NEXT_PUBLIC_*` variables.
- If email confirmation is accidentally disabled, login and `requireStaff()` still reject
  unverified accounts. Use the verification resend page after re-enabling confirmation.
- Admin deactivation is checked on every request, but existing Supabase sessions are not
  revoked by the status toggle alone. Keep Confirm email and Secure password change ON in
  Supabase for the strongest posture.
