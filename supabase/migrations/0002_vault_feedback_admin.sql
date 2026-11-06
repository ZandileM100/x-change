-- Vault notes/files, ratings, badge, feedback, audit, reminders, admin approval.
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name) values (new.id, coalesce(nullif(split_part(new.email,'@',1),''),'New user'))
  on conflict do nothing; return new;
end $$;
do $$ begin
  if exists (select 1 from pg_namespace where nspname='auth') and to_regclass('auth.users') is not null then
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
  end if; end $$;

create table vault_notes (            -- persisted shared notes (NOT live co-editing)
  match_id uuid primary key references matches(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  updated_by uuid references profiles(id), updated_at timestamptz not null default now()
);
create table vault_files (            -- metadata only; bytes live in Storage
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  uploader_id uuid not null references profiles(id),
  path text not null unique, name text not null,
  mime_type text not null check (mime_type in ('application/pdf','image/png','image/jpeg','text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),  -- 10 MB cap
  created_at timestamptz not null default now()
);
create table ratings (
  match_id uuid references matches(id), rater_id uuid references profiles(id), ratee_id uuid references profiles(id),
  stars int not null check (stars between 1 and 5), comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(), primary key (match_id, rater_id), check (rater_id <> ratee_id)
);
create table feedback (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id),
  kind text not null check (kind in ('bug','usability','category_suggestion','suggestion')),
  title text not null check (char_length(title) between 3 and 120), description text not null check (char_length(description) <= 2000),
  priority text not null default 'unset' check (priority in ('unset','low','medium','high')),
  status text not null default 'open' check (status in ('open','triaged','in_progress','resolved','duplicate')),
  related_page text, created_at timestamptz not null default now()
);
create table audit_events (
  id bigint generated always as identity primary key, actor_id uuid, action text not null,
  target_table text, target_id text, created_at timestamptz not null default now()
);
create index on audit_events (created_at desc);
create index on feedback (user_id); create index on vault_files (match_id);

create function rate_exchange(m uuid, stars int, comment text) returns void language plpgsql security definer set search_path=public as $$
declare r matches;
begin
  select * into r from matches where id=m;
  if not found or r.status<>'completed' or auth.uid() not in (r.user_a,r.user_b) then raise exception 'not allowed'; end if;
  insert into ratings(match_id,rater_id,ratee_id,stars,comment)
  values (m, auth.uid(), case when auth.uid()=r.user_a then r.user_b else r.user_a end, stars, comment);
end $$;

-- Starter Badge = at least one verified completed exchange (derived, never stored).
create view user_reputation with (security_invoker = false) as
select p.id as user_id, p.display_name, p.reputation_points,
  (select count(*) from matches m where m.status='completed' and p.id in (m.user_a,m.user_b)) as completed_exchanges,
  (select count(*) from matches m where m.status='completed' and p.id in (m.user_a,m.user_b)) >= 1 as has_starter_badge,
  (select round(avg(stars),2) from ratings r where r.ratee_id=p.id) as avg_rating
from profiles p;
grant select on user_reputation to authenticated;

-- In-app reminders at day 7 and 13 of a 14-day window (call daily; idempotent).
create function send_reminders() returns int language sql security definer set search_path=public as $$
  with due as (
    select m.id mid, u.uid, case when now() - m.created_at >= interval '13 days' then 'reminder_day13' else 'reminder_day7' end kind
    from matches m, lateral (values (m.user_a),(m.user_b)) u(uid)
    where m.status in ('suggested','accepted') and now() - m.created_at >= interval '7 days'),
  i as (insert into notifications(user_id,match_id,kind) select uid,mid,kind from due on conflict do nothing returning 1)
  select count(*)::int from i $$;

create function audit_admin_change() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into audit_events(actor_id,action,target_table,target_id) values (auth.uid(), tg_op, tg_table_name, new.id::text); return new; end $$;
create trigger audit_skills after update on skills for each row when (old.status is distinct from new.status) execute function audit_admin_change();
create trigger audit_feedback after update on feedback for each row execute function audit_admin_change();
create trigger audit_listings after update on listings for each row when (old.status is distinct from new.status and auth.uid() <> old.owner_id) execute function audit_admin_change();

alter table vault_notes enable row level security; alter table vault_files enable row level security;
alter table ratings enable row level security; alter table feedback enable row level security; alter table audit_events enable row level security;
create policy notes_read on vault_notes for select using (is_participant(match_id));
create policy notes_write on vault_notes for insert with check (is_participant(match_id) and updated_by=auth.uid()
  and exists (select 1 from matches where id=match_id and status in ('accepted','completed')));
create policy notes_upd on vault_notes for update using (is_participant(match_id)) with check (updated_by=auth.uid());
create policy files_read on vault_files for select using (is_participant(match_id));
create policy files_ins on vault_files for insert with check (uploader_id=auth.uid() and is_participant(match_id)
  and exists (select 1 from matches where id=match_id and status='accepted'));
create policy ratings_read on ratings for select using (auth.uid() in (rater_id,ratee_id) or is_admin());
create policy fb_read on feedback for select using (user_id=auth.uid() or is_admin());
create policy fb_ins on feedback for insert with check (user_id=auth.uid() and priority='unset' and status='open');
create policy fb_admin on feedback for update using (is_admin());
create policy audit_read on audit_events for select using (is_admin());
create policy admin_all_matches on matches for select using (is_admin());
create policy admin_profiles on profiles for update using (is_admin());

-- Private Storage bucket (Supabase only). Path convention: <match_id>/<filename>
do $$ begin
  if exists (select 1 from pg_namespace where nspname='storage') then
    insert into storage.buckets (id,name,public,file_size_limit) values ('vault','vault',false,10485760) on conflict do nothing;
    execute $p$create policy vault_obj_read on storage.objects for select using
      (bucket_id='vault' and is_participant(((storage.foldername(name))[1])::uuid))$p$;
    execute $p$create policy vault_obj_ins on storage.objects for insert with check
      (bucket_id='vault' and is_participant(((storage.foldername(name))[1])::uuid))$p$;
  end if; end $$;
