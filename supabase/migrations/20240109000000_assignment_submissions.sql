-- ============================================================
-- Migration: assignment_submissions
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Assumptions:
--   public.assignments         exists and has status IN ('draft','published')
--   public.classes             exists (teacher_id references public.profiles)
--   public.class_members       exists (student_id references public.profiles)
--   public.profiles            exists
--   public.touch_updated_at()  exists (from 20240107)
--
-- Trigger execution order (PostgreSQL fires BEFORE triggers
-- alphabetically by name within the same event):
--   1. assignment_submissions_updated_at  — sets updated_at            (UPDATE only)
--   2. sub_a_immutable_fields             — rejects FK mutations       (UPDATE only)
--   3. sub_b_manage_submitted_at          — submitted_at lifecycle     (INSERT + UPDATE)
--   4. sub_c_manage_grading               — graded_at/graded_by       (INSERT + UPDATE)
--   5. sub_d_guard_fields                 — student / teacher guards   (UPDATE only)
-- ============================================================


-- ── SECURITY DEFINER helpers ──────────────────────────────────

-- public.can_student_submit(assignment_id)
--
-- Returns TRUE when ALL of the following hold:
--   1. The assignment exists AND is published (status = 'published').
--   2. auth.uid() is enrolled in the assignment's class.
--
-- Used by the student INSERT and UPDATE RLS policies.
-- SECURITY DEFINER bypasses RLS on public.assignments and
-- public.class_members, so evaluating this function never re-enters
-- RLS on assignment_submissions — no recursion is possible.
-- The result is narrowly scoped to auth.uid() — no information
-- about other users is ever exposed.

CREATE OR REPLACE FUNCTION public.can_student_submit(p_assignment_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.assignments   a
    JOIN   public.class_members cm ON cm.class_id = a.class_id
    WHERE  a.id     = p_assignment_id
      AND  a.status = 'published'
      AND  cm.student_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_student_submit(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.can_student_submit(uuid) TO authenticated;


-- public.is_teacher_of_assignment(assignment_id)
--
-- Returns TRUE when auth.uid() is the teacher of the class that owns
-- the given assignment.
-- SECURITY DEFINER bypasses RLS on public.assignments and public.classes,
-- so evaluating this function never re-enters RLS on assignment_submissions.

CREATE OR REPLACE FUNCTION public.is_teacher_of_assignment(p_assignment_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.assignments a
    JOIN   public.classes     c ON c.id = a.class_id
    WHERE  a.id         = p_assignment_id
      AND  c.teacher_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_teacher_of_assignment(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_teacher_of_assignment(uuid) TO authenticated;


-- ── Table ─────────────────────────────────────────────────────

CREATE TABLE public.assignment_submissions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id    uuid        NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  -- Defaults to the calling user so the client never needs to (and cannot
  -- usefully) supply this column on INSERT; the "student_id = auth.uid()"
  -- WITH CHECK below still enforces it if a caller sends it explicitly.
  student_id       uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,

  answer_text      text,
  attachment_url   text,

  -- 'draft'     — saved but not yet turned in
  -- 'submitted' — student has turned in the work
  -- 'graded'    — teacher has recorded a score
  -- 'returned'  — teacher has returned the work to the student
  status           text        NOT NULL DEFAULT 'draft',

  -- Nullable. NULL until the student first submits.
  -- Set automatically by sub_b_manage_submitted_at; clients must not send this field.
  submitted_at     timestamptz,

  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- Grading fields — written only by the database, never trusted from the client.
  -- Set automatically by sub_c_manage_grading whenever status enters/leaves
  -- ('graded', 'returned'); clients must not send graded_at or graded_by.
  score            numeric,
  max_score        numeric,
  teacher_feedback text,
  graded_at        timestamptz,
  graded_by        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,

  CONSTRAINT submissions_unique             UNIQUE (assignment_id, student_id),
  CONSTRAINT submissions_status_values      CHECK (status IN ('draft', 'submitted', 'graded', 'returned')),
  CONSTRAINT submissions_score_nonneg       CHECK (score     IS NULL OR score    >= 0),
  CONSTRAINT submissions_max_score_pos      CHECK (max_score IS NULL OR max_score >  0),
  CONSTRAINT submissions_score_max          CHECK (
    score IS NULL OR max_score IS NULL OR score <= max_score
  ),
  -- graded_at/graded_by are database-owned (sub_c_manage_grading) and must be
  -- present exactly when the row is in a graded/returned state — this closes
  -- off any path (RLS bug, future code change) that could leave grading
  -- metadata out of sync with the visible status.
  CONSTRAINT submissions_graded_at_consistency CHECK (
    (status IN ('graded', 'returned')) = (graded_at IS NOT NULL)
  ),
  CONSTRAINT submissions_graded_by_consistency CHECK (
    (status IN ('graded', 'returned')) = (graded_by IS NOT NULL)
  )
);


-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX submissions_assignment_id_idx      ON public.assignment_submissions(assignment_id);
CREATE INDEX submissions_student_id_idx         ON public.assignment_submissions(student_id);
CREATE INDEX submissions_status_idx             ON public.assignment_submissions(status);
-- Partial index: draft rows have NULL submitted_at, no need to index them.
CREATE INDEX submissions_submitted_at_idx       ON public.assignment_submissions(submitted_at)
  WHERE submitted_at IS NOT NULL;
CREATE INDEX submissions_assignment_student_idx ON public.assignment_submissions(assignment_id, student_id);


-- ── Trigger functions ─────────────────────────────────────────

-- ① submission_immutable_fields
--
-- Prevents any caller (student or teacher) from changing assignment_id
-- or student_id after the row has been created. The UNIQUE constraint
-- on (assignment_id, student_id) makes these effectively the row's
-- natural key, so they must never move.

CREATE OR REPLACE FUNCTION public.submission_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
  OR NEW.student_id    IS DISTINCT FROM OLD.student_id
  THEN
    RAISE EXCEPTION
      'assignment_id and student_id are immutable after creation';
  END IF;
  RETURN NEW;
END;
$$;


-- ② submission_manage_submitted_at
--
-- The database owns submitted_at entirely. Clients must omit this
-- column from INSERT and UPDATE payloads — anything they send is
-- overridden by this trigger.
--
-- Rules:
--   INSERT status = 'submitted'   → submitted_at = now()
--   INSERT status = anything else → submitted_at = NULL
--   UPDATE transitioning TO 'submitted' (from any other status)
--                              → submitted_at = now()
--   All other UPDATE transitions → submitted_at is left unchanged
--     (e.g. submitted→graded keeps the original submission timestamp;
--      going back to draft preserves the last submitted_at for auditing)

CREATE OR REPLACE FUNCTION public.submission_manage_submitted_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'submitted' THEN
      NEW.submitted_at := now();
    ELSE
      NEW.submitted_at := NULL;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Fire only on the draft→submitted transition (or any non-submitted→submitted).
    IF NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted' THEN
      NEW.submitted_at := now();
    END IF;
    -- All other transitions leave submitted_at untouched.
    -- The guard trigger below rejects explicit tampering by teachers.
  END IF;

  RETURN NEW;
END;
$$;


-- ③ submission_manage_grading
--
-- The database owns graded_at and graded_by entirely, exactly like
-- submission_manage_submitted_at owns submitted_at. Clients (including
-- the teacher grading UI) must omit both columns — anything they send
-- is overridden here. This also prevents a caller from attributing a
-- grade to a different teacher than the one actually authenticated.
--
-- Rules:
--   INSERT status IN ('graded', 'returned')  → graded_at = now() (first grading)
--   INSERT status otherwise                  → graded_at = NULL
--   UPDATE transitioning INTO ('graded', 'returned')
--     from a status that was NOT already ('graded', 'returned')
--                                            → graded_at = now() (first grading)
--   UPDATE remaining IN ('graded', 'returned')
--     (e.g. a teacher edits score/feedback, or graded → returned)
--                                            → graded_at is preserved (OLD.graded_at)
--   UPDATE transitioning OUT of ('graded', 'returned')
--                                            → graded_at = NULL
--
--   graded_by = auth.uid() on every write where the resulting status is
--   ('graded', 'returned') — it always reflects whoever is currently
--   editing the grade, and is NULL whenever the row is not graded.
--
-- Runs on both INSERT and UPDATE for symmetry, though in practice only
-- students can INSERT (see RLS below) and their INSERT policy restricts
-- status to draft/submitted, so the graded branch is only ever reached
-- from a teacher UPDATE.

CREATE OR REPLACE FUNCTION public.submission_manage_grading()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('graded', 'returned') THEN
      NEW.graded_at := now();
      NEW.graded_by := auth.uid();
    ELSE
      NEW.graded_at := NULL;
      NEW.graded_by := NULL;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IN ('graded', 'returned') THEN
      IF OLD.status NOT IN ('graded', 'returned') THEN
        NEW.graded_at := now();
      ELSE
        NEW.graded_at := OLD.graded_at;
      END IF;
      NEW.graded_by := auth.uid();
    ELSE
      NEW.graded_at := NULL;
      NEW.graded_by := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ④ submission_guard_fields
--
-- Field-level defense-in-depth on top of RLS.
--
-- This trigger fires AFTER sub_b_manage_submitted_at and
-- sub_c_manage_grading, so NEW already holds the DB-corrected
-- submitted_at / graded_at / graded_by when the guards run.
--
-- Student branch (auth.uid() = OLD.student_id):
--   Allowed to change: answer_text, attachment_url, status (draft/submitted only)
--   Blocked from changing: score, max_score, teacher_feedback, created_at
--   Blocked from setting status to 'graded' or 'returned'
--   graded_at/graded_by are not checked here: sub_c already forces them to
--   NULL whenever status is draft/submitted, so a student can never leave
--   them populated.
--
-- Teacher branch (auth.uid() ≠ OLD.student_id):
--   By elimination — the only non-student identity that RLS permits to
--   UPDATE this table is the class teacher.
--   Allowed to change: score, max_score, teacher_feedback, status (→graded/returned)
--   Blocked from changing: answer_text, attachment_url, submitted_at, created_at
--   graded_at/graded_by are not checked here: sub_c already overwrites
--   whatever the teacher sent with the server-computed value.

CREATE OR REPLACE FUNCTION public.submission_guard_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() = OLD.student_id THEN
    -- ── Student guards ────────────────────────────────────────
    IF (NEW.score            IS DISTINCT FROM OLD.score)
    OR (NEW.max_score        IS DISTINCT FROM OLD.max_score)
    OR (NEW.teacher_feedback IS DISTINCT FROM OLD.teacher_feedback)
    OR (NEW.created_at       IS DISTINCT FROM OLD.created_at)
    OR (NEW.status IN ('graded', 'returned'))
    THEN
      RAISE EXCEPTION
        'Students cannot modify grading fields or set graded/returned status';
    END IF;

  ELSE
    -- ── Teacher guards ────────────────────────────────────────
    IF (NEW.answer_text    IS DISTINCT FROM OLD.answer_text)
    OR (NEW.attachment_url IS DISTINCT FROM OLD.attachment_url)
    OR (NEW.submitted_at   IS DISTINCT FROM OLD.submitted_at)
    OR (NEW.created_at     IS DISTINCT FROM OLD.created_at)
    THEN
      RAISE EXCEPTION
        'Teachers cannot modify student answer content or submission timestamps';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ── Triggers ──────────────────────────────────────────────────
--
-- Named so that alphabetical ordering enforces the intended
-- execution sequence for BEFORE triggers on the same event:
--
--   "assignment_submissions_updated_at"  (letter 'a' — runs first)
--   "sub_a_immutable_fields"             (runs second)
--   "sub_b_manage_submitted_at"          (runs third  — corrects NEW.submitted_at)
--   "sub_c_manage_grading"               (runs fourth — corrects NEW.graded_at/graded_by)
--   "sub_d_guard_fields"                 (runs fifth  — sees all corrected values)

-- 1. Maintain updated_at (function already defined in 20240107)
CREATE TRIGGER assignment_submissions_updated_at
  BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Reject post-creation changes to FK identity columns
CREATE TRIGGER sub_a_immutable_fields
  BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.submission_immutable_fields();

-- 3. Enforce submitted_at lifecycle (fires on both INSERT and UPDATE)
CREATE TRIGGER sub_b_manage_submitted_at
  BEFORE INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.submission_manage_submitted_at();

-- 4. Enforce grading lifecycle (fires on both INSERT and UPDATE)
CREATE TRIGGER sub_c_manage_grading
  BEFORE INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.submission_manage_grading();

-- 5. Field-level student / teacher guards
CREATE TRIGGER sub_d_guard_fields
  BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.submission_guard_fields();


-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- ── INSERT ───────────────────────────────────────────────────
--
-- Only the student who owns the row may insert it.
-- can_student_submit verifies:
--   a. The assignment exists and is published (prevents draft submissions).
--   b. auth.uid() is enrolled in the assignment's class.
-- Both checks are in a single SECURITY DEFINER function — no RLS recursion.
--
-- The additional column checks stop a student from creating a row that is
-- already graded/returned or pre-populated with grading data: without
-- them, a crafted INSERT (status='graded', score=100, ...) would slip
-- past the trigger layer, because sub_d_guard_fields only runs on UPDATE.

CREATE POLICY "Students can submit own work"
  ON public.assignment_submissions FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.can_student_submit(assignment_id)
    AND status IN ('draft', 'submitted')
    AND score IS NULL
    AND max_score IS NULL
    AND teacher_feedback IS NULL
  );

-- ── SELECT ───────────────────────────────────────────────────
--
-- Students see only their own submission rows.
-- Teachers see all submission rows for assignments in their classes.
-- The two permissive policies are OR-ed: a row is visible if
-- either condition is true.

CREATE POLICY "Students can read own submissions"
  ON public.assignment_submissions FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can read class submissions"
  ON public.assignment_submissions FOR SELECT TO authenticated
  USING (public.is_teacher_of_assignment(assignment_id));

-- ── UPDATE (students) ─────────────────────────────────────────
--
-- USING: the current row must be the student's own row, in an
--        editable status, AND the assignment must still be published.
--        Unpublishing an assignment locks out further student edits.
--
-- WITH CHECK: after the update the new row must still belong to the
--        student and the status must remain in (draft, submitted).
--        This prevents the student from slipping in graded/returned
--        via RLS — the guard trigger is a second layer of defence.
--
-- submitted_at, score, and grade fields are handled by triggers
-- and are not constrained here to avoid over-specification.

CREATE POLICY "Students can update own submissions"
  ON public.assignment_submissions FOR UPDATE TO authenticated
  USING (
    student_id = auth.uid()
    AND status IN ('draft', 'submitted')
    AND public.can_student_submit(assignment_id)
  )
  WITH CHECK (
    student_id = auth.uid()
    AND status IN ('draft', 'submitted')
  );

-- ── UPDATE (teachers) ─────────────────────────────────────────
--
-- Teachers may update any submitted/graded/returned row for an
-- assignment in one of their classes. Draft rows are excluded: a draft
-- is unsubmitted, private work-in-progress that the student has not
-- turned in, so a teacher has no legitimate reason to grade it — this
-- mirrors the grading UI, which never renders a grading form for a
-- draft row, and now enforces the same rule at the database level.
-- Specific field restrictions are enforced by sub_d_guard_fields.

CREATE POLICY "Teachers can grade class submissions"
  ON public.assignment_submissions FOR UPDATE TO authenticated
  USING    (
    public.is_teacher_of_assignment(assignment_id)
    AND status <> 'draft'
  )
  WITH CHECK (
    public.is_teacher_of_assignment(assignment_id)
    AND status <> 'draft'
  );


-- ── Grants ────────────────────────────────────────────────────
-- DELETE is intentionally omitted: submissions are permanent records.

GRANT SELECT, INSERT, UPDATE ON public.assignment_submissions TO authenticated;
