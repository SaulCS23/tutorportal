-- ============================================================
-- Migration: meeting_cancellation_policy — individual makeup
--             requests and majority-based group reschedule.
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Assumptions:
--   public.class_meetings             exists (from 20240113)
--   public.class_members              exists (from 20240102, hard-delete
--                                      only — "active enrolled count" is
--                                      always a live COUNT(*), no soft-
--                                      delete flag exists or is needed)
--   public.classes                    exists (from 20240102)
--   public.profiles                   exists (from 20240101)
--   public.is_class_teacher(uuid)     exists (from 20240107)
--   public.is_enrolled_in_class(uuid) exists (from 20240106)
--   public.touch_updated_at()         exists (from 20240107/20240108)
--
-- Product model:
--   One student cancelling attendance never changes the original
--   class_meetings row — only that student's own participation record
--   changes, and (if the meeting is still >= 24h away) a request for a
--   separately-priced individual makeup lesson is opened. Only when a
--   MAJORITY of the class's currently enrolled students request
--   cancellation for the SAME meeting does the meeting itself move to
--   'group_pending_reschedule' — at which point every still-pending
--   individual request for that meeting is superseded (closed, kept for
--   history, never actionable again) and the teacher resolves the group
--   reschedule directly, in one action that creates and links the
--   replacement meeting.
--
-- Every write to the four new tables below happens through a SECURITY
-- DEFINER function — none of them has an INSERT/UPDATE/DELETE grant to
-- "authenticated". This is a stronger guarantee than an RLS predicate:
-- a student (or teacher) simply has no code path that reaches
-- student_id, meeting_id, charge_status, pricing_type, or any
-- teacher-controlled status column directly.
-- ============================================================

-- ── class_meetings: additive columns, extended status, updated RLS ──

ALTER TABLE public.class_meetings
  ADD COLUMN IF NOT EXISTS restricted_to_student_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS source_meeting_id        uuid REFERENCES public.class_meetings(id) ON DELETE SET NULL;

-- restricted_to_student_id: NULL (every existing meeting) means "visible
-- to the whole class", exactly as today. Set only on an auto-created
-- individual makeup lesson, narrowing visibility to that one student.
-- source_meeting_id: "this meeting exists because of that other meeting"
-- — used by both an individual makeup lesson and a teacher-resolved
-- group replacement. Self-referencing, ON DELETE SET NULL: history is
-- never lost even in the hypothetical case the source row went away.

CREATE INDEX IF NOT EXISTS class_meetings_restricted_to_student_id_idx
  ON public.class_meetings(restricted_to_student_id)
  WHERE restricted_to_student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS class_meetings_source_meeting_id_idx
  ON public.class_meetings(source_meeting_id)
  WHERE source_meeting_id IS NOT NULL;

ALTER TABLE public.class_meetings
  DROP CONSTRAINT class_meetings_status_values;

ALTER TABLE public.class_meetings
  ADD CONSTRAINT class_meetings_status_values
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'group_pending_reschedule'));

-- Replace (not edit — this is a new migration) the student SELECT policy
-- so a meeting restricted to one student is invisible to the rest of the
-- class. Every existing row has restricted_to_student_id IS NULL, so
-- this is a no-op for all current data.
DROP POLICY IF EXISTS "Students can read enrolled class meetings" ON public.class_meetings;

CREATE POLICY "Students can read enrolled class meetings"
  ON public.class_meetings FOR SELECT TO authenticated
  USING (
    public.is_enrolled_in_class(class_id)
    AND (restricted_to_student_id IS NULL OR restricted_to_student_id = auth.uid())
  );

-- ── student_meeting_participation ───────────────────────────────
--
-- One row per (meeting, student), created only when a student actually
-- submits an eligible cancellation — no row means normal attendance, so
-- this table never grows for the common case of nothing unusual
-- happening. Not attendance tracking (out of scope) — this is the
-- pricing/billing-relevant state for a student's relationship to one
-- specific meeting.

CREATE TABLE public.student_meeting_participation (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id                 uuid        NOT NULL REFERENCES public.class_meetings(id) ON DELETE CASCADE,
  student_id                 uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,

  attendance_status          text        NOT NULL,
  cancellation_requested_at  timestamptz NOT NULL DEFAULT now(),
  cancellation_policy_result text        NOT NULL,
  -- Nullable until a makeup is actually approved — the pricing/payment
  -- hook this table exists for; no billing logic reads it yet.
  pricing_type                text,
  charge_status                text       NOT NULL DEFAULT 'pending',

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT student_meeting_participation_unique UNIQUE (meeting_id, student_id),
  CONSTRAINT student_meeting_participation_attendance_status_values CHECK (
    attendance_status IN (
      'pending_individual_makeup', 'makeup_approved', 'makeup_rejected',
      'resolved', 'superseded_by_group_reschedule'
    )
  ),
  CONSTRAINT student_meeting_participation_policy_result_values CHECK (
    cancellation_policy_result IN ('eligible', 'ineligible_within_24h')
  ),
  CONSTRAINT student_meeting_participation_pricing_type_values CHECK (
    pricing_type IS NULL OR pricing_type IN ('group', 'individual_makeup')
  ),
  CONSTRAINT student_meeting_participation_charge_status_values CHECK (
    charge_status IN ('pending', 'chargeable', 'waived')
  )
);

CREATE INDEX student_meeting_participation_meeting_id_idx ON public.student_meeting_participation(meeting_id);
CREATE INDEX student_meeting_participation_student_id_idx ON public.student_meeting_participation(student_id);

CREATE TRIGGER student_meeting_participation_updated_at
  BEFORE UPDATE ON public.student_meeting_participation
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── individual_makeup_requests ───────────────────────────────────
--
-- The negotiation record: exactly one active ("pending") request per
-- (meeting, student) at a time.

CREATE TABLE public.individual_makeup_requests (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id         uuid        NOT NULL REFERENCES public.class_meetings(id) ON DELETE CASCADE,
  student_id         uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,

  status             text        NOT NULL DEFAULT 'pending',
  reason             text,
  selected_option_id uuid,
  teacher_note       text,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT individual_makeup_requests_status_values CHECK (
    status IN ('pending', 'approved', 'rejected', 'resolved', 'superseded_by_group_reschedule')
  )
);

-- The actual "no duplicate active request" guarantee.
CREATE UNIQUE INDEX individual_makeup_requests_one_pending_idx
  ON public.individual_makeup_requests(meeting_id, student_id)
  WHERE status = 'pending';

CREATE INDEX individual_makeup_requests_meeting_id_idx ON public.individual_makeup_requests(meeting_id);
CREATE INDEX individual_makeup_requests_student_id_idx ON public.individual_makeup_requests(student_id);
CREATE INDEX individual_makeup_requests_status_idx      ON public.individual_makeup_requests(status);

CREATE TRIGGER individual_makeup_requests_updated_at
  BEFORE UPDATE ON public.individual_makeup_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Once a request leaves 'pending' it is permanently terminal — this is
-- defense-in-depth (every status transition already only happens inside
-- a SECURITY DEFINER function that checks status = 'pending' first), not
-- the only safeguard, but it means even a future bug elsewhere can never
-- resurrect a superseded/resolved/rejected request into an actionable one.
CREATE OR REPLACE FUNCTION public.enforce_makeup_request_terminal_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status <> 'pending' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'This request has already been resolved and cannot be changed again';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER individual_makeup_requests_terminal_status
  BEFORE UPDATE ON public.individual_makeup_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_makeup_request_terminal_status();

-- ── individual_makeup_options ─────────────────────────────────────
--
-- Exactly three per request — guaranteed by construction: the only way
-- these rows are ever created is inside request_individual_makeup(),
-- whose signature takes exactly three (start, end) parameter pairs.
-- There is no code path that can insert two or four.

CREATE TABLE public.individual_makeup_options (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        uuid        NOT NULL REFERENCES public.individual_makeup_requests(id) ON DELETE CASCADE,
  proposed_start_at timestamptz NOT NULL,
  proposed_end_at   timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT individual_makeup_options_time_order CHECK (proposed_end_at > proposed_start_at)
);

CREATE INDEX individual_makeup_options_request_id_idx ON public.individual_makeup_options(request_id);

-- Added after both tables exist to avoid a circular table definition.
ALTER TABLE public.individual_makeup_requests
  ADD CONSTRAINT individual_makeup_requests_selected_option_fkey
  FOREIGN KEY (selected_option_id) REFERENCES public.individual_makeup_options(id);

-- ── group_reschedule_requests ──────────────────────────────────────
--
-- One row per meeting that crosses the majority threshold. Counts are a
-- snapshot at creation time for history/display — the live majority
-- check is always a fresh count (see recheck_group_majority), never a
-- maintained counter re-read from this table.

CREATE TABLE public.group_reschedule_requests (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id              uuid        NOT NULL REFERENCES public.class_meetings(id) ON DELETE CASCADE,
  class_id                uuid        NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,

  threshold_count         integer     NOT NULL,
  eligible_student_count  integer     NOT NULL,

  status                  text        NOT NULL DEFAULT 'pending',
  teacher_note            text,
  replacement_meeting_id  uuid        REFERENCES public.class_meetings(id),

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT group_reschedule_requests_status_values CHECK (status IN ('pending', 'resolved', 'rejected')),
  CONSTRAINT group_reschedule_requests_counts_positive CHECK (threshold_count > 0 AND eligible_student_count > 0)
);

-- Only one active group-reschedule workflow per meeting at a time.
CREATE UNIQUE INDEX group_reschedule_requests_one_pending_idx
  ON public.group_reschedule_requests(meeting_id)
  WHERE status = 'pending';

CREATE INDEX group_reschedule_requests_class_id_idx ON public.group_reschedule_requests(class_id);
CREATE INDEX group_reschedule_requests_status_idx   ON public.group_reschedule_requests(status);

CREATE TRIGGER group_reschedule_requests_updated_at
  BEFORE UPDATE ON public.group_reschedule_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── SECURITY DEFINER helpers (RLS predicates) ─────────────────────

CREATE OR REPLACE FUNCTION public.is_teacher_of_meeting(p_meeting_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.class_meetings m
    JOIN   public.classes        c ON c.id = m.class_id
    WHERE  m.id         = p_meeting_id
      AND  c.teacher_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_teacher_of_meeting(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_teacher_of_meeting(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_teacher_of_makeup_request(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.individual_makeup_requests r
    JOIN   public.class_meetings             m ON m.id = r.meeting_id
    JOIN   public.classes                    c ON c.id = m.class_id
    WHERE  r.id         = p_request_id
      AND  c.teacher_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_teacher_of_makeup_request(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_teacher_of_makeup_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.owns_makeup_request(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.individual_makeup_requests
    WHERE  id = p_request_id
      AND  student_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.owns_makeup_request(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.owns_makeup_request(uuid) TO authenticated;

-- ── Plain (non-SECURITY DEFINER) timezone helpers ─────────────────
--
-- These only read class_meetings columns the caller can already see
-- under its own existing RLS, so no elevated privilege is needed —
-- they run as the invoker, and simply return no row for an
-- unauthorized meeting id.

CREATE OR REPLACE FUNCTION public.meeting_starts_at(p_meeting_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (m.meeting_date + m.start_time)
           AT TIME ZONE COALESCE(NULLIF(m.timezone, ''), 'America/Panama')
  FROM public.class_meetings m
  WHERE m.id = p_meeting_id;
$$;

REVOKE EXECUTE ON FUNCTION public.meeting_starts_at(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.meeting_starts_at(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.meeting_ends_at(p_meeting_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (m.meeting_date + m.end_time)
           AT TIME ZONE COALESCE(NULLIF(m.timezone, ''), 'America/Panama')
  FROM public.class_meetings m
  WHERE m.id = p_meeting_id;
$$;

REVOKE EXECUTE ON FUNCTION public.meeting_ends_at(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.meeting_ends_at(uuid) TO authenticated;

-- public.meeting_cancellation_eligibility(meeting_id)
--
-- Directly client-callable (e.g. from the Schedule-page modal the
-- instant it opens) — the exact-instant 24h cutoff check, computed once
-- in SQL so the browser never re-derives timezone math itself, only
-- formats the returned timestamptz for display in the meeting's own
-- timezone. "Exactly 24 hours before" counts as eligible (>=, not >).

CREATE OR REPLACE FUNCTION public.meeting_cancellation_eligibility(p_meeting_id uuid)
RETURNS TABLE (eligible boolean, cutoff_at timestamptz, meeting_starts_at timestamptz)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (public.meeting_starts_at(p_meeting_id) - now()) >= interval '24 hours',
    public.meeting_starts_at(p_meeting_id) - interval '24 hours',
    public.meeting_starts_at(p_meeting_id);
$$;

REVOKE EXECUTE ON FUNCTION public.meeting_cancellation_eligibility(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.meeting_cancellation_eligibility(uuid) TO authenticated;

-- ── Participation sync trigger ─────────────────────────────────────
--
-- SECURITY DEFINER: individual_makeup_requests has no UPDATE grant for
-- anyone (see grants below) — every status change flows through the
-- SECURITY DEFINER functions further down, so this trigger always runs
-- with the elevated privilege it needs to write
-- student_meeting_participation regardless of which function fired it.

CREATE OR REPLACE FUNCTION public.sync_participation_on_request_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.student_meeting_participation
    SET attendance_status = CASE NEW.status
          WHEN 'approved'                        THEN 'makeup_approved'
          WHEN 'rejected'                         THEN 'makeup_rejected'
          WHEN 'resolved'                         THEN 'resolved'
          WHEN 'superseded_by_group_reschedule'   THEN 'superseded_by_group_reschedule'
          ELSE attendance_status
        END,
        updated_at = now()
    WHERE meeting_id = NEW.meeting_id
      AND student_id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER individual_makeup_requests_sync_participation
  AFTER UPDATE ON public.individual_makeup_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_participation_on_request_status_change();

-- ── recheck_group_majority(meeting_id) — private, no grants ─────────
--
-- Not callable directly by anyone (no EXECUTE grant to public/anon/
-- authenticated) — only invoked from inside request_individual_makeup(),
-- which already runs as the owner, so the call succeeds regardless.
--
-- Race safety: locks the meeting row (FOR UPDATE) before counting, so
-- concurrent submissions for the SAME meeting are serialized — whichever
-- call's count crosses the threshold is guaranteed to see every prior
-- commit. The partial unique index on group_reschedule_requests(meeting_id)
-- WHERE status='pending' is a second safety net against ever
-- double-creating the row.

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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recheck_group_majority(uuid) FROM public, anon, authenticated;

-- ── request_individual_makeup — the one student-facing write ───────

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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the meeting row for the duration of this check+insert — the
  -- same technique recheck_group_majority uses — so a concurrent
  -- request for the same meeting can't race past the pending-request
  -- check below.
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

  -- Each option: after the original meeting ends, within 7 days of the
  -- original meeting's start, and (since class_meetings stores a single
  -- meeting_date + separate start/end times) not spanning midnight.
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

  PERFORM public.recheck_group_majority(p_meeting_id);

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_individual_makeup(
  uuid, text, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz
) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.request_individual_makeup(
  uuid, text, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz
) TO authenticated;

-- ── approve_makeup_option — teacher approves ONE of the 3 options ───
--
-- No custom/free-text time is ever accepted here — p_option_id must
-- reference one of the exact three rows already attached to the
-- request. Approving atomically creates the replacement meeting,
-- restricted to that one student, linked back via source_meeting_id.

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

  RETURN v_new_meeting_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_makeup_option(uuid, uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.approve_makeup_option(uuid, uuid, text) TO authenticated;

-- ── reject_makeup_request ────────────────────────────────────────
--
-- If none of the three options work, the teacher rejects; the student
-- can submit a brand new request afterward (same validated path as any
-- first-time request — no special case, no reopening old data).

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
  v_request public.individual_makeup_requests%ROWTYPE;
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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_makeup_request(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.reject_makeup_request(uuid, text) TO authenticated;

-- ── reject_group_reschedule ──────────────────────────────────────
--
-- Reverts the meeting to 'scheduled'. Superseded individual requests
-- are deliberately NOT reopened (see migration-plan discussion): the
-- three proposed times each held may now be stale or outside the
-- 7-day window anchored to the (unchanged) original meeting time.
-- Students who still need a makeup submit a fresh request through the
-- normal path — if the meeting is still >= 24h out, it succeeds
-- immediately; if time has since slipped inside 24h, it doesn't, which
-- is just the ordinary policy, not a special case.

CREATE OR REPLACE FUNCTION public.reject_group_reschedule(
  p_group_request_id uuid,
  p_teacher_note      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.group_reschedule_requests%ROWTYPE;
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

  UPDATE public.class_meetings SET status = 'scheduled' WHERE id = v_req.meeting_id;

  UPDATE public.group_reschedule_requests
  SET status       = 'rejected',
      teacher_note = NULLIF(trim(coalesce(p_teacher_note, '')), '')
  WHERE id = p_group_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_group_reschedule(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.reject_group_reschedule(uuid, text) TO authenticated;

-- ── resolve_group_reschedule — single-action "Reschedule Group" ────
--
-- One click, one form, one atomic result: creates the replacement
-- class_meetings row directly (no separate "create a normal meeting,
-- then come back and link it" step — CreateMeetingForm is not involved
-- and is not modified), links it, marks the group request resolved,
-- and marks the original meeting 'cancelled' (its own slot will not
-- happen; the replacement is the new scheduled session, linked via
-- source_meeting_id for history).

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
  v_req     public.group_reschedule_requests%ROWTYPE;
  v_meeting public.class_meetings%ROWTYPE;
  v_new_id  uuid;
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

  RETURN v_new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_group_reschedule(
  uuid, date, time, time, text, text, text, text, text
) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.resolve_group_reschedule(
  uuid, date, time, time, text, text, text, text, text
) TO authenticated;

-- ── RLS ────────────────────────────────────────────────────────────
-- All four new tables: SELECT-only grants. Every write happens through
-- the SECURITY DEFINER functions above, which bypass RLS and the grant
-- system entirely (they run as the function owner) — so no
-- INSERT/UPDATE/DELETE policy or grant is needed, or given, to anyone.

ALTER TABLE public.student_meeting_participation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read own meeting participation"
  ON public.student_meeting_participation FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can read class meeting participation"
  ON public.student_meeting_participation FOR SELECT TO authenticated
  USING (public.is_teacher_of_meeting(meeting_id));

GRANT SELECT ON public.student_meeting_participation TO authenticated;

ALTER TABLE public.individual_makeup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read own makeup requests"
  ON public.individual_makeup_requests FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can read class makeup requests"
  ON public.individual_makeup_requests FOR SELECT TO authenticated
  USING (public.is_teacher_of_meeting(meeting_id));

GRANT SELECT ON public.individual_makeup_requests TO authenticated;

ALTER TABLE public.individual_makeup_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read own makeup options"
  ON public.individual_makeup_options FOR SELECT TO authenticated
  USING (public.owns_makeup_request(request_id));

CREATE POLICY "Teachers can read class makeup options"
  ON public.individual_makeup_options FOR SELECT TO authenticated
  USING (public.is_teacher_of_makeup_request(request_id));

GRANT SELECT ON public.individual_makeup_options TO authenticated;

ALTER TABLE public.group_reschedule_requests ENABLE ROW LEVEL SECURITY;

-- Teacher-only for this phase — not required by the student-facing
-- spec; the original meeting's own status (already visible to students
-- via existing class_meetings RLS) is how students see "this is
-- pending reschedule."
CREATE POLICY "Teachers can read own class group reschedule requests"
  ON public.group_reschedule_requests FOR SELECT TO authenticated
  USING (public.is_class_teacher(class_id));

GRANT SELECT ON public.group_reschedule_requests TO authenticated;
