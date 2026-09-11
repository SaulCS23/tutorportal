"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// All role changes happen inside SECURITY DEFINER Postgres functions
// (see supabase/migrations/20240120000000_teacher_access_requests.sql).
// These actions are thin wrappers: they never touch profiles.role
// directly, and admin authorization is re-checked server-side by
// is_admin() on every call, not assumed from who could reach this code.

export async function requestTeacherAccessAction(
  message: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("request_teacher_access", {
    p_message: message.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/account");
  return {};
}

export async function approveTeacherAccessRequestAction(
  requestId: string,
  note: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("approve_teacher_access_request", {
    p_request_id: requestId,
    p_note: note.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/teacher-requests");
  revalidatePath("/account");
  return {};
}

export async function rejectTeacherAccessRequestAction(
  requestId: string,
  note: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("reject_teacher_access_request", {
    p_request_id: requestId,
    p_note: note.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/teacher-requests");
  revalidatePath("/account");
  return {};
}

export type AdminUserLookup = {
  user_id: string;
  full_name: string;
  email: string;
  role: "student" | "teacher";
  created_at: string;
};

export async function adminFindUserByEmailAction(
  email: string
): Promise<{ data?: AdminUserLookup | null; error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("admin_find_user_by_email", {
    p_email: email.trim(),
  });
  if (error) return { error: error.message };

  return { data: (data as AdminUserLookup[])[0] ?? null };
}

export async function adminGrantTeacherRoleAction(
  userId: string,
  note: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("admin_grant_teacher_role", {
    p_user_id: userId,
    p_note: note.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/teacher-requests");
  return {};
}
