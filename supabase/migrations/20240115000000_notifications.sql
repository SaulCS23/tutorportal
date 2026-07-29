-- ============================================================
-- Migration: notifications — bell/badge for the meeting
--             cancellation & reschedule workflow.
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Assumptions:
--   public.profiles                        exists (from 20240101)
--   public.class_members                   exists (from 20240102)
--   public.classes                          exists (from 20240102)
--   public.class_meetings                   exists (from 20240113/20240114)
--   public.individual_makeup_requests       exists (from 20240114)
--   public.group_reschedule_requests        exists (from 20240114)
--   public.request_individual_makeup(...)   exists (from 20240114)
--   public.recheck_group_majority(uuid)     exists (from 20240114)
--   public.approve_makeup_option(...)       exists (from 20240114)
--   public.reject_makeup_request(...)       exists (from 20240114)
--   public.resolve_group_reschedule(...)    exists (from 20240114)
--
-- Design: one small table, read-only to clients. Every row is inserted by
-- the SECURITY DEFINER functions that already own the meeting-cancellation
-- workflow (request_individual_makeup, recheck_group_majority,
-- approve_makeup_option, reject_makeup_request, resolve_group_reschedule)
-- via CREATE OR REPLACE FUNCTION — same technique already used elsewhere
-- in this codebase to extend existing RLS/logic from a new migration
-- file without editing the executed one. `link_path` is computed and
-- stored at insert time (not derived client-side from ids/roles), so the
-- bell just renders it directly.
-- ============================================================

CREATE TABLE public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  type       text        NOT NULL,
  title      text        NOT NULL,
  body       text,
  link_path  text,

  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notifications_type_values CHECK (
    type IN (
      'makeup_requested', 'group_pending_reschedule',
      'makeup_approved', 'makeup_rejected', 'group_rescheduled'
    )
  )
);

CREATE INDEX notifications_user_id_created_at_idx
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX notifications_user_id_unread_idx
  ON public.notifications(user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE grant to anyone — rows are written only by
-- notify_user() (private, below) and the two mark-read RPCs.
GRANT SELECT ON public.notifications TO authenticated;

-- ── notify_user — private insert helper, no grants ──────────────────
--
-- Not callable directly by anyone (no EXECUTE grant at all, same pattern
-- as recheck_group_majority) — only invoked from inside the other
-- SECURITY DEFINER functions below, which already run as the owner.

CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id   uuid,
  p_type      text,
  p_title     text,
  p_body      text,
  p_link_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link_path)
  VALUES (p_user_id, p_type, p_title, p_body, p_link_path);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM public, anon, authenticated;

-- ── mark_notification_read / mark_all_notifications_read ───────────
--
-- The only client-facing writes to this table — each is scoped to
-- auth.uid() inside the function body, mirroring the rest of this
-- workflow's "no direct table grant, RPC-gated write" convention.

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE id = p_notification_id
    AND user_id = auth.uid()
    AND read_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_notification_read(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = auth.uid()
    AND read_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- ============================================================
-- Extend the existing meeting-cancellation workflow functions with
-- notify_user() calls — CREATE OR REPLACE on the same signatures, so
-- every existing grant/revoke from 20240114 stays intact untouched.
-- Bodies below are copied from 20240114 verbatim except where noted.
-- ============================================================

-- ── request_individual_makeup: notify the teacher a request came in ──

CREATE OR REPLACE FUNCTION public.request_individual_makeup(
  p_meeting_id  uuid,
  p_reason      text,
  p_opt1_start  timestamptz,
  p_opt1_end    timestamptz,
  p_opt2_start  timestamptz,
  p_opt2_end    timestamptz,
  p_opt3_start  timestamptz,
  p_opt3_end    timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting       public.class_meetings%ROWTYPE;
  v_tz            text;
  v_meeting_start timestamptz;
  v_meeting_end   timestamptz;
  v_window_end    timestamptz;
  v_request_id    uuid;
  v_teacher_id    uuid;
  v_class_name    text;
  v_student_name  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_meeting
  FROM public.class_meetings
  WHERE id = p_meeting_id
  FOR UPDATE;

  IF v_meeting.id IS NULL THEN
    RAISE EXCEPTION 'Meeting not found';
  END IF;

  IF NOT public.is_enrolled_in_class(v_meeting.class_id) THEN
    RAISE EXCEPTION 'Not enrolled in this class';
  END IF;

  IF v_meeting.status = 'group_pending_reschedule' THEN
    RAISE EXCEPTION 'This meeting is already pending a group reschedule; individual makeup requests are closed for it';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.individual_makeup_requests
    WHERE meeting_id = p_meeting_id AND student_id = auth.uid() AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending makeup request for this meeting';
  END IF;

  v_tz            := COALESCE(NULLIF(v_meeting.timezone, ''), 'America/Panama');
  v_meeting_start := (v_meeting.meeting_date + v_meeting.start_time) AT TIME ZONE v_tz;
  v_meeting_end   := (v_meeting.meeting_date + v_meeting.end_time)   AT TIME ZONE v_tz;
  v_window_end    := v_meeting_start + interval '7 days';

  IF (v_meeting_start - now()) < interval '24 hours' THEN
    RAISE EXCEPTION 'This meeting starts in less than 24 hours; individual makeup requests are no longer accepted';
  END IF;

  IF NOT (
    p_opt1_end > p_opt1_start AND p_opt1_start > v_meeting_end AND p_opt1_end <= v_window_end
      AND (p_opt1_start AT TIME ZONE v_tz)::date = (p_opt1_end AT TIME ZONE v_tz)::date
    AND
    p_opt2_end > p_opt2_start AND p_opt2_start > v_meeting_end AND p_opt2_end <= v_window_end
      AND (p_opt2_start AT TIME ZONE v_tz)::date = (p_opt2_end AT TIME ZONE v_tz)::date
    AND
    p_opt3_end > p_opt3_start AND p_opt3_start > v_meeting_end AND p_opt3_end <= v_window_end
      AND (p_opt3_start AT TIME ZONE v_tz)::date = (p_opt3_end AT TIME ZONE v_tz)::date
  ) THEN
    RAISE EXCEPTION 'Each proposed time must be on a single day, start after the original meeting ends, and end within 7 days of the original meeting start';
  END IF;

  INSERT INTO public.student_meeting_participation (
    meeting_id, student_id, attendance_status, cancellation_policy_result, charge_status
  ) VALUES (
    p_meeting_id, auth.uid(), 'pending_individual_makeup', 'eligible', 'pending'
  )
  ON CONFLICT (meeting_id, student_id) DO UPDATE
    SET attendance_status          = 'pending_individual_makeup',
        cancellation_requested_at  = now(),
        cancellation_policy_result = 'eligible',
        charge_status              = 'pending',
        pricing_type               = NULL,
        updated_at                 = now();

  INSERT INTO public.individual_makeup_requests (meeting_id, student_id, reason)
  VALUES (p_meeting_id, auth.uid(), NULLIF(trim(coalesce(p_reason, '')), ''))
  RETURNING id INTO v_request_id;

  INSERT INTO public.individual_makeup_options (request_id, proposed_start_at, proposed_end_at)
  VALUES
    (v_request_id, p_opt1_start, p_opt1_end),
    (v_request_id, p_opt2_start, p_opt2_end),
    (v_request_id, p_opt3_start, p_opt3_end);

  SELECT c.teacher_id, c.name INTO v_teacher_id, v_class_name
  FROM public.classes c WHERE c.id = v_meeting.class_id;

  SELECT full_name INTO v_student_name FROM public.profiles WHERE id = auth.uid();

  PERFORM public.notify_user(
    v_teacher_id,
    'makeup_requested',
    'New makeup request',
    COALESCE(v_student_name, 'A student') || ' requested a makeup for ' ||
      COALESCE(v_meeting.title, 'a meeting') || ' in ' || COALESCE(v_class_name, 'your class') || '.',
    '/teacher/classes/' || v_meeting.class_id::text || '/meetings'
  );

  PERFORM public.recheck_group_majority(p_meeting_id);

  RETURN v_request_id;
END;
$$;

-- ── recheck_group_majority: notify the teacher once majority is hit ──

CREATE OR REPLACE FUNCTION public.recheck_group_majority(p_meeting_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id       uuid;
  v_status         text;
  v_enrolled_count integer;
  v_request_count  integer;
  v_teacher_id     uuid;
  v_class_name     text;
  v_meeting_title  text;
BEGIN
  SELECT class_id, status INTO v_class_id, v_status
  FROM public.class_meetings
  WHERE id = p_meeting_id
  FOR UPDATE;

  IF v_class_id IS NULL OR v_status = 'group_pending_reschedule' THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_enrolled_count
  FROM public.class_members
  WHERE class_id = v_class_id;

  SELECT count(*) INTO v_request_count
  FROM public.individual_makeup_requests
  WHERE meeting_id = p_meeting_id
    AND status = 'pending';

  IF v_enrolled_count = 0 OR v_request_count::numeric <= v_enrolled_count::numeric / 2 THEN
    RETURN;
  END IF;

  UPDATE public.class_meetings
  SET status = 'group_pending_reschedule'
  WHERE id = p_meeting_id;

  INSERT INTO public.group_reschedule_requests (meeting_id, class_id, threshold_count, eligible_student_count)
  VALUES (p_meeting_id, v_class_id, v_request_count, v_enrolled_count)
  ON CONFLICT (meeting_id) WHERE status = 'pending' DO NOTHING;

  UPDATE public.individual_makeup_requests
  SET status = 'superseded_by_group_reschedule'
  WHERE meeting_id = p_meeting_id
    AND status = 'pending';

  SELECT c.teacher_id, c.name INTO v_teacher_id, v_class_name
  FROM public.classes c WHERE c.id = v_class_id;

  SELECT title INTO v_meeting_title FROM public.class_meetings WHERE id = p_meeting_id;

  PERFORM public.notify_user(
    v_teacher_id,
    'group_pending_reschedule',
    'Meeting needs rescheduling',
    v_request_count::text || ' of ' || v_enrolled_count::text || ' students requested to reschedule ' ||
      COALESCE(v_meeting_title, 'a meeting') || ' in ' || COALESCE(v_class_name, 'your class') || '.',
    '/teacher/classes/' || v_class_id::text || '/meetings'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recheck_group_majority(uuid) FROM public, anon, authenticated;

-- ── approve_makeup_option: notify the student they were approved ───

CREATE OR REPLACE FUNCTION public.approve_makeup_option(
  p_request_id   uuid,
  p_option_id    uuid,
  p_teacher_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request        public.individual_makeup_requests%ROWTYPE;
  v_option         public.individual_makeup_options%ROWTYPE;
  v_meeting        public.class_meetings%ROWTYPE;
  v_tz             text;
  v_new_meeting_id uuid;
BEGIN
  SELECT * INTO v_request FROM public.individual_makeup_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT public.is_teacher_of_meeting(v_request.meeting_id) THEN
    RAISE EXCEPTION 'Not authorized for this meeting';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This request is no longer pending';
  END IF;

  SELECT * INTO v_option
  FROM public.individual_makeup_options
  WHERE id = p_option_id AND request_id = p_request_id;

  IF v_option.id IS NULL THEN
    RAISE EXCEPTION 'That option does not belong to this request';
  END IF;

  SELECT * INTO v_meeting FROM public.class_meetings WHERE id = v_request.meeting_id;
  v_tz := COALESCE(NULLIF(v_meeting.timezone, ''), 'America/Panama');

  INSERT INTO public.class_meetings (
    class_id, title, description, meeting_date, start_time, end_time, timezone,
    meeting_provider, meeting_link, location, status,
    restricted_to_student_id, source_meeting_id
  ) VALUES (
    v_meeting.class_id,
    v_meeting.title,
    v_meeting.description,
    (v_option.proposed_start_at AT TIME ZONE v_tz)::date,
    (v_option.proposed_start_at AT TIME ZONE v_tz)::time,
    (v_option.proposed_end_at   AT TIME ZONE v_tz)::time,
    v_tz,
    v_meeting.meeting_provider,
    v_meeting.meeting_link,
    v_meeting.location,
    'scheduled',
    v_request.student_id,
    v_meeting.id
  )
  RETURNING id INTO v_new_meeting_id;

  UPDATE public.individual_makeup_requests
  SET status             = 'approved',
      selected_option_id = p_option_id,
      teacher_note       = NULLIF(trim(coalesce(p_teacher_note, '')), '')
  WHERE id = p_request_id;

  PERFORM public.notify_user(
    v_request.student_id,
    'makeup_approved',
    'Makeup request approved',
    'Your makeup request for ' || COALESCE(v_meeting.title, 'a meeting') || ' was approved.',
    '/schedule'
  );

  RETURN v_new_meeting_id;
END;
$$;

-- ── reject_makeup_request: notify the student they were rejected ───

CREATE OR REPLACE FUNCTION public.reject_makeup_request(
  p_request_id   uuid,
  p_teacher_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request       public.individual_makeup_requests%ROWTYPE;
  v_meeting_title text;
BEGIN
  SELECT * INTO v_request FROM public.individual_makeup_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT public.is_teacher_of_meeting(v_request.meeting_id) THEN
    RAISE EXCEPTION 'Not authorized for this meeting';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This request is no longer pending';
  END IF;

  UPDATE public.individual_makeup_requests
  SET status       = 'rejected',
      teacher_note = NULLIF(trim(coalesce(p_teacher_note, '')), '')
  WHERE id = p_request_id;

  SELECT title INTO v_meeting_title FROM public.class_meetings WHERE id = v_request.meeting_id;

  PERFORM public.notify_user(
    v_request.student_id,
    'makeup_rejected',
    'Makeup request rejected',
    'Your makeup request for ' || COALESCE(v_meeting_title, 'a meeting') || ' was rejected.',
    '/schedule'
  );
END;
$$;

-- ── resolve_group_reschedule: notify every enrolled student ─────────

CREATE OR REPLACE FUNCTION public.resolve_group_reschedule(
  p_group_request_id uuid,
  p_meeting_date      date,
  p_start_time        time,
  p_end_time          time,
  p_timezone          text,
  p_meeting_provider  text,
  p_meeting_link      text,
  p_location          text,
  p_teacher_note      text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req        public.group_reschedule_requests%ROWTYPE;
  v_meeting    public.class_meetings%ROWTYPE;
  v_new_id     uuid;
  v_student_id uuid;
BEGIN
  SELECT * INTO v_req FROM public.group_reschedule_requests WHERE id = p_group_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT public.is_class_teacher(v_req.class_id) THEN
    RAISE EXCEPTION 'Not authorized for this class';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'This request has already been resolved';
  END IF;

  IF p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;

  SELECT * INTO v_meeting FROM public.class_meetings WHERE id = v_req.meeting_id;

  INSERT INTO public.class_meetings (
    class_id, title, description, meeting_date, start_time, end_time, timezone,
    meeting_provider, meeting_link, location, status, source_meeting_id
  ) VALUES (
    v_meeting.class_id,
    v_meeting.title,
    v_meeting.description,
    p_meeting_date,
    p_start_time,
    p_end_time,
    COALESCE(NULLIF(trim(coalesce(p_timezone, '')), ''), v_meeting.timezone),
    COALESCE(NULLIF(trim(coalesce(p_meeting_provider, '')), ''), v_meeting.meeting_provider),
    COALESCE(NULLIF(trim(coalesce(p_meeting_link, '')), ''), v_meeting.meeting_link),
    COALESCE(NULLIF(trim(coalesce(p_location, '')), ''), v_meeting.location),
    'scheduled',
    v_meeting.id
  )
  RETURNING id INTO v_new_id;

  UPDATE public.group_reschedule_requests
  SET status                 = 'resolved',
      replacement_meeting_id = v_new_id,
      teacher_note           = NULLIF(trim(coalesce(p_teacher_note, '')), '')
  WHERE id = p_group_request_id;

  UPDATE public.class_meetings SET status = 'cancelled' WHERE id = v_req.meeting_id;

  FOR v_student_id IN
    SELECT student_id FROM public.class_members WHERE class_id = v_meeting.class_id
  LOOP
    PERFORM public.notify_user(
      v_student_id,
      'group_rescheduled',
      'Meeting rescheduled',
      COALESCE(v_meeting.title, 'A meeting') || ' has been rescheduled to ' ||
        to_char(p_meeting_date, 'FMMonth FMDD, YYYY') || '.',
      '/schedule'
    );
  END LOOP;

  RETURN v_new_id;
END;
$$;
