import Link from "next/link";
import { MapPin, Link as LinkIcon } from "lucide-react";
import { formatTime, isSafeUrl } from "@/lib/utils";
import type { ScheduleItem } from "./scheduleItems";

export default function ScheduleItemCard({
  item,
  isTeacher,
  teacherName,
  onOpenMeeting,
}: {
  item: ScheduleItem;
  isTeacher: boolean;
  teacherName?: string | null;
  /** When provided (student view only), clicking a real meeting's card
   *  opens the meeting detail modal instead of navigating to the class
   *  page — schedule-template projections have no real meeting to
   *  manage, so they keep linking to the class page regardless. */
  onOpenMeeting?: (item: ScheduleItem) => void;
}) {
  const isCancelled = item.status === "cancelled";
  const heading = item.title ?? item.className;
  const showClassName = item.title !== null && item.className !== heading;
  const safeLink = isSafeUrl(item.meetingLink) ? item.meetingLink! : null;
  const classHref = isTeacher ? `/teacher/classes/${item.classId}` : `/classes/${item.classId}`;
  const canOpenMeeting = Boolean(onOpenMeeting) && item.source === "meeting";

  // The class-name link and the Join Meeting link are nested inside the
  // card, which (when canOpenMeeting) is itself a click target for the
  // modal — without stopping propagation here, clicking either would
  // also bubble up and open the modal, or (worse, if a card ever became
  // an ancestor <Link>) drag the browser to the class page instead of
  // just following the link that was actually clicked.
  function stopBubble(e: React.MouseEvent) {
    e.stopPropagation();
  }

  const joinRow = (item.location || safeLink) && (
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
          onClick={stopBubble}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark transition-colors"
        >
          <LinkIcon size={11} aria-hidden="true" />
          {item.meetingProvider === "Google Meet" ? "Join Google Meet" : "Join Meeting"}
        </a>
      )}
    </div>
  );

  if (canOpenMeeting) {
    // The whole card (not just the title text) is the click target for
    // opening the modal. It is deliberately a <li role="button"> rather
    // than a real <button> or <Link> wrapper: it still needs to contain
    // the nested class-name and Join Meeting <a> tags below, and a real
    // <button>/<a> cannot legally contain another interactive element —
    // browsers handle that invalid nesting inconsistently, which is
    // exactly the kind of "click lands somewhere unexpected" bug this is
    // guarding against.
    return (
      <li
        role="button"
        tabIndex={0}
        onClick={() => onOpenMeeting!(item)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenMeeting!(item);
          }
        }}
        className={`rounded-xl px-4 py-3 border-l-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary ${
          isCancelled ? "bg-slate-50 border-slate-300" : "bg-primary/5 border-primary"
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className={`text-sm font-semibold shrink-0 ${
                isCancelled ? "text-muted-text" : "text-primary"
              }`}
            >
              {formatTime(item.startTime)}
            </span>
            <span
              className={`text-sm font-semibold ${
                isCancelled ? "text-muted-text line-through" : "text-dark-text"
              }`}
            >
              {heading}
            </span>
            {isCancelled && (
              <span className="text-xs font-medium text-red-500 uppercase tracking-wide">
                Cancelled
              </span>
            )}
          </div>
          {showClassName && (
            <Link
              href={classHref}
              onClick={stopBubble}
              className="text-xs text-primary hover:underline mt-0.5 inline-block"
            >
              {item.className}
            </Link>
          )}
          {!isTeacher && teacherName && (
            <p className="text-xs text-muted-text mt-0.5">with {teacherName}</p>
          )}
        </div>
        {joinRow}
      </li>
    );
  }

  return (
    <li
      className={`rounded-xl px-4 py-3 border-l-4 ${
        isCancelled ? "bg-slate-50 border-slate-300" : "bg-primary/5 border-primary"
      }`}
    >
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
      {joinRow}
    </li>
  );
}
