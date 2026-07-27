-- ============================================================
-- Migration: assignments and announcements
-- Run once in the Supabase SQL Editor.
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

CREATE TABLE public.assignments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     uuid        NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  instructions text,
  due_at       timestamptz,
  points       integer     NOT NULL DEFAULT 0,
  status       text        NOT NULL DEFAULT 'draft',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignments_title_nonempty  CHECK (trim(title) <> ''),
  CONSTRAINT assignments_points_nonneg   CHECK (points >= 0),
  CONSTRAINT assignments_status_values   CHECK (status IN ('draft', 'published'))
);

CREATE TABLE public.announcements (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid        NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title      text        NOT NULL,
  body       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcements_title_nonempty CHECK (trim(title) <> ''),
  CONSTRAINT announcements_body_nonempty  CHECK (trim(body) <> '')
);

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX assignments_class_id_idx   ON public.assignments(class_id);
CREATE INDEX assignments_due_at_idx     ON public.assignments(due_at)
  WHERE due_at IS NOT NULL;
CREATE INDEX assignments_status_idx     ON public.assignments(class_id, status);
CREATE INDEX announcements_class_id_idx ON public.announcements(class_id);
CREATE INDEX announcements_created_idx  ON public.announcements(class_id, created_at DESC);

-- ── updated_at trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- ── SECURITY DEFINER helper ───────────────────────────────────
--
-- Checks whether auth.uid() is the teacher of a given class.
-- Runs as the function owner (superuser) so it bypasses RLS on
-- public.classes, preventing any cross-table policy recursion.
-- Only exposes data gated on auth.uid() — no security is weakened.

CREATE OR REPLACE FUNCTION public.is_class_teacher(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = p_class_id
      AND teacher_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_class_teacher(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_class_teacher(uuid) TO authenticated;

-- ── Assignments RLS policies ─────────────────────────────────
--
-- Teachers: full CRUD on assignments belonging to their own classes.
-- Students: SELECT published assignments from enrolled classes only.
--
-- Both helpers (is_class_teacher, is_enrolled_in_class) are SECURITY
-- DEFINER — they bypass RLS on classes/class_members internally,
-- so there is no recursive policy evaluation possible.

CREATE POLICY "Teachers can manage own class assignments"
  ON public.assignments FOR ALL TO authenticated
  USING    (public.is_class_teacher(class_id))
  WITH CHECK (public.is_class_teacher(class_id));

CREATE POLICY "Students can read published assignments"
  ON public.assignments FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND public.is_enrolled_in_class(class_id)
  );

-- ── Announcements RLS policies ────────────────────────────────

CREATE POLICY "Teachers can manage own class announcements"
  ON public.announcements FOR ALL TO authenticated
  USING    (public.is_class_teacher(class_id))
  WITH CHECK (public.is_class_teacher(class_id));

CREATE POLICY "Students can read class announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (public.is_enrolled_in_class(class_id));

-- ── Grants ───────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
