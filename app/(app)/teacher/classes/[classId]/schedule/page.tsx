import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DAY_NAMES, formatTime } from "@/lib/utils";
import type { ClassSchedule } from "@/lib/supabase/helpers";
import CreateScheduleForm from "@/components/teacher/schedule/CreateScheduleForm";
import ScheduleCard from "@/components/teacher/schedule/ScheduleCard";

export const metadata: Metadata = { title: "Schedule" };

type Props = { params: Promise<{ classId: string }> };

export default async function TeacherSchedulePage({ params }: Props) {
  const { classId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("class_schedules")
    .select(
      "id, class_id, day_of_week, start_time, end_time, timezone, meeting_provider, meeting_link, meeting_id, meeting_passcode, location, created_at, updated_at"
    )
    .eq("class_id", classId)
    .order("day_of_week")
    .order("start_time");

  const schedules = (data as ClassSchedule[]) ?? [];

  // Group by day_of_week for display
  const grouped = new Map<number, ClassSchedule[]>();
  for (const s of schedules) {
    const day = s.day_of_week;
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(s);
  }
  const sortedDays = [...grouped.keys()].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-6">
      <CreateScheduleForm classId={classId} />

      {schedules.length === 0 ? (
        <div className="bg-card-bg border border-soft-border rounded-2xl p-8 text-sm text-muted-text text-center shadow-card">
          No meeting times yet. Add your first one above.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {sortedDays.map((day) => (
            <section key={day} aria-labelledby={`day-${day}`}>
              <h2
                id={`day-${day}`}
                className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
              >
                {DAY_NAMES[day]}
              </h2>
              <ul className="flex flex-col gap-3" role="list">
                {grouped.get(day)!.map((s) => (
                  <li key={s.id}>
                    <ScheduleCard schedule={s} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Summary table for quick reference */}
      {schedules.length > 0 && (
        <section aria-labelledby="summary-heading" className="mt-2">
          <h2
            id="summary-heading"
            className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
          >
            Weekly Summary
          </h2>
          <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-soft-border">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-text">
                    Day
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-text">
                    Time
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-text hidden sm:table-cell">
                    Provider
                  </th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-soft-border last:border-0"
                  >
                    <td className="px-4 py-2.5 font-medium text-dark-text">
                      {DAY_NAMES[s.day_of_week]}
                    </td>
                    <td className="px-4 py-2.5 text-muted-text">
                      {formatTime(s.start_time)} – {formatTime(s.end_time)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-text hidden sm:table-cell">
                      {s.meeting_provider ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
