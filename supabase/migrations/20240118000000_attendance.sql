-- ============================================================
-- Migration: attendance — automatic, teacher-overridable
--             per-(meeting, student) attendance tracking.
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Assumptions:
--   public.class_meetings           exists (from 20240113/20240114)
--   public.class_members            exists (from 20240102)
--   public.profiles                 exists (from 20240101)
--   public.is_teacher_of_meeting()  exists (from 20240114)
--   public.is_enrolled_in_class()   exists (from 20240106)
--   public.meeting_starts_at()      exists (from 20240114)
--   public.meeting_ends_at()        exists (from 20240114)
--   public.touch_updated_at()       exists (from 20240107)
--
-- Product model: a NEW table, not a repurposing of
-- student_meeting_participation (20240114) — that table's own
-- attendance_status column already means something specific to the
-- cancellation/makeup workflow ('pending_individual_makeup',
-- 'makeup_approved', ...) and only ever gets a row when a student
-- requests a cancellation. General meeting attendance needs a row for
-- ANY student who joins or gets overridden, completely independent of
-- the cancellation flow, so a dedicated table keeps both concepts (and
-- their very different CHECK constraints) from colliding.
--
-- No row for a (meeting, student) pair means "never joined, not yet
-- overridden" — the same "absence of a row is the common case" pattern
-- student_meeting_participation already uses. Whether that reads as
-- 'pending' (meeting hasn't ended) or 'absent' (meeting has ended) is
-- computed at read time from meeting_ends_at() (frontend) rather than
-- flipped by a background job the instant a meeting ends — this project
-- has no scheduled-job infrastructure, and deriving it from already-
-- stored facts is simpler and can never go stale.
-- ============================================================

CREATE TABLE public.class_meeting_attendance (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id            uuid        NOT NULL REFERENCES public.class_meetings(id) ON DELETE CASCADE,
  student_id            uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Calculated status — see effectiveAttendanceStatus() on the frontend
  -- for how a missing row is folded in for display/rollups.
  attendance_status     text        NOT NULL DEFAULT 'pending',
  -- Raw signal: the exact instant the student clicked "Join Meeting"
  -- inside TutorPortal. Kept even after a teacher override, so the
  -- underlying observation is never lost — future AI features read this,
  -- not just the calculated status.
  joined_at             timestamptz,
  attendance_overridden boolean     NOT NULL DEFAULT false,
  attendance_updated_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT class_meeting_attendance_unique UNIQUE (meeting_id, student_id),
  CONSTRAINT class_meeting_attendance_status_values CHECK (
    attendance_status IN ('pending', 'present', 'late', 'absent')
  ),
  -- attendance_updated_by is set exactly when a teacher has overridden —
  -- the same paired-consistency pattern as assignment_submissions'
  -- graded_at/graded_by check from 20240109.
  CONSTRAINT class_meeting_attendance_override_consistency CHECK (
    attendance_overridden = (attendance_updated_by IS NOT NULL)
  )
);

CREATE INDEX class_meeting_attendance_meeting_id_idx ON public.class_meeting_attendance(meeting_id);
CREATE INDEX class_meeting_attendance_student_id_idx ON public.class_meeting_attendance(student_id);

CREATE TRIGGER class_meeting_attendance_updated_at
  BEFORE UPDATE ON public.class_meeting_attendance
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────
-- Same "SELECT-only grant, every write via SECURITY DEFINER RPC"
-- convention as student_meeting_participation (20240114) — no student
-- or teacher ever has a direct INSERT/UPDATE grant on this table.

ALTER TABLE public.class_meeting_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read own attendance"
  ON public.class_meeting_attendance FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can read class attendance"
  ON public.class_meeting_attendance FOR SELECT TO authenticated
  USING (public.is_teacher_of_meeting(meeting_id));

GRANT SELECT ON public.class_meeting_attendance TO authenticated;

-- ── record_meeting_join — fired the instant a student clicks
--    "Join Meeting" inside TutorPortal ──────────────────────────────
--
-- First call for a (meeting, student) pair records joined_at and
-- computes present/late from the 10-minute rule. A repeat click (the
-- student re-opens the same link) never moves joined_at later and never
-- overwrites a teacher's override — the join timestamp and an override
-- are each "first write wins" for their own owner (student vs teacher).

CREATE OR REPLACE FUNCTION public.record_meeting_join(p_meeting_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting   public.class_meetings%ROWTYPE;
  v_starts_at timestamptz;
  v_computed  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_meeting FROM public.class_meetings WHERE id = p_meeting_id;
  IF v_meeting.id IS NULL THEN
    RAISE EXCEPTION 'Meeting not found';
  END IF;

  IF NOT public.is_enrolled_in_class(v_meeting.class_id) THEN
    RAISE EXCEPTION 'Not enrolled in this class';
  END IF;

  IF v_meeting.restricted_to_student_id IS NOT NULL
     AND v_meeting.restricted_to_student_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized for this meeting';
  END IF;

  v_starts_at := public.meeting_starts_at(p_meeting_id);
  v_computed := CASE
    WHEN now() < v_starts_at + interval '10 minutes' THEN 'present'
    ELSE 'late'
  END;

  INSERT INTO public.class_meeting_attendance (meeting_id, student_id, attendance_status, joined_at)
  VALUES (p_meeting_id, auth.uid(), v_computed, now())
  ON CONFLICT (meeting_id, student_id) DO UPDATE
    SET joined_at         = COALESCE(public.class_meeting_attendance.joined_at, EXCLUDED.joined_at),
        attendance_status = CASE
          WHEN public.class_meeting_attendance.attendance_overridden
            OR public.class_meeting_attendance.joined_at IS NOT NULL
          THEN public.class_meeting_attendance.attendance_status
          ELSE EXCLUDED.attendance_status
        END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_meeting_join(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.record_meeting_join(uuid) TO authenticated;

-- ── set_meeting_attendance — teacher override, always wins ─────────
--
-- Pending is deliberately not an accepted override target — a teacher
-- makes a factual call (present/late/absent); "pending" is only ever
-- the automatic not-yet-determined state, never something to
-- deliberately set. Validates the student actually belongs to this
-- meeting (respecting restricted_to_student_id for individual makeup
-- lessons) before writing, the same defense-in-depth style already
-- used by approve_makeup_option (20240114).

CREATE OR REPLACE FUNCTION public.set_meeting_attendance(
  p_meeting_id uuid,
  p_student_id uuid,
  p_status     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_teacher_of_meeting(p_meeting_id) THEN
    RAISE EXCEPTION 'Not authorized for this meeting';
  END IF;

  IF p_status NOT IN ('present', 'late', 'absent') THEN
    RAISE EXCEPTION 'Invalid attendance status';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.class_meetings m
    JOIN public.class_members cm ON cm.class_id = m.class_id AND cm.student_id = p_student_id
    WHERE m.id = p_meeting_id
      AND (m.restricted_to_student_id IS NULL OR m.restricted_to_student_id = p_student_id)
  ) THEN
    RAISE EXCEPTION 'Student is not part of this meeting';
  END IF;

  INSERT INTO public.class_meeting_attendance (
    meeting_id, student_id, attendance_status, attendance_overridden, attendance_updated_by
  ) VALUES (
    p_meeting_id, p_student_id, p_status, true, auth.uid()
  )
  ON CONFLICT (meeting_id, student_id) DO UPDATE
    SET attendance_status     = p_status,
        attendance_overridden = true,
        attendance_updated_by = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_meeting_attendance(uuid, uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.set_meeting_attendance(uuid, uuid, text) TO authenticated;
