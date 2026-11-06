\set ON_ERROR_STOP off
grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;
\set u4 '''44444444-4444-4444-4444-444444444444'''
\set u5 '''55555555-5555-5555-5555-555555555555'''
\set u6 '''66666666-6666-6666-6666-666666666666'''
\set u7 '''77777777-7777-7777-7777-777777777777'''
\set u8 '''88888888-8888-8888-8888-888888888888'''
insert into auth.users(id,email) values (:u4,'u4@x.t'),(:u5,'u5@x.t'),(:u6,'u6@x.t'),(:u7,'u7@x.t'),(:u8,'u8@x.t');
update profiles set institution='Sol Plaatje University', city='Kimberley' where id in (:u7,:u8);
-- loop: u4 offers Bookkeeping wants Digital Marketing; u5 offers Digital Marketing wants Writing; u6 offers Writing wants Bookkeeping
insert into listings(owner_id,title,description,offered_skill_id,requested_skill_id,days,est_hours)
select :u4::uuid,'Loop A','d',(select id from skills where name='Bookkeeping'),(select id from skills where name='Digital Marketing'),'{}'::text[],2
union all select :u5::uuid,'Loop B','d',(select id from skills where name='Digital Marketing'),(select id from skills where name='Writing'),'{}'::text[],2
union all select :u6::uuid,'Loop C','d',(select id from skills where name='Writing'),(select id from skills where name='Bookkeeping'),'{}',2;
select 'T31 loops generated (expect 1)', generate_loops();
select 'T32 rerun (expect 0)', generate_loops();
select 'T33 loop notifications (expect 3)', count(*) from notifications where loop_id is not null;
select 'T33b re-suggested expired u1-u2 pair only (expect 1)', generate_matches() ;
set role authenticated; set app.uid = :u7; select 'T34 outsider sees loops (expect 0)', count(*) from loops;
set app.uid = :u4; select 'T35a u4 accepts', respond_to_loop((select id from loops),true);
set app.uid = :u5; select 'T35b u5 accepts', respond_to_loop((select id from loops),true);
set app.uid = :u7; select 'T35c outsider accept -> error expected', respond_to_loop((select id from loops),true);
set app.uid = :u6; select 'T35d u6 accepts (expect accepted)', respond_to_loop((select id from loops),true);
select 'T36a u6 confirms', confirm_loop((select id from loops));
set app.uid = :u4; select 'T36b u4 confirms', confirm_loop((select id from loops));
set app.uid = :u5; select 'T36c u5 confirms (expect completed)', confirm_loop((select id from loops));
select 'T36d repeat -> error expected', confirm_loop((select id from loops));
select 'T37 u4 points (expect 10)', reputation_points from profiles where id=:u4;
select 'T38 verified skill for u5', skill_name from verified_skills where user_id=:u5;
select 'T38b u5 completed exchanges incl loop (expect 1)', completed_exchanges from user_reputation where user_id=:u5;
reset role;
-- score: same institution + city, both online, flexible days -> 30 + 15 + 20 + 20 = 85
insert into listings(owner_id,title,description,offered_skill_id,requested_skill_id)
select :u7::uuid,'Score A','d',(select id from skills where name='Tutoring'),(select id from skills where name='Writing') union all
select :u8::uuid,'Score B','d',(select id from skills where name='Writing'),(select id from skills where name='Tutoring');
select 'T39 matches (expect 1)', generate_matches();
select 'T40 score (expect 85) campus', score, same_campus from matches where user_a in (:u7,:u8) and user_b in (:u7,:u8);
set role authenticated; set app.uid = :u7;
select 'T41 accept u7', respond_to_match((select id from matches where user_a in (:u7,:u8) and user_b in (:u7,:u8)),true);
set app.uid = :u8; select 'T41b accept u8', respond_to_match((select id from matches where user_a in (:u7,:u8) and user_b in (:u7,:u8)),true);
set app.uid = :u7; insert into vault_tasks(match_id,title,created_by) select id,'Draft the brief',:u7 from matches where user_a in (:u7,:u8) and user_b in (:u7,:u8);
set app.uid = :u8; update vault_tasks set done=true;
select 'T42 done_by is u8 (expect 8888...)', done_by from vault_tasks;
set app.uid = :u4; select 'T43 outsider sees tasks (expect 0)', count(*) from vault_tasks;
insert into vault_tasks(match_id,title,created_by) select id,'x',:u4 from matches where user_a in (:u7,:u8);
select 'T44 outsider task insert blocked above: rows still 0', count(*) from vault_tasks;
reset role;
select 'T45 expire (expect 0)', expire_matches();
