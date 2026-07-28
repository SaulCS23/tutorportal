import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatTime, parseLocalISODate } from "@/lib/utils";
import type { ScheduleItem } from "./scheduleItems";

export default function UpcomingMeetings({
  items,
  isTeacher,
  teacherMap,
}: {
  items: ScheduleItem[];
  isTeacher: boolean;
  teacherMap: Record<string, string>;
}) {
  return (
    <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-5">
      <h2 className="text-base font-bold text-dark-text mb-3">Upcoming</h2>

      {items.length === 0 ? (
        <p className="text-sm text-muted-text py-2">No upcoming meetings.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-soft-border" role="list">
          {items.map((item) => {
            const date = parseLocalISODate(item.date);
            const classHref = isTeacher
              ? `/teacher/classes/${item.classId}`
              : `/classes/${item.classId}`;
            const teacherName = item.teacherId ? teacherMap[item.teacherId] : null;

            return (
              <li key={item.id}>
                <Link
                  href={classHref}
                  className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="w-12 shrink-0 text-center">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                      {date?.toLocaleDateString("en-US", { weekday: "short" }) ?? ""}
                    </p>
                    <p className="text-lg font-bold text-dark-text">{date?.getDate() ?? "—"}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-text">{formatTime(item.startTime)}</p>
                    <p className="text-sm font-semibold text-dark-text truncate">
                      {item.title ?? item.className}
                    </p>
                    {!isTeacher && teacherName && (
                      <p className="text-xs text-muted-text truncate">with {teacherName}</p>
                    )}
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-muted-text shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
