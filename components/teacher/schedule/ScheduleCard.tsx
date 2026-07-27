"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Pencil, X, Link as LinkIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DAY_NAMES, formatTime, isSafeUrl } from "@/lib/utils";
import CopyButton from "@/components/ui/CopyButton";
import DeleteScheduleButton from "./DeleteScheduleButton";
import type { ClassSchedule } from "@/lib/supabase/helpers";

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const PROVIDER_OPTIONS = [
  { value: "Google Meet", label: "Google Meet" },
  { value: "Zoom", label: "Zoom" },
  { value: "Microsoft Teams", label: "Microsoft Teams" },
  { value: "Other", label: "Other" },
  { value: "In person", label: "In person" },
];

const TIMEZONE_OPTIONS = [
  { value: "America/Panama", label: "America/Panama (UTC-5)" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Denver", label: "America/Denver" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "America/Bogota", label: "America/Bogota" },
  { value: "America/Lima", label: "America/Lima" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Madrid", label: "Europe/Madrid" },
  { value: "UTC", label: "UTC" },
];

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";

export default function ScheduleCard({ schedule }: { schedule: ClassSchedule }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  // Edit form state — initialised from the current schedule
  const [dayOfWeek, setDayOfWeek] = useState(String(schedule.day_of_week));
  const [startTime, setStartTime] = useState(schedule.start_time.slice(0, 5)); // "HH:MM"
  const [endTime, setEndTime] = useState(schedule.end_time.slice(0, 5));
  const [timezone, setTimezone] = useState(schedule.timezone);
  const [provider, setProvider] = useState(schedule.meeting_provider ?? "");
  const [meetingLink, setMeetingLink] = useState(schedule.meeting_link ?? "");
  const [meetingId, setMeetingId] = useState(schedule.meeting_id ?? "");
  const [passcode, setPasscode] = useState(schedule.meeting_passcode ?? "");
  const [location, setLocation] = useState(schedule.location ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function cancelEdit() {
    setDayOfWeek(String(schedule.day_of_week));
    setStartTime(schedule.start_time.slice(0, 5));
    setEndTime(schedule.end_time.slice(0, 5));
    setTimezone(schedule.timezone);
    setProvider(schedule.meeting_provider ?? "");
    setMeetingLink(schedule.meeting_link ?? "");
    setMeetingId(schedule.meeting_id ?? "");
    setPasscode(schedule.meeting_passcode ?? "");
    setLocation(schedule.location ?? "");
    setError("");
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!startTime) { setError("Start time is required."); return; }
    if (!endTime) { setError("End time is required."); return; }
    if (endTime <= startTime) { setError("End time must be after start time."); return; }

    if (meetingLink.trim()) {
      try {
        const u = new URL(meetingLink.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          setError("Meeting link must be an http or https URL.");
          return;
        }
      } catch {
        setError("Meeting link is not a valid URL.");
        return;
      }
    }

    setLoading(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("class_schedules")
      .update({
        day_of_week: parseInt(dayOfWeek, 10),
        start_time: startTime,
        end_time: endTime,
        timezone,
        meeting_provider: provider.trim() || null,
        meeting_link: meetingLink.trim() || null,
        meeting_id: meetingId.trim() || null,
        meeting_passcode: passcode.trim() || null,
        location: location.trim() || null,
      })
      .eq("id", schedule.id);

    setLoading(false);
    if (dbError) {
      if (dbError.code === "23505") {
        setError("A schedule for this class already exists on that day at that time.");
      } else {
        setError(dbError.message);
      }
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const isInPerson = (editing ? provider : schedule.meeting_provider) === "In person";
  const safeLink = isSafeUrl(schedule.meeting_link) ? schedule.meeting_link! : null;

  return (
    <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card overflow-hidden">
      {/* Header (always visible) */}
      <div className="flex items-start gap-3 px-5 py-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
          <Clock size={14} className="text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-dark-text">
            {DAY_NAMES[schedule.day_of_week]}
          </p>
          <p className="text-xs text-muted-text mt-0.5">
            {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}{" "}
            <span className="text-slate-400">({schedule.timezone})</span>
          </p>
          {schedule.meeting_provider && (
            <p className="text-xs text-muted-text mt-0.5">{schedule.meeting_provider}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => (editing ? cancelEdit() : setEditing(true))}
          aria-label={editing ? "Cancel edit" : "Edit schedule"}
          className="p-1.5 text-muted-text hover:text-dark-text hover:bg-slate-100 rounded-lg transition-colors shrink-0"
        >
          {editing ? (
            <X size={15} aria-hidden="true" />
          ) : (
            <Pencil size={15} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Display details (non-edit) */}
      {!editing &&
        (schedule.meeting_id ||
          schedule.meeting_passcode ||
          schedule.location ||
          safeLink) && (
          <div className="border-t border-soft-border px-5 py-3 flex flex-col gap-2">
            {schedule.location && (
              <p className="text-xs text-muted-text">
                <span className="font-medium text-dark-text">Location:</span>{" "}
                {schedule.location}
              </p>
            )}
            {schedule.meeting_id && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-text">
                  <span className="font-medium text-dark-text">Meeting ID:</span>{" "}
                  {schedule.meeting_id}
                </p>
                <CopyButton text={schedule.meeting_id} label="meeting ID" />
              </div>
            )}
            {schedule.meeting_passcode && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-text">
                  <span className="font-medium text-dark-text">Passcode:</span>{" "}
                  {schedule.meeting_passcode}
                </p>
                <CopyButton text={schedule.meeting_passcode} label="passcode" />
              </div>
            )}
            {safeLink && (
              <a
                href={safeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mt-1"
              >
                <LinkIcon size={12} aria-hidden="true" />
                {schedule.meeting_provider === "Google Meet"
                  ? "Join Google Meet"
                  : "Join Meeting"}
              </a>
            )}
          </div>
        )}

      {/* Edit form */}
      {editing && (
        <div className="border-t border-soft-border px-5 py-4">
          <form onSubmit={handleSave} noValidate className="flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-dark-text">
                  Day{" "}
                  <span className="text-red-500" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  className={inputCls}
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-dark-text">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className={inputCls}
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-dark-text">
                  Start Time{" "}
                  <span className="text-red-500" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-dark-text">
                  End Time{" "}
                  <span className="text-red-500" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-dark-text">
                Provider{" "}
                <span className="ml-1 font-normal text-muted-text">(optional)</span>
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className={inputCls}
              >
                <option value="">— Select provider —</option>
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-dark-text">
                Location{" "}
                <span className="ml-1 font-normal text-muted-text">(optional)</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Room 202"
                className={inputCls}
              />
            </div>

            {!isInPerson && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-dark-text">
                    Meeting Link{" "}
                    <span className="ml-1 font-normal text-muted-text">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    className={inputCls}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-dark-text">
                      Meeting ID{" "}
                      <span className="ml-1 font-normal text-muted-text">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={meetingId}
                      onChange={(e) => setMeetingId(e.target.value)}
                      placeholder="123 456 7890"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-dark-text">
                      Passcode{" "}
                      <span className="ml-1 font-normal text-muted-text">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="1234"
                      className={inputCls}
                    />
                  </div>
                </div>
              </>
            )}

            {error && (
              <p
                role="alert"
                className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5"
              >
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 text-sm text-muted-text hover:text-dark-text transition-colors"
              >
                Cancel
              </button>
              <DeleteScheduleButton scheduleId={schedule.id} />
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
