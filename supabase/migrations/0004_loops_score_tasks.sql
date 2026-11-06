-- 0004: hours + availability days, match score & campus, three-way loops, vault checklist, verified skills.
alter table listings add column est_hours numeric(4,1) not null default 1 check (est_hours > 0 and est_hours <= 200);
alter table listings add column days text[] not null default '{}' check (days <@ array['mon','tue','wed','thu','fri','sat','sun']);
alter table matches add column score int not null default 0, add column same_campus boolean not null default false;

-- Reciprocal matching, now with a transparent score:
-- format fit 30 + weekday overlap 30 (15 if either side is flexible) + same city 20 + same institution 20.
create or replace function generate_matches() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with l as (
    select li.id, li.owner_id, coalesce(so.canonical_id,so.id) o, coalesce(sr.canonical_id,sr.id) r, li.format, li.days,
           lower(btrim(p.city)) city, nullif(lower(btrim(p.institution)),'') inst
    from listings li join skills so on so.id=li.offered_skill_id join skills sr on sr.id=li.requested_skill_id
         join profiles p on p.id=li.owner_id where li.status='active'),
  pairs as (
    select a.id la, b.id lb, a.owner_id ua, b.owner_id ub,
      (case when a.format=b.format or 'either' in (a.format,b.format) then 30 else 0 end
       + case when cardinality(a.days)=0 or cardinality(b.days)=0 then 15
              else 30*cardinality(array(select unnest(a.days) intersect select unnest(b.days)))/least(cardinality(a.days),cardinality(b.days)) end
       + case when a.city is not null and a.city=b.city then 20 else 0 end
       + case when a.inst is not null and a.inst=b.inst then 20 else 0 end) score,
      coalesce(a.inst=b.inst,false) campus
    from l a join l b on a.o=b.r and a.r=b.o and a.id<b.id and a.owner_id<>b.owner_id
    where not exists (select 1 from blocks k where (k.blocker_id=a.owner_id and k.blocked_id=b.owner_id) or (k.blocker_id=b.owner_id and k.blocked_id=a.owner_id))
      and not exists (select 1 from matches m where m.listing_a=a.id and m.listing_b=b.id and m.status in ('suggested','accepted','declined','completed'))
  ), ins as (
    insert into matches (listing_a,listing_b,user_a,user_b,score,same_campus) select la,lb,ua,ub,score,campus from pairs on conflict do nothing returning *
  ), nt as (
    insert into notifications (user_id,match_id,kind) select u,id,'match_suggested' from ins, lateral (values (user_a),(user_b)) v(u) on conflict do nothing returning 1
  ) select count(*) into n from ins;
  return n;
end $$;

-- Three-way loops: A gives to B, B gives to C, C gives to A. Distinct people, each listing used once per loop.
create table loops (
  id uuid primary key default gen_random_uuid(), key text not null unique,
  status text not null default 'suggested' check (status in ('suggested','accepted','declined','expired','completed')),
  created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '14 days');
create table loop_members (
  loop_id uuid not null references loops(id) on delete cascade, position int not null check (position between 0 and 2),
  listing_id uuid not null references listings(id) on delete cascade, user_id uuid not null references profiles(id),
  accepted_at timestamptz, confirmed_at timestamptz, primary key (loop_id, position), unique (loop_id, user_id));
create index on loop_members (user_id);
create table loop_messages (id uuid primary key default gen_random_uuid(), loop_id uuid not null references loops(id) on delete cascade,
  sender_id uuid not null references profiles(id), body text not null check (char_length(body) between 1 and 2000), created_at timestamptz not null default now());
create index on loop_messages (loop_id, created_at);
create table loop_awards (loop_id uuid references loops(id), user_id uuid references profiles(id), points int not null default 10, primary key (loop_id, user_id));
alter table notifications add column loop_id uuid references loops(id) on delete cascade;
create unique index notif_loop_unique on notifications (user_id, loop_id, kind) where loop_id is not null;

create function is_loop_member(l uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from loop_members where loop_id=l and user_id=auth.uid()) $$;

create function generate_loops() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with l as (select li.id, li.owner_id, coalesce(so.canonical_id,so.id) o, coalesce(sr.canonical_id,sr.id) r
             from listings li join skills so on so.id=li.offered_skill_id join skills sr on sr.id=li.requested_skill_id where li.status='active'),
  t as (
    select a.id ia, b.id ib, c.id ic, a.owner_id oa, b.owner_id ob, c.owner_id oc
    from l a join l b on b.r=a.o and b.owner_id<>a.owner_id
             join l c on c.r=b.o and c.o=a.r and c.owner_id<>a.owner_id and c.owner_id<>b.owner_id
    where a.id<b.id and a.id<c.id
      and not exists (select 1 from blocks k where (k.blocker_id,k.blocked_id) in
          ((a.owner_id,b.owner_id),(b.owner_id,a.owner_id),(b.owner_id,c.owner_id),(c.owner_id,b.owner_id),(c.owner_id,a.owner_id),(a.owner_id,c.owner_id)))
      and not exists (select 1 from loops x where x.key = a.id::text||':'||b.id::text||':'||c.id::text)
    limit 500),
  ins as (insert into loops(key) select ia::text||':'||ib::text||':'||ic::text from t on conflict do nothing returning id, key),
  mem as (insert into loop_members(loop_id,position,listing_id,user_id)
          select i.id, v.pos, v.lid, v.uid from ins i join t on i.key = t.ia::text||':'||t.ib::text||':'||t.ic::text,
          lateral (values (0,t.ia,t.oa),(1,t.ib,t.ob),(2,t.ic,t.oc)) v(pos,lid,uid) returning loop_id, user_id),
  nt as (insert into notifications(user_id,loop_id,kind) select user_id,loop_id,'loop_suggested' from mem on conflict do nothing returning 1)
  select count(*) into n from ins;
  return n;
end $$;

create function respond_to_loop(l uuid, accept boolean) returns text language plpgsql security definer set search_path = public as $$
declare r loops;
begin
  select * into r from loops where id=l for update;
  if not found or not is_loop_member(l) then raise exception 'not allowed'; end if;
  if r.status<>'suggested' or r.expires_at<now() then raise exception 'loop not open'; end if;
  if not accept then update loops set status='declined' where id=l; return 'declined'; end if;
  update loop_members set accepted_at=coalesce(accepted_at,now()) where loop_id=l and user_id=auth.uid();
  update loops set status='accepted', expires_at=now()+interval '14 days'
    where id=l and not exists (select 1 from loop_members where loop_id=l and accepted_at is null);
  return (select status from loops where id=l);
end $$;

create function confirm_loop(l uuid) returns text language plpgsql security definer set search_path = public as $$
declare r loops;
begin
  select * into r from loops where id=l for update;
  if not found or not is_loop_member(l) then raise exception 'not allowed'; end if;
  if r.status<>'accepted' or r.expires_at<now() then raise exception 'loop not confirmable'; end if;
  update loop_members set confirmed_at=coalesce(confirmed_at,now()) where loop_id=l and user_id=auth.uid();
  if not exists (select 1 from loop_members where loop_id=l and confirmed_at is null) then
    update loops set status='completed' where id=l;
    with aw as (insert into loop_awards(loop_id,user_id) select loop_id,user_id from loop_members where loop_id=l on conflict do nothing returning user_id, points)
    update profiles p set reputation_points = p.reputation_points + aw.points from aw where p.id=aw.user_id;
    insert into notifications(user_id,loop_id,kind) select user_id,l,'awarded' from loop_members where loop_id=l on conflict do nothing;
    return 'completed';
  end if;
  return 'awaiting_others';
end $$;

create or replace function expire_matches() returns int language plpgsql security definer set search_path = public as $$
declare a int; b int;
begin
  with e as (update matches set status='expired' where status in ('suggested','accepted') and expires_at<now() returning 1) select count(*) into a from e;
  with e as (update loops set status='expired' where status in ('suggested','accepted') and expires_at<now() returning 1) select count(*) into b from e;
  return a+b;
end $$;

-- Vault checklist
create table vault_tasks (
  id uuid primary key default gen_random_uuid(), match_id uuid not null references matches(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120), done boolean not null default false,
  created_by uuid not null references profiles(id), done_by uuid references profiles(id), done_at timestamptz, created_at timestamptz not null default now());
create index on vault_tasks (match_id);
create function stamp_task() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.done then new.done_by := coalesce(case when old.done then old.done_by end, auth.uid()); new.done_at := coalesce(case when old.done then old.done_at end, now());
  else new.done_by := null; new.done_at := null; end if; return new; end $$;
create trigger tasks_stamp before update on vault_tasks for each row execute function stamp_task();

-- Verified skills: earned only through completed exchanges (pairs or loops). Aggregated and public.
create view verified_skills as
select x.user_id, s.id as skill_id, s.name as skill_name, count(*)::int as completed from (
  select m.user_a user_id, li.offered_skill_id sid from matches m join listings li on li.id=m.listing_a where m.status='completed'
  union all select m.user_b, li.offered_skill_id from matches m join listings li on li.id=m.listing_b where m.status='completed'
  union all select lm.user_id, li.offered_skill_id from loop_members lm join loops l on l.id=lm.loop_id join listings li on li.id=lm.listing_id where l.status='completed'
) x join skills s on s.id=x.sid group by x.user_id, s.id, s.name;
grant select on verified_skills to anon, authenticated;

create or replace view user_reputation with (security_invoker = false) as
select p.id as user_id, p.display_name, p.reputation_points,
  ((select count(*) from matches m where m.status='completed' and p.id in (m.user_a,m.user_b))
   + (select count(*) from loop_members lm join loops l on l.id=lm.loop_id where l.status='completed' and lm.user_id=p.id)) as completed_exchanges,
  ((select count(*) from matches m where m.status='completed' and p.id in (m.user_a,m.user_b))
   + (select count(*) from loop_members lm join loops l on l.id=lm.loop_id where l.status='completed' and lm.user_id=p.id)) >= 1 as has_starter_badge,
  (select round(avg(stars),2) from ratings r where r.ratee_id=p.id) as avg_rating
from profiles p;

alter table loops enable row level security; alter table loop_members enable row level security;
alter table loop_messages enable row level security; alter table loop_awards enable row level security; alter table vault_tasks enable row level security;
create policy loops_read on loops for select using (is_loop_member(id) or is_admin());
create policy lm_read on loop_members for select using (is_loop_member(loop_id) or is_admin());
create policy lmsg_read on loop_messages for select using (is_loop_member(loop_id));
create policy lmsg_ins on loop_messages for insert with check (sender_id=auth.uid() and is_loop_member(loop_id)
  and exists (select 1 from loops where id=loop_id and status in ('accepted','completed')));
create policy lawards_read on loop_awards for select using (user_id=auth.uid() or is_admin());
create policy tasks_read on vault_tasks for select using (is_participant(match_id));
create policy tasks_ins on vault_tasks for insert with check (created_by=auth.uid() and is_participant(match_id)
  and exists (select 1 from matches where id=match_id and status='accepted'));
create policy tasks_upd on vault_tasks for update using (is_participant(match_id)) with check (is_participant(match_id));
create policy tasks_del on vault_tasks for delete using (created_by=auth.uid());
-- Admin listing moderation (deactivate) is already covered by listings_upd (owner or admin).
-- Live updates for loop chat and checklist (Supabase only)
do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table loop_messages;
    alter publication supabase_realtime add table vault_tasks;
  end if; end $$;
