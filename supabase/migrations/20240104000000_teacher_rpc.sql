-- get_class_students: returns student id, name, email, and join date for a class.
-- SECURITY DEFINER so the function can read auth.users.email (not exposed by RLS).
-- Only the owning teacher can call this; non-owners receive a raised exception.
CREATE OR REPLACE FUNCTION public.get_class_students(p_class_id uuid)
RETURNS TABLE (
  student_id  uuid,
  full_name   text,
  email       text,
  joined_at   timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = p_class_id AND teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    cm.student_id,
    p.full_name,
    u.email::text,
    cm.joined_at
  FROM public.class_members cm
  JOIN public.profiles p ON p.id = cm.student_id
  JOIN auth.users     u ON u.id = cm.student_id
  WHERE cm.class_id = p_class_id
  ORDER BY cm.joined_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_class_students(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_class_students(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_class_students(uuid) TO authenticated;
