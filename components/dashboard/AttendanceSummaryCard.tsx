import SectionHeading from "@/components/ui/SectionHeading";
import type { AttendanceTally } from "@/lib/attendanceStats";

/** Student dashboard's own "how am I doing" attendance rollup — pure
 *  display, server-renderable, no interactivity. */
export default function AttendanceSummaryCard({ tally }: { tally: AttendanceTally }) {
  return (
    <section aria-labelledby="attendance-heading">
      <SectionHeading title="Attendance" id="attendance-heading" />
      <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-5">
        {tally.total === 0 ? (
          <p className="text-sm text-muted-text text-center py-2">No attendance recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-xs text-muted-text">Present</dt>
                <dd className="text-xl font-bold text-green-600">{tally.present}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-text">Absent</dt>
                <dd className="text-xl font-bold text-red-500">{tally.absent}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-text">Late</dt>
                <dd className="text-xl font-bold text-orange-500">{tally.late}</dd>
              </div>
            </dl>
            <div className="border-t border-soft-border pt-3 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-text">Attendance Rate</span>
              <span className="text-lg font-bold text-dark-text">{tally.rate}%</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
