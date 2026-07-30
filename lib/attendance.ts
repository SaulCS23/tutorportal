import type { SupabaseClient } from "@supabase/supabase-js";

export type AttendanceStatus = "pending" | "present" | "late" | "absent";

export type AttendanceRecord = {
  student_id: string;
  attendance_status: AttendanceStatus;
  joined_at: string | null;
  attendance_overridden: boolean;
  attendance_updated_by: string | null;
};

const ATTENDANCE_SELECT =
  "student_id, attendance_status, joined_at, attendance_overridden, attendance_updated_by";

/**
 * The status to actually display or count. An override always wins; a
 * recorded join is already exactly present/late (computed server-side
 * the instant the student joined); otherwise nothing has happened yet
 * for this student — which only reads as "absent" once the meeting
 * itself has actually ended, and "pending" before that.
 */
export function effectiveAttendanceStatus(
  record: Pick<AttendanceRecord, "attendance_status" | "joined_at" | "attendance_overridden"> | null | undefined,
  meetingHasEnded: boolean
): AttendanceStatus {
  if (record?.attendance_overridden) return record.attendance_status;
  if (record?.joined_at) return record.attendance_status;
  return meetingHasEnded ? "absent" : "pending";
}

/** The current student's own attendance row for one meeting — RLS
 *  scopes this to the caller automatically, no student_id filter needed. */
export async function getOwnAttendance(
  supabase: SupabaseClient,
  meetingId: string
): Promise<{ data: AttendanceRecord | null; error: string | null }> {
  const { data, error } = await supabase
    .from("class_meeting_attendance")
    .select(ATTENDANCE_SELECT)
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: (data as AttendanceRecord) ?? null, error: null };
}

/** Every recorded attendance row for one meeting — visible to the
 *  meeting's teacher only (RLS). */
export async function getMeetingAttendance(
  supabase: SupabaseClient,
  meetingId: string
): Promise<{ data: AttendanceRecord[]; error: string | null }> {
  const { data, error } = await supabase
    .from("class_meeting_attendance")
    .select(ATTENDANCE_SELECT)
    .eq("meeting_id", meetingId);
  if (error) return { data: [], error: error.message };
  return { data: (data as AttendanceRecord[]) ?? [], error: null };
}

/** Teacher override — always wins over the automatic determination. */
export async function setMeetingAttendance(
  supabase: SupabaseClient,
  meetingId: string,
  studentId: string,
  status: Exclude<AttendanceStatus, "pending">
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_meeting_attendance", {
    p_meeting_id: meetingId,
    p_student_id: studentId,
    p_status: status,
  });
  return { error: error?.message ?? null };
}

/** The meeting's real end instant (already timezone-resolved server
 *  side) — reused as-is from the meeting-cancellation workflow (20240114)
 *  rather than re-deriving it from date/time/timezone parts client-side. */
export async function getMeetingEndsAt(
  supabase: SupabaseClient,
  meetingId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("meeting_ends_at", { p_meeting_id: meetingId });
  if (error) return null;
  return (data as string) ?? null;
}
