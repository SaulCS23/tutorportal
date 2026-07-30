import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveAttendanceStatus, type AttendanceStatus } from "./attendance";
import { hasMeetingConcluded } from "./timezone";

export type AttendanceTally = {
  present: number;
  late: number;
  absent: number;
  total: number;
  /** (present + late) / total, 0-100 rounded; 0 when total is 0. Late
   *  counts as attended — see computeAttendanceRate. */
  rate: number;
};

type RawAttendanceRow = {
  attendance_status: AttendanceStatus;
  joined_at: string | null;
  attendance_overridden: boolean;
};

const EMPTY_TALLY: AttendanceTally = { present: 0, late: 0, absent: 0, total: 0, rate: 0 };

/**
 * The one shared attendance-rate formula used everywhere in the app —
 * teacher student records, student attendance history, dashboard
 * summaries, attendance alerts. Late counts as attended (it only
 * reduces punctuality, not attendance); Absent does not.
 */
export function computeAttendanceRate(present: number, late: number, absent: number): number {
  const total = present + late + absent;
  return total > 0 ? Math.round(((present + late) / total) * 100) : 0;
}

// Takes already-resolved statuses (via effectiveAttendanceStatus), not
// raw rows — every caller has already filtered its meetings down to
// ones that have actually concluded (hasMeetingConcluded, an absolute-
// instant check — see the module-level note on coarseUpperBoundDate
// below for why the SQL query itself uses a looser bound), so a missing
// row always resolves to "absent" before it ever reaches this function,
// never "pending".
function tally(statuses: AttendanceStatus[]): AttendanceTally {
  let present = 0;
  let late = 0;
  let absent = 0;
  for (const status of statuses) {
    if (status === "present") present++;
    else if (status === "late") late++;
    else if (status === "absent") absent++;
  }
  return { present, late, absent, total: present + late + absent, rate: computeAttendanceRate(present, late, absent) };
}

/**
 * A generous, timezone-agnostic upper bound for the SQL query only —
 * never the correctness boundary for "has this meeting concluded". The
 * real decision is hasMeetingConcluded() (lib/timezone.ts), applied per
 * meeting below using that meeting's own absolute end instant, which is
 * what correctly includes a meeting that ended earlier today instead of
 * waiting until the calendar date has fully passed. A 2-day margin
 * safely covers any IANA zone's offset from UTC in either direction, so
 * this pre-filter can never accidentally exclude a meeting that should
 * be considered concluded.
 */
function coarseUpperBoundDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString().slice(0, 10);
}

/** One concluded meeting's outcome for one student — the shared shape
 *  behind both the teacher's and student's attendance-history views, so
 *  neither re-derives status/labels on its own. Always a real
 *  class_meetings row (never a schedule-template projection). */
export type AttendanceHistoryEntry = {
  meetingId: string;
  classId: string;
  className: string;
  title: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  meetingStatus: "scheduled" | "completed" | "group_pending_reschedule";
  meetingProvider: string | null;
  meetingLink: string | null;
  location: string | null;
  status: AttendanceStatus;
  joinedAt: string | null;
  overridden: boolean;
};

type RawMeetingRow = {
  id: string;
  class_id: string;
  title: string;
  meeting_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: "scheduled" | "completed" | "group_pending_reschedule";
  meeting_provider: string | null;
  meeting_link: string | null;
  location: string | null;
  restricted_to_student_id?: string | null;
  classes: { name: string } | null;
};

/** Precondition: `meeting` has already been confirmed concluded via
 *  hasMeetingConcluded — every caller filters for that before mapping. */
function toHistoryEntry(
  meeting: RawMeetingRow,
  record: (RawAttendanceRow & { meeting_id?: string; student_id?: string }) | undefined
): AttendanceHistoryEntry {
  return {
    meetingId: meeting.id,
    classId: meeting.class_id,
    className: meeting.classes?.name ?? "Class",
    title: meeting.title,
    meetingDate: meeting.meeting_date,
    startTime: meeting.start_time,
    endTime: meeting.end_time,
    timezone: meeting.timezone,
    meetingStatus: meeting.status,
    meetingProvider: meeting.meeting_provider,
    meetingLink: meeting.meeting_link,
    location: meeting.location,
    status: effectiveAttendanceStatus(record, true),
    joinedAt: record?.joined_at ?? null,
    overridden: record?.attendance_overridden ?? false,
  };
}

const MEETING_HISTORY_SELECT =
  "id, class_id, title, meeting_date, start_time, end_time, timezone, status, meeting_provider, meeting_link, location, restricted_to_student_id, classes ( name )";

/**
 * The current student's own attendance summary + chronological history
 * (newest first) across every concluded, non-cancelled meeting in their
 * enrolled classes. RLS scopes both queries to the caller automatically
 * — no student_id filter needed. The single shared query behind both
 * getOwnAttendanceSummary (below) and the student's account-page history.
 */
export async function getOwnAttendanceHistory(
  supabase: SupabaseClient
): Promise<{ tally: AttendanceTally; history: AttendanceHistoryEntry[] }> {
  const { data: meetings } = await supabase
    .from("class_meetings")
    .select(MEETING_HISTORY_SELECT)
    .neq("status", "cancelled")
    .lte("meeting_date", coarseUpperBoundDate())
    .order("meeting_date", { ascending: false })
    .order("start_time", { ascending: false });

  const now = new Date();
  const meetingRows = ((meetings as unknown as RawMeetingRow[] | null) ?? []).filter((m) =>
    hasMeetingConcluded(m, now)
  );
  if (meetingRows.length === 0) return { tally: EMPTY_TALLY, history: [] };

  const meetingIds = meetingRows.map((m) => m.id);
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

  const history = meetingRows.map((m) => toHistoryEntry(m, byMeeting.get(m.id)));
  return { tally: tally(history.map((h) => h.status)), history };
}

/**
 * The current student's own attendance rollup — a thin wrapper around
 * getOwnAttendanceHistory so the dashboard's summary card and the
 * account page's full history both come from the same single query
 * shape instead of two independent ones.
 */
export async function getOwnAttendanceSummary(supabase: SupabaseClient): Promise<AttendanceTally> {
  const { tally: t } = await getOwnAttendanceHistory(supabase);
  return t;
}

export type StudentAttendanceRecord = {
  studentId: string;
  tally: AttendanceTally;
  history: AttendanceHistoryEntry[];
};

/**
 * Every enrolled student's attendance summary + chronological history
 * (newest first) for one class, across every concluded, non-cancelled
 * meeting — the teacher-facing counterpart to getOwnAttendanceHistory,
 * scoped to a single class (unlike getTeacherAttendanceAlerts, which
 * intentionally rolls a student's attendance up across every class the
 * teacher teaches for the dashboard's alert list — a different
 * aggregation than a single class's roster view needs, so kept separate
 * rather than forced into one shared function).
 */
export async function getClassAttendanceHistory(
  supabase: SupabaseClient,
  classId: string
): Promise<StudentAttendanceRecord[]> {
  const [{ data: meetings }, { data: members }] = await Promise.all([
    supabase
      .from("class_meetings")
      .select(MEETING_HISTORY_SELECT)
      .eq("class_id", classId)
      .neq("status", "cancelled")
      .lte("meeting_date", coarseUpperBoundDate())
      .order("meeting_date", { ascending: false })
      .order("start_time", { ascending: false }),
    supabase.from("class_members").select("student_id").eq("class_id", classId),
  ]);

  const now = new Date();
  const meetingRows = ((meetings as unknown as RawMeetingRow[] | null) ?? []).filter((m) =>
    hasMeetingConcluded(m, now)
  );
  const studentIds = ((members as { student_id: string }[] | null) ?? []).map((m) => m.student_id);
  if (studentIds.length === 0) return [];
  if (meetingRows.length === 0) {
    return studentIds.map((studentId) => ({ studentId, tally: EMPTY_TALLY, history: [] }));
  }

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

  return studentIds.map((studentId) => {
    const history = meetingRows
      .filter((m) => !m.restricted_to_student_id || m.restricted_to_student_id === studentId)
      .map((m) => toHistoryEntry(m, recordMap.get(recordKey(m.id, studentId))));
    return { studentId, tally: tally(history.map((h) => h.status)), history };
  });
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
  thresholdRate = 80
): Promise<AttendanceAlert[]> {
  const { data: classes } = await supabase.from("classes").select("id").eq("teacher_id", teacherId);
  const classIds = ((classes as { id: string }[] | null) ?? []).map((c) => c.id);
  if (classIds.length === 0) return [];

  const [{ data: meetings }, { data: members }] = await Promise.all([
    supabase
      .from("class_meetings")
      .select("id, class_id, meeting_date, end_time, timezone, restricted_to_student_id")
      .in("class_id", classIds)
      .neq("status", "cancelled")
      .lte("meeting_date", coarseUpperBoundDate()),
    supabase
      .from("class_members")
      .select("class_id, student_id, profiles ( full_name )")
      .in("class_id", classIds),
  ]);

  const now = new Date();
  const meetingRows = (
    (meetings as
      | {
          id: string;
          class_id: string;
          meeting_date: string;
          end_time: string;
          timezone: string;
          restricted_to_student_id: string | null;
        }[]
      | null) ?? []
  ).filter((m) => hasMeetingConcluded(m, now));
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

  const statusesByStudent = new Map<string, AttendanceStatus[]>();
  const nameByStudent = new Map<string, string>();

  for (const meeting of meetingRows) {
    const roster = membersByClass.get(meeting.class_id) ?? [];
    const relevant = meeting.restricted_to_student_id
      ? roster.filter((s) => s.student_id === meeting.restricted_to_student_id)
      : roster;

    for (const student of relevant) {
      nameByStudent.set(student.student_id, student.full_name);
      const record = recordMap.get(recordKey(meeting.id, student.student_id));
      const list = statusesByStudent.get(student.student_id) ?? [];
      list.push(effectiveAttendanceStatus(record, true));
      statusesByStudent.set(student.student_id, list);
    }
  }

  const alerts: AttendanceAlert[] = [];
  for (const [studentId, statuses] of statusesByStudent) {
    const t = tally(statuses);
    if (t.total > 0 && t.rate < thresholdRate) {
      alerts.push({ studentId, name: nameByStudent.get(studentId) ?? "Unknown Student", tally: t });
    }
  }
  alerts.sort((a, b) => a.tally.rate - b.tally.rate);
  return alerts;
}
