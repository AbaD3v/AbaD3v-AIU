begin;

create schema if not exists codeproof_private;
revoke all on schema codeproof_private from public;
grant usage on schema codeproof_private to authenticated;

create table public.codeproof_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  role text not null default 'student' check (role in ('student', 'admin')),
  blocked boolean not null default false
);

create function codeproof_private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_anonymous then
    return new;
  end if;
  insert into public.codeproof_profiles (id, name)
  values (new.id, coalesce(nullif(left(btrim(new.raw_user_meta_data ->> 'name'), 40), ''), 'Студент'));
  return new;
end;
$$;

revoke all on function codeproof_private.create_profile() from public, anon, authenticated;

create trigger codeproof_auth_user_created
after insert on auth.users
for each row execute function codeproof_private.create_profile();

insert into public.codeproof_profiles (id, name)
select id, coalesce(nullif(left(btrim(raw_user_meta_data ->> 'name'), 40), ''), 'Студент')
from auth.users
where not coalesce(is_anonymous, false)
on conflict (id) do nothing;

create function codeproof_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.codeproof_profiles
    where id = (select auth.uid()) and role = 'admin' and not blocked
  );
$$;

create function codeproof_private.has_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.codeproof_profiles
    where id = (select auth.uid()) and not blocked
  );
$$;

revoke all on function codeproof_private.is_admin(), codeproof_private.has_access()
from public, anon, authenticated;
grant execute on function codeproof_private.is_admin(), codeproof_private.has_access()
to authenticated;

alter table public.codeproof_profiles enable row level security;
revoke all on table public.codeproof_profiles from public, anon, authenticated;
grant select, update (blocked) on table public.codeproof_profiles to authenticated;
create policy profile_self_or_admin on public.codeproof_profiles for select to authenticated
  using (id = (select auth.uid()) or (role = 'student' and (select codeproof_private.is_admin())));
create policy admin_blocks_students on public.codeproof_profiles for update to authenticated
  using (role = 'student' and (select codeproof_private.is_admin()))
  with check (role = 'student' and (select codeproof_private.is_admin()));

create function codeproof_private.admin_students()
returns table (id uuid, name text, role text, blocked boolean, login character varying)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.role, p.blocked, u.email
  from public.codeproof_profiles p
  join auth.users u on u.id = p.id
  where p.role = 'student' and u.email_confirmed_at is not null
    and (select codeproof_private.is_admin());
$$;

revoke all on function codeproof_private.admin_students() from public, anon, authenticated;
grant execute on function codeproof_private.admin_students() to authenticated;

create view public.codeproof_admin_students
with (security_invoker = true, security_barrier = true)
as
select s.id, s.name, s.role, s.blocked, s.login::character varying(255) as login
from codeproof_private.admin_students() s;

revoke all on table public.codeproof_admin_students from public, anon, authenticated;
grant select on table public.codeproof_admin_students to authenticated;

create table public.codeproof_study (
  user_id uuid primary key references public.codeproof_profiles (id) on delete cascade,
  revision uuid not null,
  state jsonb not null,
  check (jsonb_typeof(state) = 'object' and state -> 'version' is not distinct from '1'::jsonb
    and octet_length(state::text) <= 16000000)
);

alter table public.codeproof_study enable row level security;
revoke all on table public.codeproof_study from public, anon, authenticated;
grant select, insert, update on table public.codeproof_study to authenticated;
create policy study_owner on public.codeproof_study for all to authenticated
  using (user_id = (select auth.uid()) and (select codeproof_private.has_access()))
  with check (user_id = (select auth.uid()) and (select codeproof_private.has_access()));

-- Administrators see task progress without access to student notes or query history.
create function codeproof_private.admin_progress()
returns table (user_id uuid, progress jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, s.state -> 'progress'
  from public.codeproof_profiles p
  left join public.codeproof_study s on s.user_id = p.id
  where p.role = 'student' and (select codeproof_private.is_admin());
$$;

revoke all on function codeproof_private.admin_progress() from public, anon, authenticated;
grant execute on function codeproof_private.admin_progress() to authenticated;

create view public.codeproof_admin_progress
with (security_invoker = true, security_barrier = true)
as
select p.user_id, p.progress
from codeproof_private.admin_progress() p;

revoke all on table public.codeproof_admin_progress from public, anon, authenticated;
grant select on table public.codeproof_admin_progress to authenticated;

create table public.codeproof_quiz_results (
  user_id uuid not null references public.codeproof_profiles (id) on delete cascade,
  task_id text not null check (task_id ~ '^[a-z0-9-]{1,80}$'),
  score integer not null,
  question_count integer not null check (question_count between 1 and 100),
  completed_at timestamptz not null,
  primary key (user_id, task_id),
  check (score between 0 and question_count)
);

alter table public.codeproof_quiz_results enable row level security;
revoke all on table public.codeproof_quiz_results from public, anon, authenticated;
grant select, insert, update on table public.codeproof_quiz_results to authenticated;
create policy quiz_result_owner on public.codeproof_quiz_results for all to authenticated
  using (user_id = (select auth.uid()) and (select codeproof_private.has_access()))
  with check (user_id = (select auth.uid()) and (select codeproof_private.has_access()));

create table public.codeproof_site_names (
  key text primary key check (key ~ '^[A-Za-z0-9._-]{1,128}$'),
  value text check (char_length(btrim(value)) between 1 and 2000)
);

create table public.codeproof_quizzes (
  task_id text primary key check (task_id ~ '^[a-z0-9-]{1,80}$'),
  questions jsonb not null,
  check (case when jsonb_typeof(questions) = 'array'
    then jsonb_array_length(questions) <= 100 and pg_column_size(questions) <= 524288
    else false end)
);

alter table public.codeproof_site_names enable row level security;
alter table public.codeproof_quizzes enable row level security;
revoke all on table public.codeproof_site_names, public.codeproof_quizzes from public, anon, authenticated;
grant select on table public.codeproof_site_names, public.codeproof_quizzes to anon, authenticated;
grant insert, update on table public.codeproof_site_names, public.codeproof_quizzes to authenticated;

create policy site_names_read on public.codeproof_site_names for select to anon, authenticated using (true);
create policy quizzes_read on public.codeproof_quizzes for select to anon, authenticated using (true);
create policy site_names_admin_insert on public.codeproof_site_names for insert to authenticated
  with check ((select codeproof_private.is_admin()));
create policy site_names_admin_update on public.codeproof_site_names for update to authenticated
  using ((select codeproof_private.is_admin())) with check ((select codeproof_private.is_admin()));
create policy quizzes_admin_insert on public.codeproof_quizzes for insert to authenticated
  with check ((select codeproof_private.is_admin()));
create policy quizzes_admin_update on public.codeproof_quizzes for update to authenticated
  using ((select codeproof_private.is_admin())) with check ((select codeproof_private.is_admin()));

commit;
