-- ============================================================
-- Migration: add first_name / last_name to profiles
-- Preserves full_name for backward compatibility.
-- Run once in the Supabase SQL Editor.
-- ============================================================

-- 1. New nullable columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text;

-- 2. Backfill existing rows from full_name
--    first_name = first whitespace-delimited token
--    last_name  = last whitespace-delimited token (null when only one word)
UPDATE public.profiles
SET
  first_name = (regexp_match(trim(full_name), '^\S+'))[1],
  last_name  = CASE
                 WHEN trim(full_name) ~ '\s'
                 THEN (regexp_match(trim(full_name), '\S+$'))[1]
                 ELSE NULL
               END
WHERE first_name IS NULL;

-- 3. Replace trigger: store first_name, last_name, and computed full_name on signup.
--    Falls back to the legacy full_name meta key, then 'Student'.
--    Does NOT overwrite existing role — uses ON CONFLICT DO NOTHING.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text;
  v_last  text;
  v_full  text;
BEGIN
  v_first := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), '');
  v_last  := nullif(trim(coalesce(new.raw_user_meta_data->>'last_name',  '')), '');

  v_full := nullif(trim(coalesce(v_first, '') || ' ' || coalesce(v_last, '')), '');
  IF v_full IS NULL THEN
    v_full := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  END IF;
  IF v_full IS NULL THEN
    v_full := 'Student';
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, full_name, role)
  VALUES (new.id, v_first, v_last, v_full, 'student')
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- 4. New RPC: update first_name, last_name, and full_name together.
--    First name is required; last name is optional.
--    UPSERT so users with missing profile rows can recover without a separate call.
--    Role is never touched on UPDATE.
CREATE OR REPLACE FUNCTION public.update_own_name(
  p_first_name text,
  p_last_name  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text;
  v_last  text;
  v_full  text;
BEGIN
  v_first := nullif(trim(coalesce(p_first_name, '')), '');
  v_last  := nullif(trim(coalesce(p_last_name,  '')), '');

  IF v_first IS NULL THEN
    RAISE EXCEPTION 'First name cannot be blank';
  END IF;

  v_full := trim(v_first || ' ' || coalesce(v_last, ''));

  INSERT INTO public.profiles (id, first_name, last_name, full_name, role)
  VALUES (auth.uid(), v_first, v_last, v_full, 'student')
  ON CONFLICT (id) DO UPDATE
    SET first_name = v_first,
        last_name  = v_last,
        full_name  = v_full,
        updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_own_name(text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.update_own_name(text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_own_name(text, text) TO authenticated;
