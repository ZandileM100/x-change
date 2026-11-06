-- Xchange-It core schema: profiles, skills, listings, matches, messages, reputation.
create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  bio text check (char_length(bio) <= 500),
  institution text, city text,
  role text not null default 'user' check (role in ('user','admin')),
  reputation_points int not null default 0 check (reputation_points >= 0),
  created_at timestamptz not null default now()
);

create table skills (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text not null,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  canonical_id uuid references skills(id) -- alias -> canonical skill
);
create unique index skills_name_norm on skills (lower(btrim(name)));

create table listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null check (char_length(description) <= 1000),
  offered_skill_id uuid not null references skills(id),
  requested_skill_id uuid not null references skills(id),
  availability text, format text not null default 'online' check (format in ('online','in_person','either')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  check (offered_skill_id <> requested_skill_id)
);
create index on listings (owner_id);
create index on listings (status, offered_skill_id, requested_skill_id);

create table blocks (
  blocker_id uuid references profiles(id) on delete cascade,
  blocked_id uuid references profiles(id) on delete cascade,
  primary key (blocker_id, blocked_id)
);

-- One row per reciprocal pair. listing_a < listing_b gives a canonical order, so
-- the same pair of listings can only ever appear once.
create table matches (
  id uuid primary key default gen_random_uuid(),
  listing_a uuid not null references listings(id) on delete cascade,
  listing_b uuid not null references listings(id) on delete cascade,
  user_a uuid not null references profiles(id), user_b uuid not null references profiles(id),
  a_accepted_at timestamptz, b_accepted_at timestamptz,
  a_confirmed_at timestamptz, b_confirmed_at timestamptz,
  status text not null default 'suggested'
    check (status in ('suggested','accepted','declined','expired','completed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  check (user_a <> user_b), check (listing_a < listing_b)
);
create unique index matches_active_pair on matches (listing_a, listing_b)
  where status in ('suggested','accepted');
create index on matches (user_a, status); create index on matches (user_b, status);
create index on matches (status, expires_at);
create index on matches (listing_a, listing_b);  -- fast 'already matched' anti-join

create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on messages (match_id, created_at);

create table reputation_awards (  -- unique key blocks duplicate awards
  match_id uuid references matches(id), user_id uuid references profiles(id),
  points int not null default 10, created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  match_id uuid references matches(id), kind text not null, read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, match_id, kind)  -- no duplicate notifications
);

-- Helpers
create function is_admin() returns boolean language sql stable security definer
  set search_path = public as $$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin') $$;
create function is_participant(m uuid) returns boolean language sql stable security definer
  set search_path = public as $$ select exists(select 1 from matches where id = m and auth.uid() in (user_a, user_b)) $$;

-- Reciprocal matching: A offers what B wants AND B offers what A wants.
-- Skills resolve through aliases (canonical_id). Skips same user, inactive
-- listings, blocked users, existing active matches and previously declined pairs.
create function generate_matches() returns int language plpgsql security definer
  set search_path = public as $$
declare n int;
begin
  with l as (
    select li.id, li.owner_id, coalesce(so.canonical_id,so.id) o, coalesce(sr.canonical_id,sr.id) r
    from listings li join skills so on so.id=li.offered_skill_id join skills sr on sr.id=li.requested_skill_id
    where li.status='active'),
  pairs as (
    select a.id la, b.id lb, a.owner_id ua, b.owner_id ub
    from l a join l b on a.o = b.r and a.r = b.o and a.id < b.id and a.owner_id <> b.owner_id
    where true
      and not exists (select 1 from blocks k where (k.blocker_id=a.owner_id and k.blocked_id=b.owner_id)
                                                or (k.blocker_id=b.owner_id and k.blocked_id=a.owner_id))
      and not exists (select 1 from matches m where m.listing_a=a.id and m.listing_b=b.id
                      and m.status in ('suggested','accepted','declined','completed'))
  ), ins as (
    insert into matches (listing_a, listing_b, user_a, user_b)
    select la, lb, ua, ub from pairs on conflict do nothing returning *
  ), nt as (
    insert into notifications (user_id, match_id, kind)
    select u, id, 'match_suggested' from ins, lateral (values (user_a),(user_b)) v(u)
    on conflict do nothing returning 1
  ) select count(*) into n from ins;
  return n;
end $$;

-- Each participant accepts independently; accepted only when both have.
create function respond_to_match(m uuid, accept boolean) returns text language plpgsql security definer
  set search_path = public as $$
declare r matches;
begin
  select * into r from matches where id=m for update;
  if not found or auth.uid() not in (r.user_a, r.user_b) then raise exception 'not allowed'; end if;
  if r.status <> 'suggested' or r.expires_at < now() then raise exception 'match not open'; end if;
  if not accept then
    update matches set status='declined' where id=m; return 'declined';
  end if;
  update matches set a_accepted_at = case when auth.uid()=user_a then coalesce(a_accepted_at,now()) else a_accepted_at end,
                     b_accepted_at = case when auth.uid()=user_b then coalesce(b_accepted_at,now()) else b_accepted_at end
   where id=m;
  update matches set status='accepted', expires_at = now() + interval '14 days'
   where id=m and a_accepted_at is not null and b_accepted_at is not null;
  return (select status from matches where id=m);
end $$;

-- Dual confirmation; points awarded once, only when both sides confirmed.
create function confirm_exchange(m uuid) returns text language plpgsql security definer
  set search_path = public as $$
declare r matches;
begin
  select * into r from matches where id=m for update;
  if not found or auth.uid() not in (r.user_a, r.user_b) then raise exception 'not allowed'; end if;
  if r.status <> 'accepted' or r.expires_at < now() then raise exception 'exchange not confirmable'; end if;
  update matches set a_confirmed_at = case when auth.uid()=user_a then coalesce(a_confirmed_at,now()) else a_confirmed_at end,
                     b_confirmed_at = case when auth.uid()=user_b then coalesce(b_confirmed_at,now()) else b_confirmed_at end
   where id=m returning * into r;
  if r.a_confirmed_at is not null and r.b_confirmed_at is not null then
    update matches set status='completed' where id=m;
    with aw as (insert into reputation_awards (match_id,user_id) values (m,r.user_a),(m,r.user_b)
                on conflict do nothing returning user_id, points)
    update profiles p set reputation_points = p.reputation_points + aw.points from aw where p.id = aw.user_id;
    insert into notifications (user_id,match_id,kind) values (r.user_a,m,'awarded'),(r.user_b,m,'awarded') on conflict do nothing;
    return 'completed';
  end if;
  return 'awaiting_other';
end $$;

-- DB-side expiry (call from pg_cron daily, or manually: select expire_matches();)
create function expire_matches() returns int language sql security definer set search_path = public as $$
  with e as (update matches set status='expired'
             where status in ('suggested','accepted') and expires_at < now() returning 1)
  select count(*)::int from e $$;

-- RLS
alter table profiles enable row level security; alter table skills enable row level security;
alter table listings enable row level security; alter table blocks enable row level security;
alter table matches enable row level security; alter table messages enable row level security;
alter table reputation_awards enable row level security; alter table notifications enable row level security;

create policy profiles_read on profiles for select using (true);
create policy profiles_upd on profiles for update using (id=auth.uid())
  with check (id=auth.uid() and role = (select role from profiles where id=auth.uid())
              and reputation_points = (select reputation_points from profiles where id=auth.uid()));
create policy skills_read on skills for select using (status='approved' or is_admin());
create policy skills_suggest on skills for insert with check (status='pending');
create policy skills_admin on skills for update using (is_admin());
create policy listings_read on listings for select using (status='active' or owner_id=auth.uid() or is_admin());
create policy listings_ins on listings for insert with check (owner_id=auth.uid());
create policy listings_upd on listings for update using (owner_id=auth.uid() or is_admin());
create policy listings_del on listings for delete using (owner_id=auth.uid() or is_admin());
create policy blocks_own on blocks for all using (blocker_id=auth.uid()) with check (blocker_id=auth.uid());
create policy matches_read on matches for select using (auth.uid() in (user_a,user_b) or is_admin());
-- No direct insert/update on matches: only the security-definer functions above.
create policy msgs_read on messages for select using (is_participant(match_id));
create policy msgs_ins on messages for insert with check (sender_id=auth.uid() and is_participant(match_id)
  and exists (select 1 from matches where id=match_id and status in ('accepted','completed')));
create policy awards_read on reputation_awards for select using (user_id=auth.uid() or is_admin());
create policy notif_read on notifications for select using (user_id=auth.uid());
create policy notif_upd on notifications for update using (user_id=auth.uid());

-- Demo taxonomy (seed data)
insert into skills (name, category) values
 ('Web Development','Programming'),('Database Design','Programming'),('Graphic Design','Design'),
 ('Tutoring','Education'),('Writing','Content'),('Digital Marketing','Business'),
 ('Bookkeeping','Business'),('CV Writing','Career'),('Business Mentoring','Business');
