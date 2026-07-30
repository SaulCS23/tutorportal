import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveAttendanceStatus, type AttendanceStatus } from "./attendance";

export type AttendanceTally = {
  present: number;
  late: number;
  absent: number;
  total: number;
  /** (present + late) / total, 0-100 rounded; 0 when total is 0. */
  rate: number;
};

type RawAttendanceRow = {
  attendance_status: AttendanceStatus;
  joined_at: string | null;
  attendance_overridden: boolean;
};

const EMPTY_TALLY: AttendanceTally = { present: 0, late: 0, absent: 0, total: 0, rate: 0 };

// Every row passed in here already belongs to a meeting whose
// meeting_date is before today (see the `lt("meeting_date", todayISO)`
// filters below) — the same coarse, day-level "has this happened yet"
// cutoff already used elsewhere in this codebase (e.g. the teacher
// meetings page's upcoming/past split) — so a missing row always folds
// to "absent" here, never "pending".
function tally(rows: RawAttendanceRow[]): AttendanceTally {
  let present = 0;
  let late = 0;
  let absent = 0;
  for (const row of rows) {
    const status = effectiveAttendanceStatus(row, true);
    if (status === "present") present++;
    else if (status === "late") late++;
    else if (status === "absent") absent++;
  }
  const total = present + late + absent;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  return { present, late, absent, total, rate };
}

/**
 * The current student's own attendance rollup across every concluded,
 * non-cancelled meeting in their enrolled classes. RLS scopes both
 * queries to the caller automatically — no student_id filter needed.
 */
export async function getOwnAttendanceSummary(
  supabase: SupabaseClient,
  todayISO: string
): Promise<AttendanceTally> {
  const { data: meetings } = await supabase
    .from("class_meetings")
    .select("id")
    .neq("status", "cancelled")
    .lt("meeting_date", todayISO);

  const meetingIds = ((meetings as { id: string }[] | null) ?? []).map((m) => m.id);
  if (meetingIds.length === 0) return EMPTY_TALLY;

  const { data: records } = await supabase
    .from("class_meeting_attendance")
    .select("meeting_id, attendance_status, joined_at, attendance_overridden")
    .in("meeting_id", meetingIds);

  const byMeeting = new Map(
    ((records as (RawAttendanceRow & { meeting_id: string })[] | null) ?? []).map((r) => [
      r.meeting_id,
      r,
    ])
  );

  const rows: RawAttendanceRow[] = meetingIds.map(
    (id) =>
      byMeeting.get(id) ?? { attendance_status: "pending", joined_at: null, attendance_overridden: false }
  );
  return tally(rows);
}

export type AttendanceAlert = {
  studentId: string;
  name: string;
  tally: AttendanceTally;
};

/**
 * Students across the teacher's own classes whose attendance rate has
 * dropped below `thresholdRate` (default 80%), over every concluded,
 * non-cancelled meeting. Bounded to the teacher's own classes/students —
 * same scale assumption as the rest of the dashboard's teacher queries.
 */
export async function getTeacherAttendanceAlerts(
  supabase: SupabaseClient,
  teacherId: string,
  todayISO: string,
  thresholdRate = 80
): Promise<AttendanceAlert[]> {
  const { data: classes } = await supabase.from("classes").select("id").eq("teacher_id", teacherId);
  const classIds = ((classes as { id: string }[] | null) ?? []).map((c) => c.id);
  if (classIds.length === 0) return [];

  const [{ data: meetings }, { data: members }] = await Promise.all([
    supabase
      .from("class_meetings")
      .select("id, class_id, restricted_to_student_id")
      .in("class_id", classIds)
      .neq("status", "cancelled")
      .lt("meeting_date", todayISO),
    supabase
      .from("class_members")
      .select("class_id, student_id, profiles ( full_name )")
      .in("class_id", classIds),
  ]);

  const meetingRows =
    (meetings as { id: string; class_id: string; restricted_to_student_id: string | null }[] | null) ?? [];
  if (meetingRows.length === 0) return [];

  const meetingIds = meetingRows.map((m) => m.id);
  const { data: records } = await supabase
    .from("class_meeting_attendance")
    .select("meeting_id, student_id, attendance_status, joined_at, attendance_overridden")
    .in("meeting_id", meetingIds);

  const recordKey = (meetingId: string, studentId: string) => `${meetingId}:${studentId}`;
  const recordMap = new Map(
    ((records as (RawAttendanceRow & { meeting_id: string; student_id: string })[] | null) ?? []).map(
      (r) => [recordKey(r.meeting_id, r.student_id), r]
    )
  );

  const membersByClass = new Map<string, { student_id: string; full_name: string }[]>();
  const rawMembers =
    (members as unknown as { class_id: string; student_id: string; profiles: { full_name: string } | null }[] | null) ??
    [];
  for (const m of rawMembers) {
    const list = membersByClass.get(m.class_id) ?? [];
    list.push({ student_id: m.student_id, full_name: m.profiles?.full_name ?? "Unknown Student" });
    membersByClass.set(m.class_id, list);
  }

  const rowsByStudent = new Map<string, RawAttendanceRow[]>();
  const nameByStudent = new Map<string, string>();

  for (const meeting of meetingRows) {
    const roster = membersByClass.get(meeting.class_id) ?? [];
    const relevant = meeting.restricted_to_student_id
      ? roster.filter((s) => s.student_id === meeting.restricted_to_student_id)
      : roster;

    for (const student of relevant) {
      nameByStudent.set(student.student_id, student.full_name);
      const record = recordMap.get(recordKey(meeting.id, student.student_id)) ?? {
        attendance_status: "pending" as AttendanceStatus,
        joined_at: null,
        attendance_overridden: false,
      };
      const list = rowsByStudent.get(student.student_id) ?? [];
      list.push(record);
      rowsByStudent.set(student.student_id, list);
    }
  }

  const alerts: AttendanceAlert[] = [];
  for (const [studentId, rows] of rowsByStudent) {
    const t = tally(rows);
    if (t.total > 0 && t.rate < thresholdRate) {
      alerts.push({ studentId, name: nameByStudent.get(studentId) ?? "Unknown Student", tally: t });
    }
  }
  alerts.sort((a, b) => a.tally.rate - b.tally.rate);
  return alerts;
}
