-- ============================================================
-- Migration: classes improvements — description, start_date,
--            create_class_with_schedule RPC
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Assumptions:
--   public.classes              exists (from 20240102)
--   public.class_schedules      exists (from 20240108)
--   public.profiles             exists (from 20240101)
--   public.set_class_join_code() trigger exists (from 20240102)
--   public.touch_updated_at()   exists (from 20240107)
-- ============================================================

-- ── New columns on classes ────────────────────────────────────

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS start_date  date;

-- ── RPC: create_class_with_schedule ──────────────────────────
--
-- Creates a class and optionally its first Google Meet schedule
-- entry in a single transaction. If either INSERT fails, the
-- whole operation rolls back — no partial state.
--
-- Parameters:
--   p_day_of_week / p_start_time / p_end_time — pass NULL to
--   skip the schedule INSERT and create the class alone.
--
-- Returns JSON: { "class_id": uuid, "join_code": text }

CREATE OR REPLACE FUNCTION public.create_class_with_schedule(
  p_name             text,
  p_subject          text,
  p_description      text,
  p_start_date       date,
  p_day_of_week      integer,
  p_start_time       time,
  p_end_time         time,
  p_timezone         text,
  p_meeting_link     text,
  p_meeting_id       text,
  p_meeting_passcode text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id  uuid;
  v_join_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF trim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Class name is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE  id = auth.uid() AND role = 'teacher'
  ) THEN
    RAISE EXCEPTION 'Only teachers can create classes';
  END IF;

  -- Insert class — join_code is auto-set by before_insert_set_class_code trigger
  INSERT INTO public.classes (name, subject, description, start_date, teacher_id)
  VALUES (
    trim(p_name),
    nullif(trim(coalesce(p_subject,      '')), ''),
    nullif(trim(coalesce(p_description,  '')), ''),
    p_start_date,
    auth.uid()
  )
  RETURNING id, join_code INTO v_class_id, v_join_code;

  -- Insert schedule only when all required fields are supplied
  IF p_day_of_week IS NOT NULL
     AND p_start_time IS NOT NULL
     AND p_end_time   IS NOT NULL
  THEN
    INSERT INTO public.class_schedules (
      class_id,
      day_of_week,
      start_time,
      end_time,
      timezone,
      meeting_provider,
      meeting_link,
      meeting_id,
      meeting_passcode
    ) VALUES (
      v_class_id,
      p_day_of_week,
      p_start_time,
      p_end_time,
      coalesce(nullif(trim(coalesce(p_timezone, '')), ''), 'America/Panama'),
      'Google Meet',
      nullif(trim(coalesce(p_meeting_link,     '')), ''),
      nullif(trim(coalesce(p_meeting_id,       '')), ''),
      nullif(trim(coalesce(p_meeting_passcode, '')), '')
    );
  END IF;

  RETURN json_build_object(
    'class_id',  v_class_id,
    'join_code', v_join_code
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_class_with_schedule(
  text, text, text, date, integer, time, time, text, text, text, text
) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.create_class_with_schedule(
  text, text, text, date, integer, time, time, text, text, text, text
) TO authenticated;
