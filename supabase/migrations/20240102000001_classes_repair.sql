-- ============================================================
-- Repair / idempotent re-run for the classes migration.
-- Safe to run multiple times. Use this if the main migration
-- was partially applied or ran into an error mid-way.
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

create table if not exists public.classes (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  subject    text,
  teacher_id uuid        not null references public.profiles(id) on delete cascade,
  join_code  text        unique not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_members (
  class_id   uuid        not null references public.classes(id) on delete cascade,
  student_id uuid        not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (class_id, student_id)
);

-- ── Functions (CREATE OR REPLACE is idempotent) ──────────────

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

create or replace function public.set_class_join_code()
returns trigger
language plpgsql
as $$
begin
  if new.join_code is null or trim(new.join_code) = '' then
    new.join_code := public.generate_class_code();
  end if;
  return new;
end;
$$;

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
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  normalized_code := upper(trim(input_code));
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'student'
  ) then
    raise exception 'Only students can join classes';
  end if;
  select id into target_class_id
  from public.classes
  where join_code = normalized_code;
  if target_class_id is null then
    raise exception 'Invalid class code';
  end if;
  if exists (
    select 1 from public.class_members
    where class_id = target_class_id and student_id = auth.uid()
  ) then
    raise exception 'Already enrolled in this class';
  end if;
  insert into public.class_members (class_id, student_id)
  values (target_class_id, auth.uid());
  return target_class_id;
end;
$$;

-- ── Revoke direct access to internal functions ────────────────

revoke execute on function public.generate_class_code() from public;
revoke execute on function public.generate_class_code() from anon;
revoke execute on function public.set_class_join_code() from public;
revoke execute on function public.set_class_join_code() from anon;
revoke execute on function public.join_class_by_code(text) from public;
revoke execute on function public.join_class_by_code(text) from anon;
grant execute on function public.join_class_by_code(text) to authenticated;

-- ── Trigger (drop + recreate is idempotent) ──────────────────

drop trigger if exists before_insert_set_class_code on public.classes;
create trigger before_insert_set_class_code
  before insert on public.classes
  for each row
  execute procedure public.set_class_join_code();

-- ── Indexes ──────────────────────────────────────────────────

create index if not exists classes_teacher_id_idx     on public.classes(teacher_id);
create index if not exists classes_join_code_idx       on public.classes(join_code);
create index if not exists class_members_student_id_idx on public.class_members(student_id);

-- ── RLS ──────────────────────────────────────────────────────

alter table public.classes       enable row level security;
alter table public.class_members  enable row level security;

-- ── Policies — each wrapped in a DO block for idempotency ────
-- Policies do not support CREATE OR REPLACE, so we check before creating.

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'classes' and policyname = 'Teachers can create classes'
  ) then
    create policy "Teachers can create classes"
      on public.classes for insert to authenticated
      with check (
        teacher_id = auth.uid()
        and exists (
          select 1 from public.profiles where id = auth.uid() and role = 'teacher'
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'classes' and policyname = 'Teachers can read own classes'
  ) then
    create policy "Teachers can read own classes"
      on public.classes for select to authenticated
      using (teacher_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'classes' and policyname = 'Enrolled students can read joined classes'
  ) then
    create policy "Enrolled students can read joined classes"
      on public.classes for select to authenticated
      using (
        exists (
          select 1 from public.class_members
          where class_id = classes.id and student_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'classes' and policyname = 'Teachers can update own classes'
  ) then
    create policy "Teachers can update own classes"
      on public.classes for update to authenticated
      using (teacher_id = auth.uid())
      with check (teacher_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'classes' and policyname = 'Teachers can delete own classes'
  ) then
    create policy "Teachers can delete own classes"
      on public.classes for delete to authenticated
      using (teacher_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'class_members' and policyname = 'Teachers can read members of own classes'
  ) then
    create policy "Teachers can read members of own classes"
      on public.class_members for select to authenticated
      using (
        exists (
          select 1 from public.classes
          where id = class_members.class_id and teacher_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'class_members' and policyname = 'Students can read members of enrolled classes'
  ) then
    create policy "Students can read members of enrolled classes"
      on public.class_members for select to authenticated
      using (
        class_id in (
          select cm2.class_id from public.class_members as cm2
          where cm2.student_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'class_members' and policyname = 'Teachers can remove students from own classes'
  ) then
    create policy "Teachers can remove students from own classes"
      on public.class_members for delete to authenticated
      using (
        exists (
          select 1 from public.classes
          where id = class_members.class_id and teacher_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'class_members' and policyname = 'Students can leave own classes'
  ) then
    create policy "Students can leave own classes"
      on public.class_members for delete to authenticated
      using (student_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'profiles' and policyname = 'Teachers can read profiles of their students'
  ) then
    create policy "Teachers can read profiles of their students"
      on public.profiles for select to authenticated
      using (
        exists (
          select 1
          from public.class_members cm
          join public.classes c on c.id = cm.class_id
          where cm.student_id = profiles.id
            and c.teacher_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'profiles' and policyname = 'Students can read profiles of class teachers'
  ) then
    create policy "Students can read profiles of class teachers"
      on public.profiles for select to authenticated
      using (
        exists (
          select 1
          from public.class_members cm
          join public.classes c on c.id = cm.class_id
          where c.teacher_id = profiles.id
            and cm.student_id = auth.uid()
        )
      );
  end if;
end $$;

-- ── Grants ───────────────────────────────────────────────────

grant select, insert, update, delete on public.classes      to authenticated;
grant select, delete                  on public.class_members to authenticated;
