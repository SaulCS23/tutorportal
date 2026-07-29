"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Pencil, X, Link as LinkIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTime, isSafeUrl } from "@/lib/utils";
import type { ClassMeeting } from "@/lib/supabase/helpers";
import StatusBadge from "@/components/ui/StatusBadge";
import DatePicker from "@/components/ui/DatePicker";
import CancelMeetingButton from "./CancelMeetingButton";
import MeetingDetailModal from "@/components/schedule/MeetingDetailModal";
import type { ScheduleItem } from "@/components/schedule/scheduleItems";
import { clickableCardProps, stopCardClick, CLICKABLE_CARD_CLASSES } from "@/lib/clickableCard";

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

const formatDate = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function MeetingCard({ meeting }: { meeting: ClassMeeting }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const [title, setTitle] = useState(meeting.title);
  const [description, setDescription] = useState(meeting.description ?? "");
  const [meetingDate, setMeetingDate] = useState(meeting.meeting_date);
  const [startTime, setStartTime] = useState(meeting.start_time.slice(0, 5));
  const [endTime, setEndTime] = useState(meeting.end_time.slice(0, 5));
  const [timezone, setTimezone] = useState(meeting.timezone);
  const [provider, setProvider] = useState(meeting.meeting_provider ?? "");
  const [meetingLink, setMeetingLink] = useState(meeting.meeting_link ?? "");
  const [location, setLocation] = useState(meeting.location ?? "");
  const [status, setStatus] = useState(meeting.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function cancelEdit() {
    setTitle(meeting.title);
    setDescription(meeting.description ?? "");
    setMeetingDate(meeting.meeting_date);
    setStartTime(meeting.start_time.slice(0, 5));
    setEndTime(meeting.end_time.slice(0, 5));
    setTimezone(meeting.timezone);
    setProvider(meeting.meeting_provider ?? "");
    setMeetingLink(meeting.meeting_link ?? "");
    setLocation(meeting.location ?? "");
    setStatus(meeting.status);
    setError("");
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) { setError("Title is required."); return; }
    if (!meetingDate) { setError("Meeting date is required."); return; }
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
      .from("class_meetings")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        meeting_date: meetingDate,
        start_time: startTime,
        end_time: endTime,
        timezone,
        meeting_provider: provider.trim() || null,
        meeting_link: meetingLink.trim() || null,
        location: location.trim() || null,
        status,
      })
      .eq("id", meeting.id);

    setLoading(false);
    if (dbError) { setError(dbError.message); return; }
    setEditing(false);
    router.refresh();
  }

  const isInPerson = (editing ? provider : meeting.meeting_provider) === "In person";
  const safeLink = isSafeUrl(meeting.meeting_link) ? meeting.meeting_link! : null;

  const detailItem: ScheduleItem = {
    id: meeting.id,
    source: "meeting",
    classId: meeting.class_id,
    className: "",
    subject: null,
    teacherId: null,
    date: meeting.meeting_date,
    startTime: meeting.start_time,
    endTime: meeting.end_time,
    timezone: meeting.timezone,
    status: meeting.status,
    title: meeting.title,
    location: meeting.location,
    meetingProvider: meeting.meeting_provider,
    meetingLink: meeting.meeting_link,
  };

  const cardProps = editing
    ? {}
    : clickableCardProps(() => setShowDetail(true), `Open meeting details: ${meeting.title}`);

  return (
    <>
    <div
      {...cardProps}
      className={`bg-card-bg border border-soft-border rounded-2xl shadow-card overflow-hidden ${
        editing ? "" : CLICKABLE_CARD_CLASSES
      }`}
    >
      {/* Header (always visible) */}
      <div className="flex items-start gap-3 px-5 py-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
          <CalendarDays size={14} className="text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-dark-text truncate">{meeting.title}</p>
            <StatusBadge status={meeting.status} />
          </div>
          <p className="text-xs text-muted-text mt-0.5">
            {formatDate(meeting.meeting_date)} · {formatTime(meeting.start_time)} – {formatTime(meeting.end_time)}{" "}
            <span className="text-slate-400">({meeting.timezone})</span>
          </p>
          {meeting.meeting_provider && (
            <p className="text-xs text-muted-text mt-0.5">{meeting.meeting_provider}</p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            stopCardClick(e);
            if (editing) {
              cancelEdit();
            } else {
              setEditing(true);
            }
          }}
          aria-label={editing ? "Cancel edit" : "Edit meeting"}
          className="p-1.5 text-muted-text hover:text-dark-text hover:bg-slate-100 rounded-lg transition-colors shrink-0"
        >
          {editing ? <X size={15} aria-hidden="true" /> : <Pencil size={15} aria-hidden="true" />}
        </button>
      </div>

      {/* Display details (non-edit) */}
      {!editing && (
        <>
          {meeting.description && (
            <div className="px-5 pb-3 border-t border-soft-border">
              <p className="text-sm text-muted-text mt-3">{meeting.description}</p>
            </div>
          )}
          {(meeting.location || safeLink) && (
            <div className="border-t border-soft-border px-5 py-3 flex flex-col gap-2">
              {meeting.location && (
                <p className="text-xs text-muted-text">
                  <span className="font-medium text-dark-text">Location:</span> {meeting.location}
                </p>
              )}
              {safeLink && (
                <a
                  href={safeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={stopCardClick}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mt-1"
                >
                  <LinkIcon size={12} aria-hidden="true" />
                  {meeting.meeting_provider === "Google Meet" ? "Join Google Meet" : "Join Meeting"}
                </a>
              )}
            </div>
          )}
          {meeting.status === "scheduled" && (
            <div className="border-t border-soft-border px-5 py-3" onClick={stopCardClick}>
              <CancelMeetingButton meetingId={meeting.id} />
            </div>
          )}
        </>
      )}

      {/* Edit form */}
      {editing && (
        <div className="border-t border-soft-border px-5 py-4">
          <form onSubmit={handleSave} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-dark-text">
                Title <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-dark-text">
                Description <span className="ml-1 font-normal text-muted-text">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={`${inputCls} resize-y`}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-dark-text">
                  Date <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <DatePicker value={meetingDate} onChange={setMeetingDate} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-dark-text">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className={inputCls}
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-dark-text">
                  Start Time <span className="text-red-500" aria-hidden="true">*</span>
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
                  End Time <span className="text-red-500" aria-hidden="true">*</span>
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
                Provider <span className="ml-1 font-normal text-muted-text">(optional)</span>
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className={inputCls}
              >
                <option value="">— Select provider —</option>
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-dark-text">
                Location <span className="ml-1 font-normal text-muted-text">(optional)</span>
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
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-dark-text">
                  Meeting Link <span className="ml-1 font-normal text-muted-text">(optional)</span>
                </label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  className={inputCls}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-dark-text">Status</label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "scheduled" | "completed" | "cancelled")
                }
                className={inputCls}
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

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
            </div>
          </form>
        </div>
      )}
    </div>
      {showDetail && (
        <MeetingDetailModal
          item={detailItem}
          isTeacher
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}
