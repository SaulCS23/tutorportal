-- ============================================================
-- Migration: homework_notifications — wires the notifications
--             system (from 20240115) into the assignment/
--             submission/grading workflow.
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Root cause this migration fixes: public.assignments and
-- public.assignment_submissions are written directly by the client
-- (INSERT/UPDATE grants gated by RLS — see 20240107 and 20240109),
-- unlike the meeting-cancellation workflow, which only ever writes
-- through SECURITY DEFINER RPCs. notify_user() has no EXECUTE grant to
-- anyone (by design — see 20240115), so no code path ever called it for
-- publishing an assignment, submitting homework, or grading it. The fix
-- is the same technique class_meetings itself would use if it were
-- client-writable: AFTER triggers on the two tables, SECURITY DEFINER
-- so they can reach notify_user() regardless of who (student/teacher)
-- fired the write, mirroring the "server/database owns notifications"
-- rule.
--
-- Assumptions:
--   public.assignments             exists (from 20240107)
--   public.assignment_submissions  exists (from 20240109)
--   public.classes                 exists (from 20240102)
--   public.class_members           exists (from 20240102)
--   public.profiles                exists (from 20240101)
--   public.notify_user(...)        exists (from 20240115, no grants —
--                                    callable only from SECURITY DEFINER
--                                    function bodies like the ones below)
-- ============================================================

-- ── Extend the notification type vocabulary ─────────────────────

ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_type_values;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_values CHECK (
    type IN (
      'makeup_requested', 'group_pending_reschedule',
      'makeup_approved', 'makeup_rejected', 'group_rescheduled',
      'homework_assigned', 'homework_submitted', 'homework_graded'
    )
  );

-- ── notify_assignment_published: notify every enrolled student ─────
--
-- Fires when an assignment becomes published — either created already
-- published (CreateAssignmentForm's "Publish immediately" toggle) or
-- edited from draft to published (AssignmentCard). Re-saving an
-- already-published assignment is a no-op here (OLD.status IS DISTINCT
-- FROM 'published' is false), so editing a published assignment's title
-- or due date never re-spams students.

CREATE OR REPLACE FUNCTION public.notify_assignment_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_name text;
  v_student_id uuid;
BEGIN
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published')
  THEN
    SELECT name INTO v_class_name FROM public.classes WHERE id = NEW.class_id;

    FOR v_student_id IN
      SELECT student_id FROM public.class_members WHERE class_id = NEW.class_id
    LOOP
      PERFORM public.notify_user(
        v_student_id,
        'homework_assigned',
        'New homework assigned',
        COALESCE(NEW.title, 'A new assignment') || ' was assigned in ' ||
          COALESCE(v_class_name, 'your class') || '.',
        '/homework/' || NEW.id::text
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER assignments_notify_published
  AFTER INSERT OR UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_assignment_published();

-- ── notify_submission_submitted: notify the teacher ─────────────────
--
-- Fires on the transition into 'submitted' — either a fresh INSERT with
-- status='submitted' (SubmissionForm's "Submit Assignment" when no prior
-- draft exists) or an UPDATE from 'draft' into 'submitted'. Saving a
-- draft, or editing an already-submitted answer before the due date,
-- does not re-fire (status stays 'submitted' — OLD.status IS DISTINCT
-- FROM 'submitted' is false).

CREATE OR REPLACE FUNCTION public.notify_submission_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id       uuid;
  v_class_id         uuid;
  v_class_name       text;
  v_assignment_title text;
  v_student_name     text;
BEGIN
  IF NEW.status = 'submitted'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted')
  THEN
    SELECT a.title, a.class_id, c.teacher_id, c.name
      INTO v_assignment_title, v_class_id, v_teacher_id, v_class_name
    FROM public.assignments a
    JOIN public.classes     c ON c.id = a.class_id
    WHERE a.id = NEW.assignment_id;

    SELECT full_name INTO v_student_name FROM public.profiles WHERE id = NEW.student_id;

    PERFORM public.notify_user(
      v_teacher_id,
      'homework_submitted',
      'Homework submitted',
      COALESCE(v_student_name, 'A student') || ' submitted ' ||
        COALESCE(v_assignment_title, 'an assignment') || ' in ' ||
        COALESCE(v_class_name, 'your class') || '.',
      '/teacher/classes/' || v_class_id::text || '/assignments/' ||
        NEW.assignment_id::text || '/submissions'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER assignment_submissions_notify_submitted
  AFTER INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_submission_submitted();

-- ── notify_submission_graded: notify the student ────────────────────
--
-- Fires on the transition into ('graded', 'returned') from a status
-- that was not already one of those two — the first time a score is
-- recorded, whether the teacher's initial action is "Save Grade" or
-- "Return to Student". A teacher editing the score/feedback afterward
-- (graded -> graded, or graded -> returned) does not re-fire; only the
-- very first grading notifies the student, matching submission_manage_
-- grading's own "first grading" rule from 20240109.

CREATE OR REPLACE FUNCTION public.notify_submission_graded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_title text;
BEGIN
  IF NEW.status IN ('graded', 'returned')
     AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('graded', 'returned'))
  THEN
    SELECT title INTO v_assignment_title FROM public.assignments WHERE id = NEW.assignment_id;

    PERFORM public.notify_user(
      NEW.student_id,
      'homework_graded',
      'Homework graded',
      COALESCE(v_assignment_title, 'Your assignment') || ' was graded.',
      '/homework/' || NEW.assignment_id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER assignment_submissions_notify_graded
  AFTER INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_submission_graded();
