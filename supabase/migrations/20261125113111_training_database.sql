create table public.codeproof_training_database (
  id boolean primary key default true check (id),
  revision uuid not null default gen_random_uuid(),
  config jsonb not null default '{"names":{},"rows":{}}',
  check (
    jsonb_typeof(config) = 'object'
    and jsonb_typeof(config -> 'names') is not distinct from 'object'
    and jsonb_typeof(config -> 'rows') is not distinct from 'object'
    and octet_length(config::text) <= 600000
  )
);

insert into public.codeproof_training_database (id) values (true);

alter table public.codeproof_training_database enable row level security;
revoke all on table public.codeproof_training_database from public, anon, authenticated;
grant select (id, revision, config) on public.codeproof_training_database to anon, authenticated;
grant update (revision, config) on public.codeproof_training_database to authenticated;

create policy training_database_read on public.codeproof_training_database
  for select to anon, authenticated using (true);
create policy training_database_admin_update on public.codeproof_training_database
  for update to authenticated using ((select codeproof_private.is_admin()))
  with check ((select codeproof_private.is_admin()));
