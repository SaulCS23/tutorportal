import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import { getInitials, todayISODateInTimezone } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";
import ScheduleView from "@/components/schedule/ScheduleView";
import type { RawClassSchedule, RawClassMeeting } from "@/components/schedule/scheduleItems";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const profile = await getCurrentProfile();
  const isTeacher = profile?.role === "teacher";
  const supabase = await createClient();

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

  const schedules = (schedulesData as unknown as RawClassSchedule[]) ?? [];
  const meetings = (meetingsData as unknown as RawClassMeeting[]) ?? [];

  // For student view, batch-load teacher names (schedules + meetings combined)
  let teacherMap: Record<string, string> = {};
  if (!isTeacher) {
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
        isTeacher={isTeacher}
        todayISO={todayISO}
      />
    </div>
  );
}
