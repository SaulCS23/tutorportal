import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Class = {
  id: string;
  name: string;
  subject: string | null;
  teacher_id: string;
  join_code: string;
  created_at: string;
  updated_at: string;
};

export type ClassMember = {
  class_id: string;
  student_id: string;
  joined_at: string;
};

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  role: "student" | "teacher";
  created_at: string;
  updated_at: string;
};

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name, role, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("[getCurrentProfile] code=%s msg=%s", error.code, error.message);
  }

  return (data as Profile) ?? null;
}

export async function getCurrentRole(): Promise<"student" | "teacher" | null> {
  const profile = await getCurrentProfile();
  return profile?.role ?? null;
}
