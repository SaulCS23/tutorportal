import Link from "next/link";
import { MapPin, Link as LinkIcon } from "lucide-react";
import { formatTime, isSafeUrl } from "@/lib/utils";
import type { ScheduleItem } from "./scheduleItems";

export default function ScheduleItemCard({
  item,
  isTeacher,
  teacherName,
}: {
  item: ScheduleItem;
  isTeacher: boolean;
  teacherName?: string | null;
}) {
  const isCancelled = item.status === "cancelled";
  const heading = item.title ?? item.className;
  const showClassName = item.title !== null && item.className !== heading;
  const safeLink = isSafeUrl(item.meetingLink) ? item.meetingLink! : null;
  const classHref = isTeacher ? `/teacher/classes/${item.classId}` : `/classes/${item.classId}`;

  return (
    <li
      className={`rounded-xl px-4 py-3 border-l-4 ${
        isCancelled
          ? "bg-slate-50 border-slate-300"
          : "bg-primary/5 border-primary"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className={`text-sm font-semibold shrink-0 ${
                isCancelled ? "text-muted-text" : "text-primary"
              }`}
            >
              {formatTime(item.startTime)}
            </span>
            <Link
              href={classHref}
              className={`text-sm font-semibold hover:underline ${
                isCancelled ? "text-muted-text line-through" : "text-dark-text"
              }`}
            >
              {heading}
            </Link>
            {isCancelled && (
              <span className="text-xs font-medium text-red-500 uppercase tracking-wide">
                Cancelled
              </span>
            )}
          </div>
          {showClassName && (
            <p className="text-xs text-muted-text mt-0.5">{item.className}</p>
          )}
          {!isTeacher && teacherName && (
            <p className="text-xs text-muted-text mt-0.5">with {teacherName}</p>
          )}
        </div>
      </div>

      {(item.location || safeLink) && (
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {item.location && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-text">
              <MapPin size={11} aria-hidden="true" />
              {item.location}
            </span>
          )}
          {safeLink && (
            <a
              href={safeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark transition-colors"
            >
              <LinkIcon size={11} aria-hidden="true" />
              {item.meetingProvider === "Google Meet" ? "Join Google Meet" : "Join Meeting"}
            </a>
          )}
        </div>
      )}
    </li>
  );
}
