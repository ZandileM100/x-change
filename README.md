# Xchange-It: The Reciprocal Skill-Barter Ecosystem
Zandile Shantel Mphago (202314109), Sol Plaatje University, NPRJ740.

## Status
**Implemented:** SQL schema + RLS + matching/accept/confirm/rating/reminder/expiry functions; Next.js pages (profile, notifications, reputation, Privacy/Terms starter, landing, login/register/reset/OAuth, listings, matches, vault chat + notes + files, feedback, admin triage/category approval/audit); typed matcher with unit tests.
**Verified:** `npm test` (6 matcher tests), `npm run typecheck`, `next build`, and `./run_sql_tests.sh` (SQL scenarios on local PostgreSQL 16 with an auth shim; see docs/REPORT.md for exact results).
**Measured:** matching on ~9.7k synthetic listings in local Postgres: 84 ms repeat, 128 ms incremental, 9.6 s first bulk backfill (details in docs/REPORT.md 9b).
**NOT verified:** anything against a live Supabase project (Auth, Realtime, Storage, OAuth), no browser or e2e tests, no accessibility audit.
**Not built:** Tailwind (plain CSS used), field-visibility toggles, email/push, loop checklist and loop ratings, loop reminders, Playwright e2e tests, security audit, accessibility audit, live-Supabase testing.

## Database files, run in order
`0001_core` `0002_vault_feedback_admin` `0003_avatars` `0004_loops_score_tasks` `0005_security_hardening` (all in `supabase/migrations`).

## Deploy to Vercel
Push this folder to a GitHub repository (`.env.local` is git-ignored), import it at vercel.com, set the two `NEXT_PUBLIC_` variables, deploy, then add the Vercel URL under Supabase, Authentication, URL Configuration.

## Upgrade 0004 (loops, score, campus, hours, checklist, verified skills)
Run `supabase/migrations/0004_loops_score_tasks.sql` after 0001 to 0003. New: weekday availability and estimated hours on listings; match score (format 30 + weekdays 30 + city 20 + campus 20); three-way loops with their own accept/confirm/chat; vault checklist with progress; verified skills (earned only by completed exchanges) on public profiles at `/u/<id>`; admin user management and listing moderation.

## Google / GitHub sign-in (you must configure these; the app cannot do it for you)
The login page asks Supabase which providers are on and labels the others "(not set up)".
- GitHub: github.com, Settings, Developer settings, OAuth Apps, New. Callback URL: `https://<your-project-ref>.supabase.co/auth/v1/callback`. Copy the Client ID and a generated Client Secret into Supabase, Authentication, Sign In / Providers, GitHub, then enable and save.
- Google: console.cloud.google.com, APIs & Services, Credentials, Create OAuth client ID (Web). Same callback URL under Authorized redirect URIs. Paste Client ID and Secret into Supabase, Providers, Google, enable and save.
- Supabase, Authentication, URL Configuration: Site URL `http://localhost:3000`, Redirect URL `http://localhost:3000/**` (add your Vercel URL later).

## Setup (needs your credentials)
1. Create a Supabase project. In the SQL editor run `supabase/migrations/0001_core.sql` then `0002_vault_feedback_admin.sql`.
2. Run `supabase/migrations/0003_avatars.sql` too (profile pictures: public `avatars` bucket, users write only in their own folder, 2 MB, PNG/JPG/WebP).
3. Authentication → enable Email (and optionally Google/GitHub with your own OAuth keys). Add `http://localhost:3000` to redirect URLs.
3. Database → Replication: enable Realtime for the `messages` table.
4. `cp .env.example .env.local` and fill in URL and anon key. Never put the service-role key in client code.
5. Register in the app, then promote yourself: `update profiles set role='admin' where id='<your auth uuid>';`
6. `npm install && npm run dev`.
7. Scheduling: in Supabase enable `pg_cron`, then `select cron.schedule('xchange-daily','0 2 * * *',$$select expire_matches(); select send_reminders();$$);`
8. Deploy: push to GitHub, import into Vercel, set the two NEXT_PUBLIC variables.

## Test
`npm test` (matcher) · `./run_sql_tests.sh` (needs local postgres; runs migrations + scenarios).
