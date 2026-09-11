-- ============================================================
-- Migration: release_class — the complement to take_class, letting
--             the currently responsible teacher give a class back to
--             "Unassigned" so another teacher can take it.
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Mirrors take_class (20240122000000_shared_teacher_schedule.sql)
-- exactly: SECURITY DEFINER, is_teacher()-gated, row-locked (FOR UPDATE)
-- so a release can't race with a concurrent take/release on the same
-- row. Ownership itself is still stored on classes.teacher_id — this
-- does not introduce a second place ownership lives.
--
-- Security: only the class's own responsible teacher may release it.
-- Another teacher calling this on someone else's class fails the
-- ownership check below; a student fails is_teacher(). Nothing about
-- this is enforced only in the UI.
--
-- Assumptions:
--   public.classes     exists (from 20240102), teacher_id nullable (from 20240122)
--   public.is_teacher() exists (from 20240122)
-- ============================================================

CREATE OR REPLACE FUNCTION public.release_class(p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Only teachers can release a class';
  END IF;

  SELECT teacher_id INTO v_teacher_id
  FROM public.classes
  WHERE id = p_class_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'This class is already unassigned';
  END IF;

  IF v_teacher_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the responsible teacher can release this class';
  END IF;

  UPDATE public.classes
  SET teacher_id = NULL, updated_at = now()
  WHERE id = p_class_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_class(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.release_class(uuid) TO authenticated;
