\timing off
insert into skills(name,category) select 'Skill '||g,'Bench' from generate_series(1,40) g;
insert into auth.users(id,email) select gen_random_uuid(), 'u'||g||'@x.test' from generate_series(1,5000) g;
create temp table sk as select id, row_number() over () rn from skills;
create temp table us as select id, row_number() over () rn from profiles;
select setseed(0.42);
insert into listings(owner_id,title,description,offered_skill_id,requested_skill_id)
select u.id,'Listing '||g,'d',o.id,r.id
from (select g, 1+floor(random()*5000)::int ur, 1+floor(random()*40)::int os, 1+floor(random()*40)::int rs from generate_series(1,10000) g) x
join us u on u.rn=x.ur join sk o on o.rn=x.os join sk r on r.rn=x.rs and r.id<>o.id;
select 'listings', count(*) from listings;
analyze;
\timing on
select 'first matching run', generate_matches();
select 'second run (idempotent)', generate_matches();
