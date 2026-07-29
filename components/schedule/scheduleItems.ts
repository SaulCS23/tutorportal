import { toLocalISODate } from "@/lib/utils";

export type RawClassSchedule = {
  id: string;
  class_id: string;
  day_of_week: number; // 0=Sunday…6=Saturday — matches Date.getDay() directly
  start_time: string;
  end_time: string;
  timezone: string;
  meeting_provider: string | null;
  meeting_link: string | null;
  location: string | null;
  classes: { name: string; subject: string | null; teacher_id: string } | null;
};

export type RawClassMeeting = {
  id: string;
  class_id: string;
  title: string;
  meeting_date: string; // "YYYY-MM-DD"
  start_time: string;
  end_time: string;
  timezone: string;
  meeting_provider: string | null;
  meeting_link: string | null;
  location: string | null;
  status: "scheduled" | "completed" | "cancelled" | "group_pending_reschedule";
  classes: { name: string; subject: string | null; teacher_id: string } | null;
};

export type ScheduleItem = {
  id: string;
  source: "meeting" | "schedule";
  classId: string;
  className: string;
  subject: string | null;
  teacherId: string | null;
  date: string; // "YYYY-MM-DD"
  startTime: string;
  endTime: string;
  timezone: string;
  /** null for schedule projections — the recurring template has no status concept */
  status: "scheduled" | "completed" | "cancelled" | "group_pending_reschedule" | null;
  title: string | null;
  location: string | null;
  meetingProvider: string | null;
  meetingLink: string | null;
};

function meetingToItem(m: RawClassMeeting): ScheduleItem {
  return {
    id: m.id,
    source: "meeting",
    classId: m.class_id,
    className: m.classes?.name ?? "Unknown Class",
    subject: m.classes?.subject ?? null,
    teacherId: m.classes?.teacher_id ?? null,
    date: m.meeting_date,
    startTime: m.start_time,
    endTime: m.end_time,
    timezone: m.timezone,
    status: m.status,
    title: m.title,
    location: m.location,
    meetingProvider: m.meeting_provider,
    meetingLink: m.meeting_link,
  };
}

function scheduleToItem(s: RawClassSchedule, dateISO: string): ScheduleItem {
  return {
    id: `schedule-${s.id}-${dateISO}`,
    source: "schedule",
    classId: s.class_id,
    className: s.classes?.name ?? "Unknown Class",
    subject: s.classes?.subject ?? null,
    teacherId: s.classes?.teacher_id ?? null,
    date: dateISO,
    startTime: s.start_time,
    endTime: s.end_time,
    timezone: s.timezone,
    status: null,
    title: null,
    location: s.location,
    meetingProvider: s.meeting_provider,
    meetingLink: s.meeting_link,
  };
}

/**
 * Returns the merged, deduped schedule items for one calendar date:
 * concrete class_meetings for that date, plus recurring class_schedules
 * rows projected onto that date's weekday — except a schedule is skipped
 * for a class that already has a concrete meeting on that same date. A
 * teacher-created dated meeting is treated as authoritative for that day;
 * there is no explicit link between the two tables to rely on instead.
 * Sorted chronologically by start time.
 */
export function getItemsForDate(
  date: Date,
  schedules: RawClassSchedule[],
  meetings: RawClassMeeting[]
): ScheduleItem[] {
  const dateISO = toLocalISODate(date);
  const dayOfWeek = date.getDay();

  const meetingsForDate = meetings
    .filter((m) => m.meeting_date === dateISO)
    .map(meetingToItem);

  const classIdsWithMeetingToday = new Set(meetingsForDate.map((m) => m.classId));

  const projected = schedules
    .filter(
      (s) => s.day_of_week === dayOfWeek && !classIdsWithMeetingToday.has(s.class_id)
    )
    .map((s) => scheduleToItem(s, dateISO));

  return [...meetingsForDate, ...projected].sort((a, b) =>
    a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0
  );
}

/**
 * True if a calendar date has at least one real activity item — a
 * non-cancelled meeting, or a recurring-schedule projection (which has no
 * cancelled state at all). A date with only cancelled meetings (and no
 * schedule projection) does not count.
 */
export function hasActivityOnDate(
  date: Date,
  schedules: RawClassSchedule[],
  meetings: RawClassMeeting[]
): boolean {
  return getItemsForDate(date, schedules, meetings).some(
    (item) => item.source === "schedule" || item.status !== "cancelled"
  );
}

/**
 * The next handful of concrete, non-cancelled class_meetings on or after
 * today, soonest first. Schedule-template projections are intentionally
 * excluded — "real, concrete dated meetings" only, per spec.
 */
export function getUpcomingMeetings(
  meetings: RawClassMeeting[],
  todayISO: string,
  limit: number = 5
): ScheduleItem[] {
  return meetings
    .filter((m) => m.status !== "cancelled" && m.meeting_date >= todayISO)
    .sort((a, b) => {
      if (a.meeting_date !== b.meeting_date) return a.meeting_date < b.meeting_date ? -1 : 1;
      return a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0;
    })
    .slice(0, limit)
    .map(meetingToItem);
}
