"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useViewerTimezone } from "@/components/timezone/TimezoneProvider";
import {
  getOwnAttendance,
  getMeetingAttendance,
  setMeetingAttendance,
  getMeetingEndsAt,
  effectiveAttendanceStatus,
  formatJoinedAt,
  ATTENDANCE_STATUS_LABEL as STATUS_LABEL,
  ATTENDANCE_STATUS_CLASSES as STATUS_CLASSES,
  type AttendanceRecord,
  type AttendanceStatus,
} from "@/lib/attendance";

const OVERRIDE_OPTIONS: Exclude<AttendanceStatus, "pending">[] = ["present", "late", "absent"];

type RosterEntry = { studentId: string; name: string; record: AttendanceRecord | null };

export default function AttendanceSection({
  meetingId,
  classId,
  isTeacher,
  refreshKey,
}: {
  meetingId: string;
  classId: string;
  isTeacher: boolean;
  /** Bump this (e.g. after a successful Join) to force a refetch without
   *  remounting the section — see JoinMeetingLink's onJoined. */
  refreshKey?: number;
}) {
  // joined_at is always shown in the current viewer's own timezone, not
  // the meeting's — a Denver teacher and a Panama student reviewing the
  // same join see their own local clock time (requirement 9).
  const viewerTimezone = useViewerTimezone();
  const [loading, setLoading] = useState(true);
  const [meetingHasEnded, setMeetingHasEnded] = useState(false);
  const [ownRecord, setOwnRecord] = useState<AttendanceRecord | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const endsAt = await getMeetingEndsAt(supabase, meetingId);
      const hasEnded = endsAt ? new Date() >= new Date(endsAt) : false;

      if (isTeacher) {
        const [{ data: meetingRow }, { data: members }, { data: records }] = await Promise.all([
          supabase
            .from("class_meetings")
            .select("restricted_to_student_id")
            .eq("id", meetingId)
            .maybeSingle(),
          supabase
            .from("class_members")
            .select("student_id, profiles ( full_name )")
            .eq("class_id", classId),
          getMeetingAttendance(supabase, meetingId),
        ]);
        if (cancelled) return;

        const restrictedTo = (meetingRow as { restricted_to_student_id: string | null } | null)
          ?.restricted_to_student_id;
        const byStudent = new Map(records.map((r) => [r.student_id, r]));
        const allMembers =
          (members as unknown as { student_id: string; profiles: { full_name: string } | null }[]) ?? [];
        const filtered = restrictedTo
          ? allMembers.filter((m) => m.student_id === restrictedTo)
          : allMembers;

        setRoster(
          filtered.map((m) => ({
            studentId: m.student_id,
            name: m.profiles?.full_name ?? "Unknown Student",
            record: byStudent.get(m.student_id) ?? null,
          }))
        );
      } else {
        const { data } = await getOwnAttendance(supabase, meetingId);
        if (cancelled) return;
        setOwnRecord(data);
      }

      setMeetingHasEnded(hasEnded);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // refreshKey is intentionally in the dependency list with no other
    // purpose than to force this effect to re-run after a successful
    // Join — see the refreshKey prop doc above.
  }, [meetingId, classId, isTeacher, refreshKey]);

  async function handleOverride(studentId: string, status: Exclude<AttendanceStatus, "pending">) {
    setSavingId(studentId);
    const supabase = createClient();
    const { error } = await setMeetingAttendance(supabase, meetingId, studentId, status);
    setSavingId(null);
    if (error) return;
    setRoster((prev) =>
      prev.map((entry) =>
        entry.studentId === studentId
          ? {
              ...entry,
              record: {
                student_id: studentId,
                attendance_status: status,
                joined_at: entry.record?.joined_at ?? null,
                attendance_overridden: true,
                attendance_updated_by: entry.record?.attendance_updated_by ?? null,
              },
            }
          : entry
      )
    );
    setToast("Attendance updated.");
    setTimeout(() => setToast(""), 2500);
  }

  if (loading) {
    return (
      <div className="border-t border-soft-border pt-4">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">
          Attendance
        </p>
        <p className="text-sm text-muted-text">Loading attendance…</p>
      </div>
    );
  }

  if (!isTeacher) {
    const status = effectiveAttendanceStatus(ownRecord, meetingHasEnded);
    return (
      <div className="border-t border-soft-border pt-4">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">
          Attendance
        </p>
        {status === "pending" ? (
          <p className="text-sm text-muted-text">Attendance has not been recorded yet.</p>
        ) : (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-soft-border pt-4 flex flex-col gap-3">
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Attendance</p>

      {roster.length === 0 ? (
        <p className="text-sm text-muted-text">No students enrolled.</p>
      ) : (
        roster.map((entry) => {
          const status = effectiveAttendanceStatus(entry.record, meetingHasEnded);
          return (
            <div
              key={entry.studentId}
              className="flex flex-col gap-1.5 rounded-xl border border-soft-border px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium text-dark-text">{entry.name}</p>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[status]}`}
                >
                  {STATUS_LABEL[status]}
                </span>
              </div>
              {!entry.record?.attendance_overridden && (
                <p className="text-xs text-muted-text">Automatically recorded.</p>
              )}
              <p className="text-xs text-muted-text">
                {entry.record?.joined_at
                  ? `Student joined: ${formatJoinedAt(entry.record.joined_at, viewerTimezone)}`
                  : "Student never joined through TutorPortal."}
              </p>
              <div
                className="flex gap-1.5 pt-1"
                role="group"
                aria-label={`Override attendance for ${entry.name}`}
              >
                {OVERRIDE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={savingId === entry.studentId}
                    onClick={() => handleOverride(entry.studentId, opt)}
                    aria-pressed={status === opt}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 ${
                      status === opt
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-muted-text hover:bg-slate-200"
                    }`}
                  >
                    {STATUS_LABEL[opt]}
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}

      {toast && (
        <p
          role="status"
          className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2"
        >
          {toast}
        </p>
      )}
    </div>
  );
}
