"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronDown } from "lucide-react";
import RemoveStudentButton from "@/components/classes/RemoveStudentButton";
import AttendanceHistoryList from "@/components/schedule/AttendanceHistoryList";
import { useViewerTimezone } from "@/components/timezone/TimezoneProvider";
import type { AttendanceHistoryEntry, AttendanceTally } from "@/lib/attendanceStats";
import { clickableCardProps, stopCardClick, CLICKABLE_CARD_CLASSES } from "@/lib/clickableCard";

/**
 * The existing roster row (name/email/joined date/Remove button),
 * extended with a click-to-expand attendance summary + history — no
 * separate student-detail page or analytics view, just this row opening
 * up in place on the existing Students tab.
 */
export default function StudentAttendanceRow({
  classId,
  studentId,
  fullName,
  email,
  joinedAt,
  tally,
  history,
}: {
  classId: string;
  studentId: string;
  fullName: string;
  email: string;
  joinedAt: string;
  tally: AttendanceTally;
  history: AttendanceHistoryEntry[];
}) {
  const [expanded, setExpanded] = useState(false);
  const viewerTimezone = useViewerTimezone();
  const displayName = fullName || "Unknown Student";
  const formatDate = (iso: string) => formatInTimeZone(new Date(iso), viewerTimezone, "MMM d, yyyy");

  return (
    <li className="first:rounded-t-2xl last:rounded-b-2xl overflow-hidden">
      <div
        {...clickableCardProps(
          () => setExpanded((v) => !v),
          `${expanded ? "Hide" : "Show"} attendance history for ${displayName}`
        )}
        className={`flex items-center justify-between gap-4 px-5 py-3.5 ${CLICKABLE_CARD_CLASSES}`}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-dark-text truncate">{displayName}</p>
          <p className="text-xs text-muted-text truncate">{email}</p>
          <p className="text-xs text-muted-text">Joined {formatDate(joinedAt)}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {tally.total > 0 ? (
            <span className="text-xs font-semibold text-dark-text">{tally.rate}% attendance</span>
          ) : (
            <span className="text-xs text-muted-text">No attendance yet</span>
          )}
          <div onClick={stopCardClick}>
            <RemoveStudentButton classId={classId} studentId={studentId} studentName={displayName} />
          </div>
          <ChevronDown
            size={16}
            className={`text-muted-text transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-soft-border px-5 py-4 bg-slate-50/60 flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-green-600">{tally.present}</p>
              <p className="text-xs text-muted-text">Present</p>
            </div>
            <div>
              <p className="text-lg font-bold text-orange-500">{tally.late}</p>
              <p className="text-xs text-muted-text">Late</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-500">{tally.absent}</p>
              <p className="text-xs text-muted-text">Absent</p>
            </div>
            <div>
              <p className="text-lg font-bold text-dark-text">{tally.rate}%</p>
              <p className="text-xs text-muted-text">Rate</p>
            </div>
          </div>
          <AttendanceHistoryList entries={history} isTeacher showClassName={false} />
        </div>
      )}
    </li>
  );
}
