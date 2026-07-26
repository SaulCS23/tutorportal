-- ============================================================
-- Migration: classes and enrollment
-- ============================================================
-- Run once in Supabase SQL Editor.
-- For partial re-application use 20240102000001_classes_repair.sql instead.
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================

create table public.classes (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  subject    text,
  teacher_id uuid        not null references public.profiles(id) on delete cascade,
  join_code  text        unique not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.class_members (
  class_id   uuid        not null references public.classes(id) on delete cascade,
  student_id uuid        not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (class_id, student_id)
);

-- ============================================================
-- 2. FUNCTIONS
-- ============================================================

-- Generates a random 6-character code from an unambiguous character set.
-- Avoids I, O, 0, 1 which look alike.
create or replace function public.generate_class_code()
returns text
language plpgsql
as $$
declare
  chars        text    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code         text;
  i            integer;
  max_attempts integer := 20;
  attempt      integer := 0;
begin
  loop
    attempt := attempt + 1;
    if attempt > max_attempts then
      raise exception 'Could not generate a unique class code after % attempts', max_attempts;
    end if;

    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    end loop;

    exit when not exists (select 1 from public.classes where join_code = code);
  end loop;

  return code;
end;
$$;

revoke execute on function public.generate_class_code() from public;
revoke execute on function public.generate_class_code() from anon;

-- Trigger function: auto-set join_code before insert when not supplied.
create or replace function public.set_class_join_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.join_code is null or trim(new.join_code) = '' then
    new.join_code := upper(public.generate_class_code());
  end if;
  return new;
end;
$$;

revoke execute on function public.set_class_join_code() from public;
revoke execute on function public.set_class_join_code() from anon;

-- ============================================================
-- 3. TRIGGERS
-- ============================================================

create trigger before_insert_set_class_code
  before insert on public.classes
  for each row
  execute procedure public.set_class_join_code();

-- ============================================================
-- 4. INDEXES
-- ============================================================

create index classes_teacher_id_idx on public.classes(teacher_id);
create index classes_join_code_idx   on public.classes(join_code);
create index class_members_student_id_idx on public.class_members(student_id);

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

alter table public.classes      enable row level security;
alter table public.class_members enable row level security;

-- ── classes ──────────────────────────────────────────────────

-- Teachers can create classes (only their own; role verified in DB)
create policy "Teachers can create classes"
  on public.classes for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

-- Teachers can read their own classes
create policy "Teachers can read own classes"
  on public.classes for select
  to authenticated
  using (teacher_id = auth.uid());

-- Enrolled students can read classes they belong to
create policy "Enrolled students can read joined classes"
  on public.classes for select
  to authenticated
  using (
    exists (
      select 1 from public.class_members
      where class_id = classes.id and student_id = auth.uid()
    )
  );

-- Teachers can update their own classes
create policy "Teachers can update own classes"
  on public.classes for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- Teachers can delete their own classes (cascades to class_members)
create policy "Teachers can delete own classes"
  on public.classes for delete
  to authenticated
  using (teacher_id = auth.uid());

-- ── class_members ────────────────────────────────────────────

-- Teachers can read all memberships in their classes
create policy "Teachers can read members of own classes"
  on public.class_members for select
  to authenticated
  using (
    exists (
      select 1 from public.classes
      where id = class_members.class_id and teacher_id = auth.uid()
    )
  );

-- Students can read all memberships in classes they belong to
-- (enables member count; student names are still protected by profiles RLS)
create policy "Students can read members of enrolled classes"
  on public.class_members for select
  to authenticated
  using (
    class_id in (
      select cm2.class_id from public.class_members as cm2
      where cm2.student_id = auth.uid()
    )
  );

-- No direct INSERT on class_members — only via join_class_by_code() RPC

-- Teachers can remove students from their classes
create policy "Teachers can remove students from own classes"
  on public.class_members for delete
  to authenticated
  using (
    exists (
      select 1 from public.classes
      where id = class_members.class_id and teacher_id = auth.uid()
    )
  );

-- Students can leave their own classes
create policy "Students can leave own classes"
  on public.class_members for delete
  to authenticated
  using (student_id = auth.uid());

-- ── profiles — additional policies for cross-table reads ─────

-- Teachers can read profiles of students enrolled in their classes
create policy "Teachers can read profiles of their students"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.class_members cm
      join public.classes c on c.id = cm.class_id
      where cm.student_id = profiles.id
        and c.teacher_id = auth.uid()
    )
  );

-- Students can read the teacher profile for classes they're enrolled in
create policy "Students can read profiles of class teachers"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.class_members cm
      join public.classes c on c.id = cm.class_id
      where c.teacher_id = profiles.id
        and cm.student_id = auth.uid()
    )
  );

-- ============================================================
-- 6. GRANTS
-- ============================================================

-- Authenticated users may use classes (RLS further restricts by role)
grant select, insert, update, delete on public.classes to authenticated;

-- No INSERT granted on class_members — students must use the RPC
grant select, delete on public.class_members to authenticated;

-- ============================================================
-- 7. RPC: join_class_by_code
-- ============================================================

create or replace function public.join_class_by_code(input_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code  text;
  target_class_id  uuid;
begin
  -- Require an authenticated caller
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Normalize: trim whitespace and uppercase
  normalized_code := upper(trim(input_code));

  -- Verify the caller is a student (role enforced in the database)
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'student'
  ) then
    raise exception 'Only students can join classes';
  end if;

  -- Find the matching class
  select id into target_class_id
  from public.classes
  where join_code = normalized_code;

  if target_class_id is null then
    raise exception 'Invalid class code';
  end if;

  -- Reject duplicate enrollment with a clear message
  if exists (
    select 1 from public.class_members
    where class_id = target_class_id and student_id = auth.uid()
  ) then
    raise exception 'Already enrolled in this class';
  end if;

  -- Insert the membership
  insert into public.class_members (class_id, student_id)
  values (target_class_id, auth.uid());

  return target_class_id;
end;
$$;

revoke execute on function public.join_class_by_code(text) from public;
revoke execute on function public.join_class_by_code(text) from anon;
grant execute on function public.join_class_by_code(text) to authenticated;
