-- ============================================================
-- Migration: profiles.timezone — the viewer's saved IANA timezone,
--             plus the corrected attendance boundary rule in
--             record_meeting_join.
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Assumptions:
--   public.profiles              exists (from 20240101, extended 20240105)
--   public.class_meetings        exists (from 20240113/20240114)
--   public.class_meeting_attendance exists (from 20240118)
--   public.meeting_starts_at()   exists (from 20240114)
--   public.meeting_ends_at()     exists (from 20240114)
--   public.is_enrolled_in_class() exists (from 20240106)
--
-- Product model: nullable, not defaulted to 'America/Panama' — NULL is a
-- distinct, meaningful state ("never detected/set yet"), which is what
-- lets set_own_timezone_if_unset() below tell "no timezone yet" apart
-- from "user is actually in America/Panama". Every read path falls back
-- to America/Panama (the app's existing default business timezone) only
-- when this column is NULL — see lib/timezone.ts#resolveTimeZone.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text;

-- ── is_valid_timezone — the one place an IANA name is checked ──────
--
-- Postgres (like the ICU/tzdata the rest of the stack uses) understands
-- real IANA zone names natively via `AT TIME ZONE` — asking it to
-- resolve the name and catching the exception on an unrecognized one is
-- the standard, non-guessing way to validate a zone name in SQL; no
-- hardcoded list to keep in sync.

CREATE OR REPLACE FUNCTION public.is_valid_timezone(p_timezone text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_probe timestamptz;
BEGIN
  IF trim(coalesce(p_timezone, '')) = '' THEN
    RETURN false;
  END IF;

  BEGIN
    v_probe := now() AT TIME ZONE p_timezone;
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_valid_timezone(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_valid_timezone(text) TO authenticated;

-- ── update_own_timezone — explicit user choice, always wins ────────
--
-- The Account-page "change timezone" action. Same self-scoped,
-- SECURITY DEFINER, auth.uid()-only pattern as update_own_name
-- (20240105) and update_own_full_name (20240101).

CREATE OR REPLACE FUNCTION public.update_own_timezone(p_timezone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_valid_timezone(p_timezone) THEN
    RAISE EXCEPTION 'Not a recognized timezone: %', p_timezone;
  END IF;

  UPDATE public.profiles
  SET timezone   = p_timezone,
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_own_timezone(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.update_own_timezone(text) TO authenticated;

-- ── set_own_timezone_if_unset — first-use auto-detect only ─────────
--
-- Called once from the client the first time a session finds
-- profiles.timezone IS NULL, with the browser's own
-- Intl.DateTimeFormat().resolvedOptions().timeZone. The WHERE clause is
-- the entire "never overwrite a manual choice" guarantee: once any value
-- is present (auto-detected or manually chosen), this is permanently a
-- no-op for that user — only update_own_timezone can change it again.
-- Silently no-ops on an invalid/empty detection (never surfaces an
-- error for a background call the user didn't initiate).

CREATE OR REPLACE FUNCTION public.set_own_timezone_if_unset(p_timezone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_valid_timezone(p_timezone) THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET timezone   = p_timezone,
      updated_at = now()
  WHERE id = auth.uid()
    AND timezone IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_own_timezone_if_unset(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.set_own_timezone_if_unset(text) TO authenticated;

-- ── record_meeting_join — corrected present/late/absent boundary ───
--
-- Bug fixed: the 20240118 version only ever chose between 'present' and
-- 'late' (`now() < start + 10min ? present : late`), with no upper
-- bound — a join recorded well after the meeting had already ended was
-- incorrectly stored as 'late' forever. Corrected to the exact three-way
-- rule: present up to and including start+10min, late from there through
-- the meeting's end (inclusive), absent after the end. Everything else
-- (first-join-wins on joined_at, override always wins) is unchanged from
-- 20240118 — this is CREATE OR REPLACE on the same signature, so every
-- existing grant stays intact.

CREATE OR REPLACE FUNCTION public.record_meeting_join(p_meeting_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting   public.class_meetings%ROWTYPE;
  v_starts_at timestamptz;
  v_ends_at   timestamptz;
  v_joined_at timestamptz := now();
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
  v_ends_at   := public.meeting_ends_at(p_meeting_id);

  v_computed := CASE
    WHEN v_joined_at <= v_starts_at + interval '10 minutes' THEN 'present'
    WHEN v_joined_at <= v_ends_at                            THEN 'late'
    ELSE 'absent'
  END;

  INSERT INTO public.class_meeting_attendance (meeting_id, student_id, attendance_status, joined_at)
  VALUES (p_meeting_id, auth.uid(), v_computed, v_joined_at)
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
