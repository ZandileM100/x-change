-- Optional profile pictures. Public-read bucket; each user can write only inside their own folder.
alter table profiles add column if not exists avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500);
do $$ begin
  if exists (select 1 from pg_namespace where nspname='storage') then
    insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
    values ('avatars','avatars',true,2097152,array['image/png','image/jpeg','image/webp']) on conflict (id) do nothing;
    execute $p$create policy avatars_read on storage.objects for select using (bucket_id='avatars')$p$;
    execute $p$create policy avatars_ins on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text)$p$;
    execute $p$create policy avatars_upd on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text)$p$;
    execute $p$create policy avatars_del on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text)$p$;
  end if; end $$;
