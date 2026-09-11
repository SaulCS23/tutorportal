import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import { getInitials, todayISODateInTimezone } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";
import ScheduleView from "@/components/schedule/ScheduleView";
import type { RawClassSchedule, RawClassMeeting } from "@/components/schedule/scheduleItems";

export const metadata: Metadata = { title: "Schedule" };

type MasterScheduleRow = {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  meeting_provider: string | null;
  meeting_link: string | null;
  location: string | null;
  class_name: string;
  subject: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  student_names: string[] | null;
};

type MasterMeetingRow = Omit<MasterScheduleRow, "day_of_week"> & {
  title: string;
  meeting_date: string;
  status: RawClassMeeting["status"];
};

export default async function SchedulePage() {
  const profile = await getCurrentProfile();
  const isTeacher = profile?.role === "teacher";
  const supabase = await createClient();

  let schedules: RawClassSchedule[] = [];
  let meetings: RawClassMeeting[] = [];
  let teacherMap: Record<string, string> = {};
  const studentsByClass: Record<string, string[]> = {};

  if (isTeacher) {
    // Every teacher shares one combined master schedule — see
    // list_master_class_schedules/list_master_class_meetings
    // (supabase/migrations/20240122000000_shared_teacher_schedule.sql).
    // These bypass RLS internally (is_teacher()-gated), so this is the
    // only place that reads every class in the program regardless of
    // who owns it, rather than broadening table-level RLS everywhere.
    const [{ data: masterSchedules }, { data: masterMeetings }] = await Promise.all([
      supabase.rpc("list_master_class_schedules"),
      supabase.rpc("list_master_class_meetings"),
    ]);

    const rawSchedules = (masterSchedules as MasterScheduleRow[] | null) ?? [];
    const rawMeetings = (masterMeetings as MasterMeetingRow[] | null) ?? [];

    for (const r of [...rawSchedules, ...rawMeetings]) {
      if (r.teacher_id && r.teacher_name) teacherMap[r.teacher_id] = r.teacher_name;
      if (r.student_names && r.student_names.length > 0) studentsByClass[r.class_id] = r.student_names;
    }

    schedules = rawSchedules.map((r) => ({
      id: r.id,
      class_id: r.class_id,
      day_of_week: r.day_of_week,
      start_time: r.start_time,
      end_time: r.end_time,
      timezone: r.timezone,
      meeting_provider: r.meeting_provider,
      meeting_link: r.meeting_link,
      location: r.location,
      classes: { name: r.class_name, subject: r.subject, teacher_id: r.teacher_id },
    }));

    meetings = rawMeetings.map((r) => ({
      id: r.id,
      class_id: r.class_id,
      title: r.title,
      meeting_date: r.meeting_date,
      start_time: r.start_time,
      end_time: r.end_time,
      timezone: r.timezone,
      meeting_provider: r.meeting_provider,
      meeting_link: r.meeting_link,
      location: r.location,
      status: r.status,
      classes: { name: r.class_name, subject: r.subject, teacher_id: r.teacher_id },
    }));
  } else {
    // Students keep seeing only their own enrolled classes — unchanged
    // from before, still enforced by the existing per-row RLS.
    const [{ data: schedulesData }, { data: meetingsData }] = await Promise.all([
      supabase
        .from("class_schedules")
        .select(
          "id, class_id, day_of_week, start_time, end_time, timezone, meeting_provider, meeting_link, location, classes ( name, subject, teacher_id )"
        ),
      supabase
        .from("class_meetings")
        .select(
          "id, class_id, title, meeting_date, start_time, end_time, timezone, meeting_provider, meeting_link, location, status, classes ( name, subject, teacher_id )"
        ),
    ]);

    schedules = (schedulesData as unknown as RawClassSchedule[]) ?? [];
    meetings = (meetingsData as unknown as RawClassMeeting[]) ?? [];

    const teacherIds = [
      ...new Set(
        [...schedules, ...meetings]
          .map((s) => s.classes?.teacher_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    if (teacherIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds);
      teacherMap = Object.fromEntries(
        (profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])
      );
    }
  }

  const todayISO = todayISODateInTimezone();

  return (
    <div>
      <TopBar
        title="Schedule"
        initials={getInitials(profile?.first_name, profile?.last_name)}
      />

      <ScheduleView
        schedules={schedules}
        meetings={meetings}
        teacherMap={teacherMap}
        studentsByClass={studentsByClass}
        isTeacher={isTeacher}
        viewerTeacherId={isTeacher ? profile?.id ?? null : null}
        todayISO={todayISO}
      />
    </div>
  );
}
