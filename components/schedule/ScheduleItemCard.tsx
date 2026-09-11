import Link from "next/link";
import { MapPin, Link as LinkIcon } from "lucide-react";
import { isSafeUrl } from "@/lib/utils";
import { getMeetingStartInstant, formatZonedTime } from "@/lib/timezone";
import { useViewerTimezone } from "@/components/timezone/TimezoneProvider";
import StatusBadge from "@/components/ui/StatusBadge";
import JoinMeetingLink from "./JoinMeetingLink";
import { clickableCardProps, stopCardClick, CLICKABLE_CARD_CLASSES } from "@/lib/clickableCard";
import TakeClassButton from "./TakeClassButton";
import ReleaseClassButton from "./ReleaseClassButton";
import type { ScheduleItem } from "./scheduleItems";

export default function ScheduleItemCard({
  item,
  isTeacher,
  teacherName,
  studentNames = [],
  viewerTeacherId = null,
  onOpenMeeting,
}: {
  item: ScheduleItem;
  isTeacher: boolean;
  teacherName?: string | null;
  /** Enrolled student names, teacher (master schedule) view only. */
  studentNames?: string[];
  /** The viewing teacher's own profile id, to tell their own class apart
   *  from another teacher's (or an unassigned) class on the shared
   *  master schedule. Always null for students. */
  viewerTeacherId?: string | null;
  /** When provided (student view only), clicking a real meeting's card
   *  opens the meeting detail modal instead of navigating to the class
   *  page — schedule-template projections have no real meeting to
   *  manage, so they keep linking to the class page regardless. */
  onOpenMeeting?: (item: ScheduleItem) => void;
}) {
  const isCancelled = item.status === "cancelled";
  const isPendingReschedule = item.status === "group_pending_reschedule";
  const heading = item.title ?? item.className;
  const showClassName = item.title !== null && item.className !== heading;
  const safeLink = isSafeUrl(item.meetingLink) ? item.meetingLink! : null;
  // A teacher only has a working management page for a class they own —
  // another teacher's (or an unassigned) class on the shared master
  // schedule has nowhere to land, so the class name stays plain text.
  const isOwnClass = !isTeacher || item.teacherId === viewerTeacherId;
  const classHref = isOwnClass
    ? isTeacher
      ? `/teacher/classes/${item.classId}`
      : `/classes/${item.classId}`
    : null;
  const canOpenMeeting = Boolean(onOpenMeeting) && item.source === "meeting";
  const isUnassigned = item.teacherId === null;

  const teacherLine = isTeacher ? (
    <p className="text-xs text-muted-text mt-0.5">
      Teacher:{" "}
      {teacherName ?? <span className="text-amber-600 font-medium">Unassigned</span>}
    </p>
  ) : (
    teacherName && <p className="text-xs text-muted-text mt-0.5">with {teacherName}</p>
  );

  const studentsLine = isTeacher && studentNames.length > 0 && (
    <p className="text-xs text-muted-text mt-0.5 truncate">
      Students: {studentNames.join(", ")}
    </p>
  );

  // Real meetings offer "Take Class"/"Release Class" from inside the
  // detail modal instead — putting them here too would be a redundant,
  // easy-to-misclick duplicate action on the same card.
  const takeClassRow = isTeacher && isUnassigned && !canOpenMeeting && (
    <TakeClassButton classId={item.classId} className="mt-1.5" />
  );
  const releaseClassRow = isTeacher && isOwnClass && !canOpenMeeting && (
    <ReleaseClassButton classId={item.classId} className="mt-1.5" />
  );

  // Viewer-local start time — computed from the absolute instant, not
  // the raw stored wall-clock string, so a viewer in a different
  // timezone than the item's own sees their own local clock time.
  const viewerTimezone = useViewerTimezone();
  const startTimeLabel = formatZonedTime(
    getMeetingStartInstant({
      meeting_date: item.date,
      start_time: item.startTime,
      timezone: item.timezone,
    }).toISOString(),
    viewerTimezone
  );

  // Only a real class_meetings row has a genuine meeting id to attribute
  // a join to — a schedule-template projection's `id` is a synthetic
  // `schedule-...` string, so its Join link stays a plain anchor.
  const joinAnchorClassName =
    "inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark transition-colors";
  const joinLabel = (
    <>
      <LinkIcon size={11} aria-hidden="true" />
      {item.meetingProvider === "Google Meet" ? "Join Google Meet" : "Join Meeting"}
    </>
  );

  const joinRow = (item.location || safeLink) && (
    <div className="flex flex-wrap items-center gap-3 mt-2">
      {item.location && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-text">
          <MapPin size={11} aria-hidden="true" />
          {item.location}
        </span>
      )}
      {safeLink && item.source === "meeting" ? (
        <JoinMeetingLink
          meetingId={item.id}
          href={safeLink}
          onClick={stopCardClick}
          className={joinAnchorClassName}
        >
          {joinLabel}
        </JoinMeetingLink>
      ) : (
        safeLink && (
          <a
            href={safeLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stopCardClick}
            className={joinAnchorClassName}
          >
            {joinLabel}
          </a>
        )
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
        {...clickableCardProps(() => onOpenMeeting!(item), `Open meeting details: ${heading}`)}
        className={`rounded-xl px-4 py-3 border-l-4 ${CLICKABLE_CARD_CLASSES} ${
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
              {startTimeLabel}
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
            {isPendingReschedule && <StatusBadge status={item.status!} />}
          </div>
          {showClassName && (
            classHref ? (
              <Link
                href={classHref}
                onClick={stopCardClick}
                className="text-xs text-primary hover:underline mt-0.5 inline-block"
              >
                {item.className}
              </Link>
            ) : (
              <p className="text-xs text-muted-text mt-0.5">{item.className}</p>
            )
          )}
          {teacherLine}
          {studentsLine}
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
            {startTimeLabel}
          </span>
          {classHref ? (
            <Link
              href={classHref}
              className={`text-sm font-semibold hover:underline ${
                isCancelled ? "text-muted-text line-through" : "text-dark-text"
              }`}
            >
              {heading}
            </Link>
          ) : (
            <span
              className={`text-sm font-semibold ${
                isCancelled ? "text-muted-text line-through" : "text-dark-text"
              }`}
            >
              {heading}
            </span>
          )}
          {isCancelled && (
            <span className="text-xs font-medium text-red-500 uppercase tracking-wide">
              Cancelled
            </span>
          )}
          {isPendingReschedule && <StatusBadge status={item.status!} />}
        </div>
        {showClassName && (
          <p className="text-xs text-muted-text mt-0.5">{item.className}</p>
        )}
        {teacherLine}
        {studentsLine}
        {takeClassRow}
        {releaseClassRow}
      </div>
      {joinRow}
    </li>
  );
}
