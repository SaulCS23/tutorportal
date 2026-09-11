-- ============================================================
-- Migration: shared teacher schedule — one combined master schedule
--             for every teacher, plus a secure "take class" mechanism
--             for currently-unassigned classes.
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Design:
--   classes.teacher_id becomes nullable ("Unassigned"). Rather than
--   broadening the existing per-table RLS on classes/class_schedules/
--   class_meetings/class_members (which would also change what every
--   other consumer of those tables — e.g. /teacher/classes/[id]/* class
--   management pages — can see, well beyond this task's scope), the
--   master schedule is served by two new SECURITY DEFINER RPCs gated by
--   is_teacher(). This is the same pattern already used for
--   get_class_students and list_teacher_access_requests: a curated,
--   read-only, cross-user view instead of a blanket table-level grant.
--   Existing owner-scoped RLS (is_class_teacher(...)) is completely
--   untouched, so every other page keeps its current behavior exactly.
--
-- Assumptions:
--   public.classes            exists (from 20240102)
--   public.class_schedules    exists (from 20240108)
--   public.class_meetings     exists (from 20240113)
--   public.class_members      exists (from 20240102)
--   public.profiles           exists (from 20240101)
-- ============================================================

-- ── is_teacher: any authenticated teacher, not just a class owner ───

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_teacher() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_teacher() TO authenticated;

-- ── classes.teacher_id becomes nullable ("Unassigned") ───────────────
--
-- Purely additive: every existing class already has a real teacher_id,
-- so this changes nothing for current rows. All existing RLS policies
-- and RPCs that compare teacher_id = auth.uid() are unaffected — NULL
-- simply never equals any auth.uid().

ALTER TABLE public.classes ALTER COLUMN teacher_id DROP NOT NULL;

-- ── list_master_class_schedules: every recurring slot, any teacher ──

CREATE OR REPLACE FUNCTION public.list_master_class_schedules()
RETURNS TABLE (
  id               uuid,
  class_id         uuid,
  day_of_week      integer,
  start_time       time,
  end_time         time,
  timezone         text,
  meeting_provider text,
  meeting_link     text,
  location         text,
  class_name       text,
  subject          text,
  teacher_id       uuid,
  teacher_name     text,
  student_names    text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    cs.id, cs.class_id, cs.day_of_week, cs.start_time, cs.end_time,
    cs.timezone, cs.meeting_provider, cs.meeting_link, cs.location,
    c.name, c.subject, c.teacher_id, tp.full_name,
    COALESCE(
      (SELECT array_agg(sp.full_name ORDER BY sp.full_name)
       FROM public.class_members cm
       JOIN public.profiles sp ON sp.id = cm.student_id
       WHERE cm.class_id = c.id),
      '{}'::text[]
    )
  FROM public.class_schedules cs
  JOIN public.classes c       ON c.id = cs.class_id
  LEFT JOIN public.profiles tp ON tp.id = c.teacher_id
  ORDER BY cs.day_of_week, cs.start_time;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_master_class_schedules() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.list_master_class_schedules() TO authenticated;

-- ── list_master_class_meetings: every concrete dated meeting ────────

CREATE OR REPLACE FUNCTION public.list_master_class_meetings()
RETURNS TABLE (
  id               uuid,
  class_id         uuid,
  title            text,
  meeting_date     date,
  start_time       time,
  end_time         time,
  timezone         text,
  meeting_provider text,
  meeting_link     text,
  location         text,
  status           text,
  class_name       text,
  subject          text,
  teacher_id       uuid,
  teacher_name     text,
  student_names    text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    cm2.id, cm2.class_id, cm2.title, cm2.meeting_date, cm2.start_time, cm2.end_time,
    cm2.timezone, cm2.meeting_provider, cm2.meeting_link, cm2.location, cm2.status,
    c.name, c.subject, c.teacher_id, tp.full_name,
    COALESCE(
      (SELECT array_agg(sp.full_name ORDER BY sp.full_name)
       FROM public.class_members mem
       JOIN public.profiles sp ON sp.id = mem.student_id
       WHERE mem.class_id = c.id),
      '{}'::text[]
    )
  FROM public.class_meetings cm2
  JOIN public.classes c       ON c.id = cm2.class_id
  LEFT JOIN public.profiles tp ON tp.id = c.teacher_id
  ORDER BY cm2.meeting_date, cm2.start_time;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_master_class_meetings() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.list_master_class_meetings() TO authenticated;

-- ── take_class: the only way an unassigned class gets a teacher ─────
--
-- Row-locked (FOR UPDATE) so two teachers clicking "Take Class" on the
-- same unassigned class at the same moment can't both succeed — the
-- second transaction blocks, then sees the now-non-null teacher_id and
-- raises instead of silently overwriting the first teacher's claim.
-- There is deliberately no "reassign" path here: an already-assigned
-- class can never be silently overwritten by this function.

CREATE OR REPLACE FUNCTION public.take_class(p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Only teachers can take a class';
  END IF;

  SELECT teacher_id INTO v_teacher_id
  FROM public.classes
  WHERE id = p_class_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF v_teacher_id IS NOT NULL THEN
    RAISE EXCEPTION 'This class already has a responsible teacher';
  END IF;

  UPDATE public.classes
  SET teacher_id = auth.uid(), updated_at = now()
  WHERE id = p_class_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.take_class(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.take_class(uuid) TO authenticated;
