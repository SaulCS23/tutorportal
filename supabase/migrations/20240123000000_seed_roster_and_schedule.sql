-- ============================================================
-- Migration: seed the current tutoring roster and schedule.
-- Run once in the Supabase SQL Editor, AFTER 20240121 and 20240122.
-- ============================================================
--
-- Source: the schedule and roster supplied for this task. Only slots
-- with an unambiguous student/class and a stated time are created.
-- Deliberately NOT created (per explicit instruction — do not guess):
--   - Monday/Wednesday 6:00-7:30 PM (blocked/unavailable)
--   - Thursday 2:00-3:00 PM and 3:00-4:00 PM (unclear block)
--   - Friday (no confirmed classes)
--   - Nate Bassan's class time (unclear) — he is still seeded as a
--     preapproved student with NO class/schedule link.
--
-- Every class is created with teacher_id = NULL ("Unassigned") — no
-- class is auto-assigned to Saul, Joseph, or Moises. An authorized
-- teacher assigns themselves later via take_class() / the "Take Class"
-- UI on the shared schedule.
--
-- Class naming: sessions that were given an explicit class name in the
-- source schedule ("SAT AHP", "AP Calculus AB") keep that name exactly.
-- 1:1 sessions listed only by the student's name use that name as the
-- class name, matching the source literally. The unnamed Tue/Thu
-- 7:30-8:30 PM group session (Sofia Rios, Tzeitel Delgado) has no name
-- in the source data, so it is labeled "Evening Study Group" — a
-- generic, non-invented label; rename it from the Classes page if a
-- different name is preferred.
--
-- Idempotency: guarded on preapproved_students (by normalized_name) and
-- preapproved_class_members (natural composite PK via ON CONFLICT), the
-- two things most costly to accidentally duplicate. classes/
-- class_schedules are inserted plainly, once, matching this project's
-- existing "run once" migration convention (see 20240102000000).
-- ============================================================

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

  -- ── Classes (all unassigned) ─────────────────────────────────────

  INSERT INTO public.classes (name, teacher_id) VALUES ('Marcela Gimal', NULL) RETURNING id INTO v_class_marcela;
  INSERT INTO public.classes (name, teacher_id) VALUES ('SAT AHP', NULL) RETURNING id INTO v_class_sat_ahp;
  INSERT INTO public.classes (name, teacher_id) VALUES ('Jonathan Esayag', NULL) RETURNING id INTO v_class_jonathan;
  INSERT INTO public.classes (name, teacher_id) VALUES ('AP Calculus AB', NULL) RETURNING id INTO v_class_apcalc;
  INSERT INTO public.classes (name, teacher_id) VALUES ('Evening Study Group', NULL) RETURNING id INTO v_class_evening;
  INSERT INTO public.classes (name, teacher_id) VALUES ('Yonatan Danon', NULL) RETURNING id INTO v_class_yonatan;
  INSERT INTO public.classes (name, teacher_id) VALUES ('Eitan Yurkowicz', NULL) RETURNING id INTO v_class_eitan;
  INSERT INTO public.classes (name, teacher_id) VALUES ('Tommy Khafif', NULL) RETURNING id INTO v_class_tommy;

  -- ── Recurring weekly schedule (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu) ──
  -- timezone defaults to 'America/Panama' per class_schedules' own column default.

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
    (v_class_tommy,    0, '17:00', '18:00');

  -- ── Pre-approved roster (guarded so re-running is a no-op) ───────

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

  -- Nate Bassan: roster slot only — no class time is confirmed, so no
  -- class/schedule/link is created for him.
  SELECT id INTO v_p_nate FROM public.preapproved_students WHERE normalized_name = public.normalize_person_name('Nate Bassan');
  IF v_p_nate IS NULL THEN
    INSERT INTO public.preapproved_students (full_name, created_by) VALUES ('Nate Bassan', v_admin_id) RETURNING id INTO v_p_nate;
  END IF;

  -- ── Pre-activation class links ────────────────────────────────────

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
