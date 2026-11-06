# Test results (actually executed)
Executed in the development sandbox on 2026-11-01. PostgreSQL 16 (local), Node 20, Vitest 2.1.8, Next.js 14.2.
| Suite | Command | Result |
|---|---|---|
| Unit: matcher + loops | `npm test` | **11/11 passed** |
| SQL workflow, security, loops, score, checklist | `./run_sql_tests.sh` | **50 scenario checks + 6 security checks behaved as expected** |
| Typecheck | `npm run typecheck` | 0 errors |
| Production build | `npm run build` | Compiled successfully, 17 routes including not-found |
| Matching benchmark (9,733 synthetic listings, 1 vCPU) | `supabase/tests/20_benchmark.sql` | repeat run 84 ms; +100 listings 128 ms; first bulk run (30,302 matches) 9.6 s |
## Security checks (S1-S6)
Anonymous caller blocked from `generate_matches` and `generate_loops`; logged-in user blocked from `expire_matches` and `send_reminders`; logged-in user allowed `generate_matches`; owner/cron allowed `expire_matches`.
## NOT executed (do not report as passed)
Live Supabase (Auth, Realtime, Storage, OAuth), browser end-to-end, accessibility audit, cross-browser, load testing beyond the benchmark, penetration test.
## Manual test log (fill in from your own run)
| # | Scenario | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| 1 | Register and log in | Land on Dashboard | | |
| 2 | Create listing | Appears under Listings | | |
| 3 | Run matching with reciprocal second user | Match card with score | | |
| 4 | One user accepts | Status stays suggested | | |
| 5 | Both accept | Vault opens | | |
| 6 | Non-participant opens vault URL | Access denied | | |
| 7 | One confirms | Not completed, no points | | |
| 8 | Both confirm | Completed, +10 each, Starter Badge, celebration | | |
| 9 | Normal user opens /admin | Access denied | | |
| 10 | Invalid listing (same offered and wanted) | Validation message | | |
