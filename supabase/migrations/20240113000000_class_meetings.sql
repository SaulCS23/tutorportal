-- ============================================================
-- Migration: class_meetings — one-off dated lesson instances,
--             distinct from the recurring weekly template.
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Assumptions:
--   public.classes            exists (from 20240102)
--   public.is_class_teacher(uuid)     exists (from 20240107) — SECURITY DEFINER,
--                              already has SET search_path = public
--   public.is_enrolled_in_class(uuid) exists (from 20240106) — SECURITY DEFINER,
--                              already has SET search_path = public
--   public.touch_updated_at() exists (from 20240107/20240108)
--
-- class_schedules (20240108) remains the recurring weekly *template* and is
-- completely untouched by this migration. class_meetings is the concrete,
-- dated *instance* of a lesson — a class can have any number of these
-- regardless of whether it also has a recurring template. Both existing
-- helpers already take a class_id, which this table has directly, so no
-- new SECURITY DEFINER function is needed.
-- ============================================================

-- ── Table ─────────────────────────────────────────────────────

CREATE TABLE public.class_meetings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id         uuid        NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,

  title            text        NOT NULL,
  description      text,

  meeting_date     date        NOT NULL,
  start_time       time        NOT NULL,
  end_time         time        NOT NULL,
  timezone         text        NOT NULL DEFAULT 'America/Panama',

  meeting_provider text,
  meeting_link     text,
  location         text,

  -- 'scheduled'  — upcoming or in-progress, the default
  -- 'completed'  — the lesson happened
  -- 'cancelled'  — will not happen; kept for history, never deleted
  status           text        NOT NULL DEFAULT 'scheduled',

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT class_meetings_title_nonempty CHECK (trim(title) <> ''),
  CONSTRAINT class_meetings_time_order     CHECK (end_time > start_time),
  CONSTRAINT class_meetings_status_values  CHECK (status IN ('scheduled', 'completed', 'cancelled'))
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX class_meetings_class_id_idx      ON public.class_meetings(class_id);
CREATE INDEX class_meetings_meeting_date_idx  ON public.class_meetings(meeting_date);
CREATE INDEX class_meetings_class_date_idx    ON public.class_meetings(class_id, meeting_date);
CREATE INDEX class_meetings_status_idx        ON public.class_meetings(status);

-- ── updated_at trigger ────────────────────────────────────────

CREATE TRIGGER class_meetings_updated_at
  BEFORE UPDATE ON public.class_meetings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE public.class_meetings ENABLE ROW LEVEL SECURITY;

-- Teachers: full read/create/update of meetings for classes they own.
-- Split into three command-scoped policies (rather than FOR ALL) so that
-- DELETE is never implicitly covered — see the "no DELETE grant" note below.
-- is_class_teacher is SECURITY DEFINER — queries classes as superuser,
-- no cross-table RLS recursion.

CREATE POLICY "Teachers can read own class meetings"
  ON public.class_meetings FOR SELECT TO authenticated
  USING (public.is_class_teacher(class_id));

CREATE POLICY "Teachers can create own class meetings"
  ON public.class_meetings FOR INSERT TO authenticated
  WITH CHECK (public.is_class_teacher(class_id));

CREATE POLICY "Teachers can update own class meetings"
  ON public.class_meetings FOR UPDATE TO authenticated
  USING    (public.is_class_teacher(class_id))
  WITH CHECK (public.is_class_teacher(class_id));

-- Students: read-only for classes they are enrolled in — no join code for
-- individual meetings, visibility is entirely derived from class enrollment.
-- is_enrolled_in_class is SECURITY DEFINER — queries class_members as
-- superuser, no cross-table RLS recursion.

CREATE POLICY "Students can read enrolled class meetings"
  ON public.class_meetings FOR SELECT TO authenticated
  USING (public.is_enrolled_in_class(class_id));

-- ── Grants ────────────────────────────────────────────────────
-- No DELETE grant at all: a meeting is cancelled (status = 'cancelled'),
-- never deleted, so history is preserved. Students get no INSERT/UPDATE
-- grant-side restriction is unnecessary beyond this — the grant is the
-- same broad "authenticated" grant every other table uses, and the actual
-- student/teacher distinction is enforced entirely by which RLS policy
-- matches (a student's INSERT/UPDATE passes the grant but matches no
-- permissive policy, so RLS denies it — the same pattern already relied
-- on everywhere else in this schema).

GRANT SELECT, INSERT, UPDATE ON public.class_meetings TO authenticated;
