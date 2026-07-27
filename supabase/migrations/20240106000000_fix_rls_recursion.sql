-- ============================================================
-- Migration: fix RLS infinite recursion (PostgreSQL error 42P17)
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Root cause: three interlocking RLS cycles triggered whenever any
-- code queries public.profiles.
--
-- Cycle A — direct self-recursion on class_members:
--   "Students can read members of enrolled classes" contains
--   a subquery against the same table (public.class_members).
--   PostgreSQL re-enters RLS for class_members → 42P17.
--
-- Cycle B — mutual recursion between class_members and classes:
--   class_members policy "Teachers can read members of own classes"
--     → queries public.classes (RLS applied)
--       → classes policy "Enrolled students can read joined classes"
--           → queries public.class_members (RLS applied)
--               → re-enters class_members policies → 42P17.
--
-- Cycle C — broken visibility after fixing Cycle A:
--   Replacing "Students can read members of enrolled classes" with
--   student_id = auth.uid() means the profiles policy
--   "Teachers can read profiles of their students" can no longer see
--   class_members rows belonging to other users — teachers lose access
--   to student profiles.
--
-- Fix strategy:
--   1. Break Cycle A: replace the self-referential class_members policy
--      with student_id = auth.uid().
--   2. Break Cycle B: replace "Enrolled students can read joined classes"
--      with a SECURITY DEFINER helper that queries class_members as the
--      function owner (superuser), bypassing RLS and breaking the cycle.
--   3. Fix Cycle C: replace "Teachers can read profiles of their students"
--      with a SECURITY DEFINER helper that reads class_members as superuser
--      so it can see any student's memberships regardless of the new RLS.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- STEP 1: SECURITY DEFINER helpers
--
-- Both functions run as the DB owner (superuser in Supabase) and
-- therefore bypass RLS on public.class_members, breaking every cycle.
-- They only expose results gated on auth.uid(), so no security
-- is weakened — a user can only learn about their own relationships.
-- ──────────────────────────────────────────────────────────────

-- Returns TRUE if the current user (auth.uid()) is enrolled in p_class_id.
-- Used by: "Enrolled students can read joined classes" on public.classes.
CREATE OR REPLACE FUNCTION public.is_enrolled_in_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members
    WHERE class_id = p_class_id
      AND student_id = auth.uid()
  );
$$;

-- Returns TRUE if any class owned by the current user (auth.uid() = teacher)
-- has p_student_id as an enrolled student.
-- Used by: "Teachers can read profiles of their students" on public.profiles.
CREATE OR REPLACE FUNCTION public.teacher_has_student_in_class(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_members cm
    JOIN public.classes c ON c.id = cm.class_id
    WHERE cm.student_id = p_student_id
      AND c.teacher_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_enrolled_in_class(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_enrolled_in_class(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teacher_has_student_in_class(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.teacher_has_student_in_class(uuid) TO authenticated;


-- ──────────────────────────────────────────────────────────────
-- STEP 2: Fix Cycle A — remove direct self-recursion on class_members
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Students can read members of enrolled classes" ON public.class_members;

-- A student can only read their own membership rows.
-- The student-facing UI never needs to see other students' rows
-- (member counts are shown to the teacher only, via the SECURITY DEFINER RPC).
CREATE POLICY "Students can read own memberships"
  ON public.class_members FOR SELECT TO authenticated
  USING (student_id = auth.uid());


-- ──────────────────────────────────────────────────────────────
-- STEP 3: Fix Cycle B — remove mutual recursion between classes and class_members
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Enrolled students can read joined classes" ON public.classes;

-- Delegates the class_members lookup to the SECURITY DEFINER helper,
-- which queries class_members as superuser and never re-enters RLS.
CREATE POLICY "Enrolled students can read joined classes"
  ON public.classes FOR SELECT TO authenticated
  USING (public.is_enrolled_in_class(id));


-- ──────────────────────────────────────────────────────────────
-- STEP 4: Fix Cycle C — restore teacher visibility of student profiles
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Teachers can read profiles of their students" ON public.profiles;

-- Delegates the cross-table check to the SECURITY DEFINER helper,
-- which can read any student's class_members row regardless of the
-- student_id = auth.uid() restriction on the main class_members RLS.
CREATE POLICY "Teachers can read profiles of their students"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.teacher_has_student_in_class(id));


-- ──────────────────────────────────────────────────────────────
-- "Students can read profiles of class teachers" (unchanged)
--
-- After the fixes above this policy is safe:
--   • It queries class_members WHERE cm.student_id = auth.uid(),
--     which is exactly what the new RLS allows.
--   • "Teachers can read members of own classes" → queries classes
--     → "Enrolled students can read joined classes" calls
--     is_enrolled_in_class() (SECURITY DEFINER) → no RLS re-entry. ✓
-- ──────────────────────────────────────────────────────────────
