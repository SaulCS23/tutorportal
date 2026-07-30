import SectionHeading from "@/components/ui/SectionHeading";
import type { AttendanceAlert } from "@/lib/attendanceStats";

/** Teacher dashboard's "who needs a nudge" list — students below an
 *  80% attendance rate across the teacher's own classes. Pure display,
 *  server-renderable, no interactivity. */
export default function AttendanceAlertsCard({ alerts }: { alerts: AttendanceAlert[] }) {
  return (
    <section aria-labelledby="attendance-alerts-heading">
      <SectionHeading title="Attendance Alerts" id="attendance-alerts-heading" />
      {alerts.length === 0 ? (
        <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6 text-center text-sm text-muted-text">
          All students are attending well.
        </div>
      ) : (
        <ul
          className="bg-card-bg border border-soft-border rounded-2xl shadow-card divide-y divide-soft-border"
          role="list"
        >
          {alerts.map((a) => (
            <li
              key={a.studentId}
              className="flex items-center justify-between gap-3 px-5 py-3.5 first:rounded-t-2xl last:rounded-b-2xl"
            >
              <span className="text-sm font-medium text-dark-text truncate">{a.name}</span>
              <span className="text-sm font-semibold text-red-500 shrink-0">
                {a.tally.rate}% attendance
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
