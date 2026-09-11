-- ============================================================
-- Migration: teacher_access_requests — secure student → teacher
--             promotion workflow.
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Security model:
--   Role escalation must be impossible from the client. profiles has no
--   client-facing UPDATE grant on the role column (see 20240101 — role
--   changes were already blocked at the database level for every user).
--   This migration adds the only two paths that can ever set
--   profiles.role = 'teacher':
--     1. approve_teacher_access_request — admin approves a pending
--        request submitted by the student themselves.
--     2. admin_grant_teacher_role — admin promotes an existing account
--        directly (e.g. a user who predates this workflow), recorded in
--        the same audit table for a consistent history.
--   Both are SECURITY DEFINER functions gated by is_admin(), which checks
--   the caller's real auth.users.email — not a client-supplied value, not
--   profiles.role, and not hidden UI. A student can never call these
--   successfully because is_admin() will always evaluate false for them.
--
-- Assumptions:
--   public.profiles          exists (from 20240101)
--   public.notify_user(...)  exists (from 20240115, no grants — callable
--                              only from SECURITY DEFINER function bodies)
-- ============================================================

-- ── is_admin: single source of truth for admin authorization ───────
--
-- Checks the caller's verified auth.users.email, not any client-supplied
-- or profile-stored value. Used to gate every admin-only RPC below.
-- The admin email is hardcoded here (single administrator, per current
-- requirements) — changing it requires a new migration, consistent with
-- this project's "migrations are immutable, never silently change
-- schemas" rule.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND lower(email) = 'saulassis2310@gmail.com'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ── teacher_access_requests ─────────────────────────────────────────

CREATE TABLE public.teacher_access_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  message       text,

  status        text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected')),

  created_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid        REFERENCES public.profiles(id),
  reviewer_note text
);

-- Only one open request per user at a time. A rejected (or, briefly,
-- approved) request does not block a fresh one — the index only applies
-- while status = 'pending'.
CREATE UNIQUE INDEX teacher_access_requests_one_pending_idx
  ON public.teacher_access_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX teacher_access_requests_user_id_created_at_idx
  ON public.teacher_access_requests (user_id, created_at DESC);

ALTER TABLE public.teacher_access_requests ENABLE ROW LEVEL SECURITY;

-- A user can read their own requests (drives the "pending" / "rejected"
-- state shown on their Account page). Admin reads happen exclusively
-- through list_teacher_access_requests() below, which can also resolve
-- the requester's email (not visible to RLS/PostgREST via auth.users).
CREATE POLICY "Users can read own teacher access requests"
  ON public.teacher_access_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE grant to anyone. Every write goes through a
-- SECURITY DEFINER RPC below, mirroring the notifications table pattern.
GRANT SELECT ON public.teacher_access_requests TO authenticated;

-- ── Extend the notification type vocabulary ─────────────────────────

ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_type_values;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_values CHECK (
    type IN (
      'makeup_requested', 'group_pending_reschedule',
      'makeup_approved', 'makeup_rejected', 'group_rescheduled',
      'homework_assigned', 'homework_submitted', 'homework_graded',
      'teacher_access_requested', 'teacher_access_approved', 'teacher_access_rejected'
    )
  );

-- ── request_teacher_access: student submits a request ───────────────
--
-- Leaves profiles.role untouched. Notifies the admin (if their account
-- exists) via the in-site notifications system.

CREATE OR REPLACE FUNCTION public.request_teacher_access(p_message text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role       text;
  v_request_id uuid;
  v_admin_id   uuid;
  v_name       text;
  v_email      text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_role = 'teacher' THEN
    RAISE EXCEPTION 'You already have teacher access';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.teacher_access_requests
    WHERE user_id = auth.uid() AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending teacher access request';
  END IF;

  INSERT INTO public.teacher_access_requests (user_id, message)
  VALUES (auth.uid(), NULLIF(trim(coalesce(p_message, '')), ''))
  RETURNING id INTO v_request_id;

  SELECT full_name INTO v_name  FROM public.profiles WHERE id = auth.uid();
  SELECT email     INTO v_email FROM auth.users       WHERE id = auth.uid();

  SELECT id INTO v_admin_id FROM auth.users WHERE lower(email) = 'saulassis2310@gmail.com';

  PERFORM public.notify_user(
    v_admin_id,
    'teacher_access_requested',
    'New teacher access request',
    COALESCE(v_name, 'A user') || ' (' || COALESCE(v_email, 'unknown email') || ') requested teacher access.',
    '/admin/teacher-requests'
  );

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_teacher_access(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.request_teacher_access(text) TO authenticated;

-- ── list_teacher_access_requests: admin-only read with requester email ──
--
-- SECURITY DEFINER so it can read auth.users.email (not exposed by RLS)
-- and every user's requests, gated entirely by is_admin(). Same pattern
-- as get_class_students (20240104).

CREATE OR REPLACE FUNCTION public.list_teacher_access_requests()
RETURNS TABLE (
  id            uuid,
  user_id       uuid,
  full_name     text,
  email         text,
  message       text,
  status        text,
  created_at    timestamptz,
  reviewed_at   timestamptz,
  reviewed_by   uuid,
  reviewer_name text,
  reviewer_note text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    p.full_name,
    u.email::text,
    r.message,
    r.status,
    r.created_at,
    r.reviewed_at,
    r.reviewed_by,
    rp.full_name AS reviewer_name,
    r.reviewer_note
  FROM public.teacher_access_requests r
  JOIN public.profiles p  ON p.id = r.user_id
  JOIN auth.users       u ON u.id = r.user_id
  LEFT JOIN public.profiles rp ON rp.id = r.reviewed_by
  ORDER BY
    (r.status = 'pending') DESC,
    r.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_teacher_access_requests() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.list_teacher_access_requests() TO authenticated;

-- ── approve_teacher_access_request: the only student→teacher path ──
--
-- Admin-only (is_admin()). Promotes the requester to teacher, marks the
-- request approved with an audit trail, and notifies the student.

CREATE OR REPLACE FUNCTION public.approve_teacher_access_request(
  p_request_id uuid,
  p_note       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.teacher_access_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_request
  FROM public.teacher_access_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This request is no longer pending';
  END IF;

  UPDATE public.profiles
  SET role = 'teacher', updated_at = now()
  WHERE id = v_request.user_id;

  UPDATE public.teacher_access_requests
  SET status        = 'approved',
      reviewed_at   = now(),
      reviewed_by   = auth.uid(),
      reviewer_note = NULLIF(trim(coalesce(p_note, '')), '')
  WHERE id = p_request_id;

  PERFORM public.notify_user(
    v_request.user_id,
    'teacher_access_approved',
    'Teacher access approved',
    'Your request for teacher access was approved. Teacher features are now available.',
    '/account'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_teacher_access_request(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.approve_teacher_access_request(uuid, text) TO authenticated;

-- ── reject_teacher_access_request ───────────────────────────────────
--
-- Admin-only. Role is never touched — the student stays a student.

CREATE OR REPLACE FUNCTION public.reject_teacher_access_request(
  p_request_id uuid,
  p_note       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.teacher_access_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_request
  FROM public.teacher_access_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This request is no longer pending';
  END IF;

  UPDATE public.teacher_access_requests
  SET status        = 'rejected',
      reviewed_at   = now(),
      reviewed_by   = auth.uid(),
      reviewer_note = NULLIF(trim(coalesce(p_note, '')), '')
  WHERE id = p_request_id;

  PERFORM public.notify_user(
    v_request.user_id,
    'teacher_access_rejected',
    'Teacher access request rejected',
    'Your request for teacher access was not approved.',
    '/account'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_teacher_access_request(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.reject_teacher_access_request(uuid, text) TO authenticated;

-- ── admin_find_user_by_email: look up an existing account by email ──
--
-- Admin-only. Lets the admin unambiguously identify an existing user
-- (e.g. a pre-existing account that should become a teacher) by the one
-- identifier that is guaranteed unique — email — rather than by
-- display name, which is never unique.

CREATE OR REPLACE FUNCTION public.admin_find_user_by_email(p_email text)
RETURNS TABLE (
  user_id    uuid,
  full_name  text,
  email      text,
  role       text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, u.email::text, p.role, p.created_at
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(trim(p_email));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_find_user_by_email(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.admin_find_user_by_email(text) TO authenticated;

-- ── admin_grant_teacher_role: direct promotion for existing accounts ──
--
-- Admin-only. For accounts that predate this workflow (no request to
-- approve). Still recorded in teacher_access_requests, pre-approved, so
-- every teacher promotion — request-driven or admin-initiated — has the
-- same audit trail.

CREATE OR REPLACE FUNCTION public.admin_grant_teacher_role(
  p_user_id uuid,
  p_note    text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role       text;
  v_request_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_role = 'teacher' THEN
    RAISE EXCEPTION 'User already has teacher access';
  END IF;

  UPDATE public.profiles
  SET role = 'teacher', updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.teacher_access_requests (
    user_id, message, status, reviewed_at, reviewed_by, reviewer_note
  ) VALUES (
    p_user_id,
    'Granted directly by admin (pre-existing account).',
    'approved',
    now(),
    auth.uid(),
    NULLIF(trim(coalesce(p_note, '')), '')
  )
  RETURNING id INTO v_request_id;

  PERFORM public.notify_user(
    p_user_id,
    'teacher_access_approved',
    'Teacher access approved',
    'You have been granted teacher access. Teacher features are now available.',
    '/account'
  );

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_grant_teacher_role(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.admin_grant_teacher_role(uuid, text) TO authenticated;
