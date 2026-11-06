-- 0005: lock down privileged functions. Only logged-in users may call user-facing RPCs;
-- maintenance jobs (expiry, reminders) run only as the database owner (pg_cron).
revoke execute on function generate_matches(), generate_loops(), respond_to_match(uuid,boolean), confirm_exchange(uuid),
  respond_to_loop(uuid,boolean), confirm_loop(uuid), rate_exchange(uuid,int,text), expire_matches(), send_reminders()
  from public, anon, authenticated;
grant execute on function generate_matches(), generate_loops(), respond_to_match(uuid,boolean), confirm_exchange(uuid),
  respond_to_loop(uuid,boolean), confirm_loop(uuid), rate_exchange(uuid,int,text) to authenticated;
