import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { getMeetingStartInstant, formatZonedTime } from "@/lib/timezone";
import { useViewerTimezone } from "@/components/timezone/TimezoneProvider";
import StatusBadge from "@/components/ui/StatusBadge";
import type { ScheduleItem } from "./scheduleItems";

export default function UpcomingMeetings({
  items,
  isTeacher,
  teacherMap,
  onOpenMeeting,
}: {
  items: ScheduleItem[];
  isTeacher: boolean;
  teacherMap: Record<string, string>;
  onOpenMeeting?: (item: ScheduleItem) => void;
}) {
  const viewerTimezone = useViewerTimezone();

  return (
    <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-5">
      <h2 className="text-base font-bold text-dark-text mb-3">Upcoming</h2>

      {items.length === 0 ? (
        <p className="text-sm text-muted-text py-2">No upcoming meetings.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-soft-border" role="list">
          {items.map((item) => {
            const classHref = isTeacher
              ? `/teacher/classes/${item.classId}`
              : `/classes/${item.classId}`;
            const teacherName = item.teacherId ? teacherMap[item.teacherId] : null;

            // Absolute start instant, converted to the viewer's own
            // timezone for both the day badge and the time — the
            // calendar date itself can shift by a day depending on the
            // viewer's zone, so this is never derived from the raw
            // stored item.date/item.startTime strings directly.
            const startInstant = getMeetingStartInstant({
              meeting_date: item.date,
              start_time: item.startTime,
              timezone: item.timezone,
            });
            const weekdayLabel = formatInTimeZone(startInstant, viewerTimezone, "EEE");
            const dayOfMonthLabel = formatInTimeZone(startInstant, viewerTimezone, "d");
            const timeLabel = formatZonedTime(startInstant.toISOString(), viewerTimezone);

            const rowContent = (
              <>
                <div className="w-12 shrink-0 text-center">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                    {weekdayLabel}
                  </p>
                  <p className="text-lg font-bold text-dark-text">{dayOfMonthLabel}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-text">{timeLabel}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-dark-text truncate">
                      {item.title ?? item.className}
                    </p>
                    {item.status === "group_pending_reschedule" && (
                      <StatusBadge status={item.status} />
                    )}
                  </div>
                  {!isTeacher && teacherName && (
                    <p className="text-xs text-muted-text truncate">with {teacherName}</p>
                  )}
                </div>
                <ChevronRight
                  size={16}
                  className="text-muted-text shrink-0"
                  aria-hidden="true"
                />
              </>
            );
            const rowCls =
              "flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-slate-50 transition-colors w-full text-left";

            return (
              <li key={item.id}>
                {onOpenMeeting ? (
                  <button type="button" onClick={() => onOpenMeeting(item)} className={rowCls}>
                    {rowContent}
                  </button>
                ) : (
                  <Link href={classHref} className={rowCls}>
                    {rowContent}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
