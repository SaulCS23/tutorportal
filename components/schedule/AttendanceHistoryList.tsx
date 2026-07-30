"use client";

import { useState } from "react";
import { ATTENDANCE_STATUS_LABEL, ATTENDANCE_STATUS_CLASSES, formatJoinedAt } from "@/lib/attendance";
import { clickableCardProps, CLICKABLE_CARD_CLASSES } from "@/lib/clickableCard";
import { getMeetingStartInstant, formatZonedDate, formatZonedTime } from "@/lib/timezone";
import { useViewerTimezone } from "@/components/timezone/TimezoneProvider";
import MeetingDetailModal from "./MeetingDetailModal";
import type { ScheduleItem } from "./scheduleItems";
import type { AttendanceHistoryEntry } from "@/lib/attendanceStats";

function entryToScheduleItem(entry: AttendanceHistoryEntry): ScheduleItem {
  return {
    id: entry.meetingId,
    source: "meeting",
    classId: entry.classId,
    className: entry.className,
    subject: null,
    teacherId: null,
    date: entry.meetingDate,
    startTime: entry.startTime,
    endTime: entry.endTime,
    timezone: entry.timezone,
    status: entry.meetingStatus,
    title: entry.title,
    location: entry.location,
    meetingProvider: entry.meetingProvider,
    meetingLink: entry.meetingLink,
  };
}

/**
 * Chronological attendance history, shared by the teacher's per-student
 * roster view and the student's own account-page view — every entry is
 * always a real class_meetings row, so every row can open the existing
 * MeetingDetailModal (no separate detail UI, per the reuse requirement).
 */
export default function AttendanceHistoryList({
  entries,
  isTeacher,
  showClassName = false,
}: {
  entries: AttendanceHistoryEntry[];
  isTeacher: boolean;
  /** Show the class name next to the meeting title — on for the
   *  student's cross-class history, off for a teacher's single-class
   *  roster view where it would just repeat the current class. */
  showClassName?: boolean;
}) {
  const viewerTimezone = useViewerTimezone();
  const [openEntry, setOpenEntry] = useState<AttendanceHistoryEntry | null>(null);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-text py-2">No concluded meetings yet.</p>;
  }

  return (
    <>
      <ul className="flex flex-col gap-2" role="list">
        {entries.map((entry) => {
          const cardProps = clickableCardProps(
            () => setOpenEntry(entry),
            `Open meeting details: ${entry.title}`
          );
          // Absolute start instant, then formatted in the *viewer's* own
          // timezone — never the meeting's stored one, and never the raw
          // meetingDate/startTime strings directly (the calendar date
          // itself can shift by a day depending on the viewer's zone).
          const startIso = getMeetingStartInstant({
            meeting_date: entry.meetingDate,
            start_time: entry.startTime,
            timezone: entry.timezone,
          }).toISOString();
          return (
            <li
              key={entry.meetingId}
              {...cardProps}
              onClick={(e) => {
                // Stops this from also toggling an ancestor row (e.g. the
                // teacher roster's own expand/collapse) when this list is
                // nested inside one.
                e.stopPropagation();
                cardProps.onClick();
              }}
              className={`rounded-xl border border-soft-border px-3.5 py-2.5 flex items-center justify-between gap-3 ${CLICKABLE_CARD_CLASSES}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-dark-text truncate">
                  {entry.title}
                  {showClassName && (
                    <span className="text-muted-text font-normal"> · {entry.className}</span>
                  )}
                </p>
                <p className="text-xs text-muted-text mt-0.5">
                  {formatZonedDate(startIso, viewerTimezone)} · {formatZonedTime(startIso, viewerTimezone)}
                </p>
                <p className="text-xs text-muted-text mt-0.5">
                  {entry.joinedAt
                    ? `Joined ${formatJoinedAt(entry.joinedAt, viewerTimezone)}`
                    : "Never joined through TutorPortal"}
                  {" · "}
                  {entry.overridden ? "Teacher override" : "Automatically recorded"}
                </p>
              </div>
              <span
                className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ATTENDANCE_STATUS_CLASSES[entry.status]}`}
              >
                {ATTENDANCE_STATUS_LABEL[entry.status]}
              </span>
            </li>
          );
        })}
      </ul>

      {openEntry && (
        <MeetingDetailModal
          item={entryToScheduleItem(openEntry)}
          isTeacher={isTeacher}
          onClose={() => setOpenEntry(null)}
        />
      )}
    </>
  );
}
