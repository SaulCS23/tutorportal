"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Ownership is enforced entirely inside take_class() (see
// supabase/migrations/20240122000000_shared_teacher_schedule.sql): it
// re-checks the caller is a teacher and that the class is still
// unassigned, row-locked, so this action can never silently overwrite
// an already-assigned class or let a non-teacher take one.
export async function takeClassAction(classId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("take_class", { p_class_id: classId });
  if (error) return { error: error.message };

  revalidatePath("/schedule");
  return {};
}

// Ownership is enforced entirely inside release_class() (see
// supabase/migrations/20240125000000_release_class.sql): it re-checks
// the caller is a teacher AND the class's current responsible teacher,
// row-locked, so another teacher can never release someone else's class
// and a student can never reach this at all.
export async function releaseClassAction(classId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("release_class", { p_class_id: classId });
  if (error) return { error: error.message };

  revalidatePath("/schedule");
  return {};
}
