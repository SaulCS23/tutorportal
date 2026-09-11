-- ============================================================
-- Repair / idempotent re-run for the shared teacher schedule
-- (20240122_shared_teacher_schedule.sql) and the roster/schedule
-- seed (20240123_seed_roster_and_schedule.sql).
--
-- Use this if a teacher's /schedule page shows "No classes" for the
-- whole week: the most likely cause is that 20240122 and/or 20240123
-- were never actually applied (or applied out of order — 20240123's
-- classes INSERT requires teacher_id to already be nullable, which
-- only 20240122 does; if 20240123 ran first it would have failed and
-- rolled back its entire DO block, inserting nothing at all).
--
-- Safe to run multiple times, and safe regardless of whether 20240122/
-- 20240123 partially applied, fully applied, or never ran — every
-- statement below is idempotent (CREATE OR REPLACE, DROP NOT NULL on an
-- already-nullable column, or an explicit existence/ON CONFLICT guard).
-- ============================================================

-- ── is_teacher ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_teacher() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_teacher() TO authenticated;

-- ── classes.teacher_id nullable ──────────────────────────────────

ALTER TABLE public.classes ALTER COLUMN teacher_id DROP NOT NULL;

-- ── list_master_class_schedules ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_master_class_schedules()
RETURNS TABLE (
  id               uuid,
  class_id         uuid,
  day_of_week      integer,
  start_time       time,
  end_time         time,
  timezone         text,
  meeting_provider text,
  meeting_link     text,
  location         text,
  class_name       text,
  subject          text,
  teacher_id       uuid,
  teacher_name     text,
  student_names    text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    cs.id, cs.class_id, cs.day_of_week, cs.start_time, cs.end_time,
    cs.timezone, cs.meeting_provider, cs.meeting_link, cs.location,
    c.name, c.subject, c.teacher_id, tp.full_name,
    COALESCE(
      (SELECT array_agg(sp.full_name ORDER BY sp.full_name)
       FROM public.class_members cm
       JOIN public.profiles sp ON sp.id = cm.student_id
       WHERE cm.class_id = c.id),
      '{}'::text[]
    )
  FROM public.class_schedules cs
  JOIN public.classes c       ON c.id = cs.class_id
  LEFT JOIN public.profiles tp ON tp.id = c.teacher_id
  ORDER BY cs.day_of_week, cs.start_time;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_master_class_schedules() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.list_master_class_schedules() TO authenticated;

-- ── list_master_class_meetings ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_master_class_meetings()
RETURNS TABLE (
  id               uuid,
  class_id         uuid,
  title            text,
  meeting_date     date,
  start_time       time,
  end_time         time,
  timezone         text,
  meeting_provider text,
  meeting_link     text,
  location         text,
  status           text,
  class_name       text,
  subject          text,
  teacher_id       uuid,
  teacher_name     text,
  student_names    text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    cm2.id, cm2.class_id, cm2.title, cm2.meeting_date, cm2.start_time, cm2.end_time,
    cm2.timezone, cm2.meeting_provider, cm2.meeting_link, cm2.location, cm2.status,
    c.name, c.subject, c.teacher_id, tp.full_name,
    COALESCE(
      (SELECT array_agg(sp.full_name ORDER BY sp.full_name)
       FROM public.class_members mem
       JOIN public.profiles sp ON sp.id = mem.student_id
       WHERE mem.class_id = c.id),
      '{}'::text[]
    )
  FROM public.class_meetings cm2
  JOIN public.classes c       ON c.id = cm2.class_id
  LEFT JOIN public.profiles tp ON tp.id = c.teacher_id
  ORDER BY cm2.meeting_date, cm2.start_time;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_master_class_meetings() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.list_master_class_meetings() TO authenticated;

-- ── take_class ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.take_class(p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
BEGIN
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Only teachers can take a class';
  END IF;

  SELECT teacher_id INTO v_teacher_id
  FROM public.classes
  WHERE id = p_class_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF v_teacher_id IS NOT NULL THEN
    RAISE EXCEPTION 'This class already has a responsible teacher';
  END IF;

  UPDATE public.classes
  SET teacher_id = auth.uid(), updated_at = now()
  WHERE id = p_class_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.take_class(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.take_class(uuid) TO authenticated;

-- ── Re-seed roster + schedule (guarded, safe to re-run) ─────────

DO $$
DECLARE
  v_admin_id       uuid;

  v_class_marcela  uuid;
  v_class_sat_ahp  uuid;
  v_class_jonathan uuid;
  v_class_apcalc   uuid;
  v_class_evening  uuid;
  v_class_yonatan  uuid;
  v_class_eitan    uuid;
  v_class_tommy    uuid;

  v_p_marcela   uuid;
  v_p_jonathan  uuid;
  v_p_aharon    uuid;
  v_p_joshua    uuid;
  v_p_abraham   uuid;
  v_p_joseph_t  uuid;
  v_p_jacky     uuid;
  v_p_sofia     uuid;
  v_p_tzeitel   uuid;
  v_p_yonatan   uuid;
  v_p_eitan     uuid;
  v_p_tommy     uuid;
  v_p_nate      uuid;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE lower(email) = 'saulassis2310@gmail.com';

  -- ── Classes (guarded by name — insert only if missing) ──────────

  SELECT id INTO v_class_marcela FROM public.classes WHERE name = 'Marcela Gimal';
  IF v_class_marcela IS NULL THEN
    INSERT INTO public.classes (name, teacher_id) VALUES ('Marcela Gimal', NULL) RETURNING id INTO v_class_marcela;
  END IF;

  SELECT id INTO v_class_sat_ahp FROM public.classes WHERE name = 'SAT AHP';
  IF v_class_sat_ahp IS NULL THEN
    INSERT INTO public.classes (name, teacher_id) VALUES ('SAT AHP', NULL) RETURNING id INTO v_class_sat_ahp;
  END IF;

  SELECT id INTO v_class_jonathan FROM public.classes WHERE name = 'Jonathan Esayag';
  IF v_class_jonathan IS NULL THEN
    INSERT INTO public.classes (name, teacher_id) VALUES ('Jonathan Esayag', NULL) RETURNING id INTO v_class_jonathan;
  END IF;

  SELECT id INTO v_class_apcalc FROM public.classes WHERE name = 'AP Calculus AB';
  IF v_class_apcalc IS NULL THEN
    INSERT INTO public.classes (name, teacher_id) VALUES ('AP Calculus AB', NULL) RETURNING id INTO v_class_apcalc;
  END IF;

  SELECT id INTO v_class_evening FROM public.classes WHERE name = 'Evening Study Group';
  IF v_class_evening IS NULL THEN
    INSERT INTO public.classes (name, teacher_id) VALUES ('Evening Study Group', NULL) RETURNING id INTO v_class_evening;
  END IF;

  SELECT id INTO v_class_yonatan FROM public.classes WHERE name = 'Yonatan Danon';
  IF v_class_yonatan IS NULL THEN
    INSERT INTO public.classes (name, teacher_id) VALUES ('Yonatan Danon', NULL) RETURNING id INTO v_class_yonatan;
  END IF;

  SELECT id INTO v_class_eitan FROM public.classes WHERE name = 'Eitan Yurkowicz';
  IF v_class_eitan IS NULL THEN
    INSERT INTO public.classes (name, teacher_id) VALUES ('Eitan Yurkowicz', NULL) RETURNING id INTO v_class_eitan;
  END IF;

  SELECT id INTO v_class_tommy FROM public.classes WHERE name = 'Tommy Khafif';
  IF v_class_tommy IS NULL THEN
    INSERT INTO public.classes (name, teacher_id) VALUES ('Tommy Khafif', NULL) RETURNING id INTO v_class_tommy;
  END IF;

  -- ── Recurring weekly schedule (guarded by the real unique constraint) ──

  INSERT INTO public.class_schedules (class_id, day_of_week, start_time, end_time) VALUES
    (v_class_marcela,  1, '16:00', '17:00'),
    (v_class_marcela,  3, '16:00', '17:00'),
    (v_class_sat_ahp,  1, '17:00', '18:00'),
    (v_class_sat_ahp,  3, '17:00', '18:00'),
    (v_class_jonathan, 2, '16:00', '17:00'),
    (v_class_jonathan, 4, '16:00', '17:00'),
    (v_class_apcalc,   2, '17:00', '18:00'),
    (v_class_apcalc,   4, '17:00', '18:00'),
    (v_class_evening,  2, '19:30', '20:30'),
    (v_class_evening,  4, '19:30', '20:30'),
    (v_class_yonatan,  0, '12:00', '13:00'),
    (v_class_eitan,    0, '16:00', '17:00'),
    (v_class_tommy,    0, '17:00', '18:00')
  ON CONFLICT (class_id, day_of_week, start_time) DO NOTHING;

  -- ── Pre-approved roster (guarded on normalized_name) ────────────

  SELECT id INTO v_p_marcela FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Marcela Gimal');
  IF v_p_marcela IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Marcela Gimal', v_admin_id) RETURNING id INTO v_p_marcela;
  END IF;

  SELECT id INTO v_p_jonathan FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Jonathan Esayag');
  IF v_p_jonathan IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Jonathan Esayag', v_admin_id) RETURNING id INTO v_p_jonathan;
  END IF;

  SELECT id INTO v_p_aharon FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Aharon Harari');
  IF v_p_aharon IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Aharon Harari', v_admin_id) RETURNING id INTO v_p_aharon;
  END IF;

  SELECT id INTO v_p_joshua FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Joshua Hafez');
  IF v_p_joshua IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Joshua Hafez', v_admin_id) RETURNING id INTO v_p_joshua;
  END IF;

  SELECT id INTO v_p_abraham FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Abraham Assis');
  IF v_p_abraham IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Abraham Assis', v_admin_id) RETURNING id INTO v_p_abraham;
  END IF;

  SELECT id INTO v_p_joseph_t FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Joseph Tawachi');
  IF v_p_joseph_t IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Joseph Tawachi', v_admin_id) RETURNING id INTO v_p_joseph_t;
  END IF;

  SELECT id INTO v_p_jacky FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Jacky Fnunou');
  IF v_p_jacky IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Jacky Fnunou', v_admin_id) RETURNING id INTO v_p_jacky;
  END IF;

  SELECT id INTO v_p_sofia FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Sofia Rios');
  IF v_p_sofia IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Sofia Rios', v_admin_id) RETURNING id INTO v_p_sofia;
  END IF;

  SELECT id INTO v_p_tzeitel FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Tzeitel Delgado');
  IF v_p_tzeitel IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Tzeitel Delgado', v_admin_id) RETURNING id INTO v_p_tzeitel;
  END IF;

  SELECT id INTO v_p_yonatan FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Yonatan Danon');
  IF v_p_yonatan IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Yonatan Danon', v_admin_id) RETURNING id INTO v_p_yonatan;
  END IF;

  SELECT id INTO v_p_eitan FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Eitan Yurkowicz');
  IF v_p_eitan IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Eitan Yurkowicz', v_admin_id) RETURNING id INTO v_p_eitan;
  END IF;

  SELECT id INTO v_p_tommy FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Tommy Khafif');
  IF v_p_tommy IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Tommy Khafif', v_admin_id) RETURNING id INTO v_p_tommy;
  END IF;

  SELECT id INTO v_p_nate FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Nate Bassan');
  IF v_p_nate IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Nate Bassan', v_admin_id) RETURNING id INTO v_p_nate;
  END IF;

  -- ── Pre-activation class links ────────────────────────────────

  INSERT INTO public.preapproved_class_members (preapproved_student_id, class_id) VALUES
    (v_p_marcela,  v_class_marcela),
    (v_p_aharon,   v_class_sat_ahp),
    (v_p_joshua,   v_class_sat_ahp),
    (v_p_jonathan, v_class_jonathan),
    (v_p_abraham,  v_class_apcalc),
    (v_p_joseph_t, v_class_apcalc),
    (v_p_jacky,    v_class_apcalc),
    (v_p_sofia,    v_class_evening),
    (v_p_tzeitel,  v_class_evening),
    (v_p_yonatan,  v_class_yonatan),
    (v_p_eitan,    v_class_eitan),
    (v_p_tommy,    v_class_tommy)
  ON CONFLICT (preapproved_student_id, class_id) DO NOTHING;
END $$;
