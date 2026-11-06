\set ON_ERROR_STOP off
grant usage on schema public to anon, authenticated;
set role anon;
select 'S1 anon runs generate_matches (expect error)', generate_matches();
select 'S2 anon runs generate_loops (expect error)', generate_loops();
set role authenticated; set app.uid = '11111111-1111-1111-1111-111111111111';
select 'S3 user runs expire_matches (expect error)', expire_matches();
select 'S4 user runs send_reminders (expect error)', send_reminders();
select 'S5 user runs generate_matches (expect ok)', generate_matches() >= 0;
select 'S5b user runs respond_to_match path reachable (expect ok or business error, not permission)';
reset role;
select 'S6 owner/cron runs expire_matches (expect ok)', expire_matches() >= 0;
