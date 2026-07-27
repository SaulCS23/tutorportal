-- ============================================================
-- Migration: class_schedules — weekly recurring meeting times
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Assumptions:
--   public.classes            exists
--   public.class_members      exists
--   public.is_class_teacher(uuid)   exists (from 20240107)
--   public.is_enrolled_in_class(uuid) exists (from 20240106)
--   public.touch_updated_at() likely exists (from 20240107)
--
-- Weekday convention: 0 = Sunday … 6 = Saturday
-- ============================================================

-- ── Safely create touch_updated_at if it does not exist yet ──

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ── Table ─────────────────────────────────────────────────────

CREATE TABLE public.class_schedules (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id         uuid        NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  day_of_week      integer     NOT NULL,
  start_time       time        NOT NULL,
  end_time         time        NOT NULL,
  timezone         text        NOT NULL DEFAULT 'America/Panama',
  meeting_provider text,
  meeting_link     text,
  meeting_id       text,
  meeting_passcode text,
  location         text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT schedules_day_range   CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT schedules_time_order  CHECK (end_time > start_time),
  CONSTRAINT schedules_unique_slot UNIQUE (class_id, day_of_week, start_time)
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX class_schedules_class_id_idx     ON public.class_schedules(class_id);
CREATE INDEX class_schedules_day_idx          ON public.class_schedules(day_of_week);
CREATE INDEX class_schedules_class_day_idx    ON public.class_schedules(class_id, day_of_week);
CREATE INDEX class_schedules_start_time_idx   ON public.class_schedules(start_time);

-- ── updated_at trigger ────────────────────────────────────────

CREATE TRIGGER class_schedules_updated_at
  BEFORE UPDATE ON public.class_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

-- Teachers: full management of schedules for classes they own.
-- is_class_teacher is SECURITY DEFINER — queries classes as superuser,
-- no cross-table RLS recursion.
CREATE POLICY "Teachers can manage own class schedules"
  ON public.class_schedules FOR ALL TO authenticated
  USING    (public.is_class_teacher(class_id))
  WITH CHECK (public.is_class_teacher(class_id));

-- Students: read-only for classes they are enrolled in.
-- is_enrolled_in_class is SECURITY DEFINER — queries class_members as superuser,
-- no cross-table RLS recursion.
CREATE POLICY "Students can read enrolled class schedules"
  ON public.class_schedules FOR SELECT TO authenticated
  USING (public.is_enrolled_in_class(class_id));

-- ── Grants ────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_schedules TO authenticated;
