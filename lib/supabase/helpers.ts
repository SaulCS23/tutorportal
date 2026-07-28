import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClassSchedule = {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string; // "HH:MM:SS" from PostgreSQL time type
  end_time: string;
  timezone: string;
  meeting_provider: string | null;
  meeting_link: string | null;
  meeting_id: string | null;
  meeting_passcode: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
};

export type ClassScheduleWithClass = ClassSchedule & {
  classes: { name: string; subject: string | null } | null;
};

export type ClassScheduleWithTeacher = ClassScheduleWithClass & {
  classes: { name: string; subject: string | null; teacher_id: string } | null;
};

export type ClassMeeting = {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  meeting_date: string; // "YYYY-MM-DD" from PostgreSQL date type
  start_time: string; // "HH:MM:SS" from PostgreSQL time type
  end_time: string;
  timezone: string;
  meeting_provider: string | null;
  meeting_link: string | null;
  location: string | null;
  status: "scheduled" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
};

export type ClassMeetingWithClass = ClassMeeting & {
  classes: { name: string; subject: string | null } | null;
};

export type ClassMeetingWithTeacher = ClassMeetingWithClass & {
  classes: { name: string; subject: string | null; teacher_id: string } | null;
};

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

const PROFILE_SELECT =
  "id, first_name, last_name, full_name, role, created_at, updated_at";

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

  // auth.getUser() validates the JWT with Supabase's auth server — always accurate.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  // Try the RLS-enforced authenticated client first.
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .single();

  if (data) return data as Profile;

  // Log the RLS failure so the error is visible in Vercel function logs.
  if (error) {
    console.error(
      "[getCurrentProfile] authenticated-client error code=%s msg=%s",
      error.code,
      error.message
    );
  }

  // Fallback: service-role admin client bypasses RLS so we always read the row
  // that auth.getUser() has already confirmed belongs to this user.
  const admin = createAdminClient();
  const { data: adminData, error: adminError } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .single();

  if (adminError) {
    console.error(
      "[getCurrentProfile] admin-client error code=%s msg=%s",
      adminError.code,
      adminError.message
    );
  }

  return (adminData as Profile) ?? null;
}

export async function getCurrentRole(): Promise<"student" | "teacher" | null> {
  const profile = await getCurrentProfile();
  return profile?.role ?? null;
}
