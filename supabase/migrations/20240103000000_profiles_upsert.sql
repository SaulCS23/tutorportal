-- Run once in Supabase SQL Editor.
-- Changes update_own_full_name from UPDATE-only to UPSERT so that users
-- whose profiles row was never created can set their name from the Account page.

CREATE OR REPLACE FUNCTION public.update_own_full_name(new_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (auth.uid(), trim(new_full_name), 'student')
  ON CONFLICT (id) DO UPDATE
    SET full_name  = trim(new_full_name),
        updated_at = now();
END;
$$;
