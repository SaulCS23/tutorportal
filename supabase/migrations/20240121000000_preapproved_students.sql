-- ============================================================
-- Migration: preapproved_students — secure activation records for
--             students TutorPortal already knows about but who have
--             not yet created a Supabase Auth account.
-- Run once in the Supabase SQL Editor.
-- ============================================================
--
-- Design:
--   A preapproved_students row represents a roster slot ("Aharon
--   Harari is a real, known student") with NO email/password/auth
--   account attached — none of that exists until the real person signs
--   up. Name matching at signup only decides whether to *offer* linking
--   this slot; it is never treated as authentication. The actual account
--   still requires a real email, Supabase email verification, and a
--   password managed entirely by Supabase Auth (see
--   claim_preapproved_student_from_own_metadata below, which only runs
--   after a confirmed session exists).
--
--   Names are not assumed globally unique — normalized_name has no
--   unique constraint. check_preapproved_student() below returns
--   'ambiguous' rather than guessing when more than one pending row
--   matches, so two same-named students are never silently conflated.
--
-- Assumptions:
--   public.profiles     exists (from 20240101)
--   public.classes      exists (from 20240102)
--   public.is_admin()   exists (from 20240120) — gates admin_add_preapproved_student
-- ============================================================

-- ── normalize_person_name: shared trim/case/whitespace normalization ──
--
-- Used both to populate preapproved_students.normalized_name and to
-- normalize the name typed at signup before comparing.

CREATE OR REPLACE FUNCTION public.normalize_person_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

-- ── preapproved_students ─────────────────────────────────────────────

CREATE TABLE public.preapproved_students (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  full_name       text        NOT NULL,
  normalized_name text        NOT NULL,

  status          text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'claimed', 'disabled')),

  claimed_user_id uuid        REFERENCES public.profiles(id),
  claimed_at      timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid        REFERENCES public.profiles(id),

  -- "claimed" always carries both claim fields; every other status carries neither.
  CONSTRAINT preapproved_students_claim_consistency CHECK (
    (status = 'claimed' AND claimed_user_id IS NOT NULL AND claimed_at IS NOT NULL)
    OR
    (status <> 'claimed' AND claimed_user_id IS NULL AND claimed_at IS NULL)
  )
);

-- A profile can claim at most one preapproved slot.
CREATE UNIQUE INDEX preapproved_students_claimed_user_id_idx
  ON public.preapproved_students (claimed_user_id)
  WHERE claimed_user_id IS NOT NULL;

CREATE INDEX preapproved_students_normalized_name_idx
  ON public.preapproved_students (normalized_name);

-- ── Keep normalized_name in sync with full_name automatically ───────

CREATE OR REPLACE FUNCTION public.set_preapproved_student_normalized_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_name := public.normalize_person_name(NEW.full_name);
  RETURN NEW;
END;
$$;

CREATE TRIGGER preapproved_students_set_normalized_name
  BEFORE INSERT OR UPDATE OF full_name ON public.preapproved_students
  FOR EACH ROW EXECUTE FUNCTION public.set_preapproved_student_normalized_name();

-- ── RLS ───────────────────────────────────────────────────────────────

ALTER TABLE public.preapproved_students ENABLE ROW LEVEL SECURITY;

-- A user may see their own claimed record (harmless — it's their own
-- data). No policy exposes any other row: matching during signup goes
-- exclusively through check_preapproved_student() below, which never
-- returns claimed_user_id, email, or any other account information.
CREATE POLICY "Users can read own claimed preapproved record"
  ON public.preapproved_students FOR SELECT TO authenticated
  USING (claimed_user_id = auth.uid());

-- No INSERT/UPDATE/DELETE grant to anyone — every write goes through
-- admin_add_preapproved_student() or claim_preapproved_student_from_own_metadata().
GRANT SELECT ON public.preapproved_students TO authenticated;

-- ── preapproved_class_members ─────────────────────────────────────────
--
-- Bridges a not-yet-activated roster slot to the class(es) it belongs
-- to, so claiming can auto-enroll into public.class_members without
-- ever needing a fake profile/auth account beforehand. Fully internal —
-- no client ever reads or writes this table directly.

CREATE TABLE public.preapproved_class_members (
  preapproved_student_id uuid NOT NULL REFERENCES public.preapproved_students(id) ON DELETE CASCADE,
  class_id                uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (preapproved_student_id, class_id)
);

ALTER TABLE public.preapproved_class_members ENABLE ROW LEVEL SECURITY;
-- No policies, no grants — enabling RLS with zero policies denies all
-- client access by default; only SECURITY DEFINER functions (which
-- bypass RLS) ever touch this table.

-- ── check_preapproved_student: pre-auth name lookup ──────────────────
--
-- Callable by anon (there is no session yet at this point in signup).
-- Deliberately returns only a coarse status plus, for the single
-- unclaimed-match case, the id/canonical name needed to continue Flow A
-- — never claimed_user_id, never any auth/account information. A name
-- matching an already-claimed record does not reveal whose account it
-- is or how to reach it.
--
-- Statuses:
--   'unclaimed_match' — exactly one pending slot matches; offer Flow A.
--   'ambiguous'        — more than one pending slot matches this name;
--                         do not guess — fall back to Flow B and let an
--                         admin resolve it manually (see final report).
--   'already_claimed'  — matches only claimed (or claimed+pending) slots;
--                         someone already activated this name.
--   'no_match'          — proceed with normal new-student signup (Flow B).

CREATE OR REPLACE FUNCTION public.check_preapproved_student(p_full_name text)
RETURNS TABLE (
  match_status  text,
  preapproved_id uuid,
  official_name  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized     text;
  v_pending_count  integer;
  v_claimed_count  integer;
  v_id             uuid;
  v_name           text;
BEGIN
  v_normalized := public.normalize_person_name(p_full_name);

  IF v_normalized = '' THEN
    RETURN QUERY SELECT 'no_match'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  SELECT count(*) INTO v_pending_count
  FROM public.preapproved_students
  WHERE normalized_name = v_normalized AND status = 'pending';

  SELECT count(*) INTO v_claimed_count
  FROM public.preapproved_students
  WHERE normalized_name = v_normalized AND status = 'claimed';

  IF v_pending_count = 1 THEN
    SELECT id, full_name INTO v_id, v_name
    FROM public.preapproved_students
    WHERE normalized_name = v_normalized AND status = 'pending';

    RETURN QUERY SELECT 'unclaimed_match'::text, v_id, v_name;
  ELSIF v_pending_count > 1 THEN
    RETURN QUERY SELECT 'ambiguous'::text, NULL::uuid, NULL::text;
  ELSIF v_claimed_count > 0 THEN
    RETURN QUERY SELECT 'already_claimed'::text, NULL::uuid, NULL::text;
  ELSE
    RETURN QUERY SELECT 'no_match'::text, NULL::uuid, NULL::text;
  END IF;
END;
$$;

-- Intentionally callable by anon — see comment above. Takes only a name,
-- returns no PII/account data in any branch.
GRANT EXECUTE ON FUNCTION public.check_preapproved_student(text) TO anon, authenticated;

-- ── claim_preapproved_student_from_own_metadata ──────────────────────
--
-- Runs once per successful email confirmation (called from
-- /auth/callback after exchangeCodeForSession succeeds — see app code).
-- Reads ONLY the caller's own auth.users.raw_user_meta_data, so a user
-- can never claim a slot on anyone else's behalf. A pending, atomic
-- row lock (FOR UPDATE) plus the claimed_user_id unique index make a
-- double-claim race impossible: whichever transaction commits first
-- flips status to 'claimed', and any concurrent/later attempt on the
-- same row simply no-ops.
--
-- Silent no-op (never raises) when: no candidate id in metadata, the
-- candidate no longer exists, or it is no longer 'pending' (already
-- claimed by someone else, or disabled) — the caller's own signup still
-- succeeds as a normal new-student account in every one of these cases,
-- exactly as if they had never matched a roster name.

CREATE OR REPLACE FUNCTION public.claim_preapproved_student_from_own_metadata()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate_id uuid;
  v_status       text;
  v_full_name    text;
  v_first        text;
  v_last         text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT nullif(raw_user_meta_data->>'preapproved_student_id', '')::uuid
  INTO v_candidate_id
  FROM auth.users
  WHERE id = auth.uid();

  IF v_candidate_id IS NULL THEN
    RETURN;
  END IF;

  SELECT status, full_name INTO v_status, v_full_name
  FROM public.preapproved_students
  WHERE id = v_candidate_id
  FOR UPDATE;

  IF NOT FOUND OR v_status <> 'pending' THEN
    RETURN;
  END IF;

  UPDATE public.preapproved_students
  SET status          = 'claimed',
      claimed_user_id = auth.uid(),
      claimed_at      = now()
  WHERE id = v_candidate_id;

  -- Preserve the official stored display name over whatever casing the
  -- student typed at signup.
  v_first := (regexp_match(v_full_name, '^\S+'))[1];
  v_last  := CASE WHEN v_full_name ~ '\s' THEN (regexp_match(v_full_name, '\S+$'))[1] ELSE NULL END;

  UPDATE public.profiles
  SET first_name = v_first,
      last_name  = v_last,
      full_name  = v_full_name,
      updated_at = now()
  WHERE id = auth.uid();

  -- Connect to whatever classes this roster slot already belongs to.
  INSERT INTO public.class_members (class_id, student_id)
  SELECT pcm.class_id, auth.uid()
  FROM public.preapproved_class_members pcm
  WHERE pcm.preapproved_student_id = v_candidate_id
  ON CONFLICT (class_id, student_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_preapproved_student_from_own_metadata() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.claim_preapproved_student_from_own_metadata() TO authenticated;

-- ── admin_add_preapproved_student: add future roster slots ──────────
--
-- Admin-only (is_admin(), from 20240120). Lets Saul add new pre-approved
-- students later without hand-writing SQL migrations for each one.

CREATE OR REPLACE FUNCTION public.admin_add_preapproved_student(p_full_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF trim(coalesce(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  INSERT INTO public.preapproved_students (full_name, created_by)
  VALUES (trim(p_full_name), auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_add_preapproved_student(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.admin_add_preapproved_student(text) TO authenticated;
