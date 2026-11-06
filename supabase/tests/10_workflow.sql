\set ON_ERROR_STOP off
\set u1 '''11111111-1111-1111-1111-111111111111'''
\set u2 '''22222222-2222-2222-2222-222222222222'''
\set u3 '''33333333-3333-3333-3333-333333333333'''
grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;
insert into auth.users values (:u1),(:u2),(:u3);
insert into profiles(id,display_name) values (:u1,'Alice'),(:u2,'Bob'),(:u3,'Cara') on conflict (id) do update set display_name=excluded.display_name;
insert into listings(owner_id,title,description,offered_skill_id,requested_skill_id)
select :u1::uuid,'Web for design','x',(select id from skills where name='Web Development'),(select id from skills where name='Graphic Design')
union all select :u2::uuid,'Design for web','x',(select id from skills where name='Graphic Design'),(select id from skills where name='Web Development')
union all select :u3::uuid,'Tutor for CV','x',(select id from skills where name='Tutoring'),(select id from skills where name='CV Writing');
select 'T1 matches created (expect 1)', generate_matches();
select 'T2 rerun creates none (expect 0)', generate_matches();
select 'T3 notifications (expect 2)', count(*) from notifications;
set role authenticated;
set app.uid = :u1; select 'T4 alice accepts ->', respond_to_match((select id from matches),true);
select 'T5 alice accepts twice still suggested ->', respond_to_match((select id from matches),true);
set app.uid = :u3; select 'T6 outsider sees matches (expect 0)', count(*) from matches;
select 'T7 outsider accept -> error expected', respond_to_match((select id from matches),true);
select 'T8 outsider reads messages (expect 0)', count(*) from messages;
set app.uid = :u2; select 'T9 bob accepts ->', respond_to_match((select id from matches),true);
insert into messages(match_id,sender_id,body) select id,:u2,'hello' from matches;
set app.uid = :u3; insert into messages(match_id,sender_id,body) select id,:u3,'intrude' from matches;
select 'T10 outsider message insert blocked above (expect error)';
set app.uid = :u1; select 'T11 alice confirms ->', confirm_exchange((select id from matches));
select 'T12 alice confirm again ->', confirm_exchange((select id from matches));
select 'T13 points still 0 (expect 0)', reputation_points from profiles where id=:u1;
set app.uid = :u2; select 'T14 bob confirms ->', confirm_exchange((select id from matches));
select 'T15 repeat confirm after complete -> error expected', confirm_exchange((select id from matches));
select 'T16 points', display_name, reputation_points from profiles where id in (:u1,:u2) order by 2;
update profiles set reputation_points=999 where id=:u2;
select 'T17 self-award blocked (expect 10)', reputation_points from profiles where id=:u2;
update profiles set role='admin' where id=:u2;
select 'T18 self-promote blocked (expect user)', role from profiles where id=:u2;
reset role;
set role authenticated; set app.uid = :u1;
select 'T19 alice rates bob', rate_exchange((select id from matches),5,'great');
select 'T20 duplicate rating blocked (expect error)', rate_exchange((select id from matches),4,'x');
set app.uid = :u3; select 'T21 outsider rates -> error expected', rate_exchange((select id from matches),5,'x');
select 'T22 outsider sees feedback (expect 0)', count(*) from feedback;
set app.uid = :u1; insert into feedback(user_id,kind,title,description) values (:u1,'bug','Broken','desc');
select 'T23 own feedback visible (expect 1)', count(*) from feedback;
set app.uid = :u3; select 'T24 other user cannot see it (expect 0)', count(*) from feedback;
select 'T25 outsider audit (expect 0)', count(*) from audit_events;
insert into vault_files(match_id,uploader_id,path,name,mime_type,size_bytes) select id,:u3::uuid,'p','n','application/pdf',20000000 from matches;
reset role;
select 'T26 badge', display_name, has_starter_badge, completed_exchanges from user_reputation where display_name in ('Alice','Cara') order by 2;
select 'T27 reminders sent (expect 0, fresh)', send_reminders();
update matches set status='accepted', created_at=now()-interval '8 days';
select 'T28 day-7 reminders (expect 2)', send_reminders();
select 'T29 idempotent (expect 0)', send_reminders();
update matches set expires_at=now()-interval '1 day';
select 'T30 expired', expire_matches();
