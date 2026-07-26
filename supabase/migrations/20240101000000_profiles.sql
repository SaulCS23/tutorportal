-- ============================================================
-- Migration: profiles table, trigger, RLS, and secure RPC
-- ============================================================

-- 1. Profiles table
create table public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  full_name  text        not null,
  role       text        not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('student', 'teacher'))
);

-- 2. Enable Row Level Security
alter table public.profiles enable row level security;

-- 3. RLS policies
--    Authenticated users may read only their own row.
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- No blanket UPDATE policy — role changes are blocked at the database level.
-- Full-name updates must go through the update_own_full_name() RPC below.

-- 4. Grant minimal table permissions (RLS still applies)
grant select on public.profiles to authenticated;

-- 5. Trigger function: auto-create profile on every new auth.users row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Student'),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Prevent direct invocation of the trigger function from the client
revoke execute on function public.handle_new_user() from public;

-- 6. Trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- 7. Secure RPC: authenticated users can update only their own full_name.
--    Role is never touched here, so it cannot be changed via the client.
create or replace function public.update_own_full_name(new_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if trim(coalesce(new_full_name, '')) = '' then
    raise exception 'Name cannot be blank';
  end if;

  update public.profiles
  set
    full_name  = trim(new_full_name),
    updated_at = now()
  where id = auth.uid();
end;
$$;

revoke execute on function public.update_own_full_name(text) from public;
revoke execute on function public.update_own_full_name(text) from anon;
grant execute on function public.update_own_full_name(text) to authenticated;
