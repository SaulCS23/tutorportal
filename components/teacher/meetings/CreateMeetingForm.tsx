"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

export default function CreateMeetingForm({ classId }: { classId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timezone, setTimezone] = useState("America/Panama");
  const [provider, setProvider] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setTitle("");
    setDescription("");
    setMeetingDate("");
    setStartTime("");
    setEndTime("");
    setTimezone("America/Panama");
    setProvider("");
    setMeetingLink("");
    setLocation("");
    setError("");
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
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
    const { error: dbError } = await supabase.from("class_meetings").insert({
      class_id: classId,
      title: title.trim(),
      description: description.trim() || null,
      meeting_date: meetingDate,
      start_time: startTime,
      end_time: endTime,
      timezone,
      meeting_provider: provider.trim() || null,
      meeting_link: meetingLink.trim() || null,
      location: location.trim() || null,
    });

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    reset();
    router.refresh();
  }

  const isInPerson = provider === "In person";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-dark transition-colors"
      >
        <CalendarPlus size={16} aria-hidden="true" />
        New Meeting
      </button>
    );
  }

  return (
    <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6">
      <h2 className="text-base font-semibold text-dark-text mb-4">New Meeting</h2>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-dark-text">
            Title{" "}
            <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. SAT Group A — Session 1"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-dark-text">
            Description{" "}
            <span className="ml-1 font-normal text-muted-text">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What will this meeting cover?"
            className={`${inputCls} resize-y`}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-dark-text">
              Date{" "}
              <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              type="date"
              required
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className={inputCls}
            />
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
              Start Time{" "}
              <span className="text-red-500" aria-hidden="true">*</span>
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
              <span className="text-red-500" aria-hidden="true">*</span>
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
            Meeting Provider{" "}
            <span className="ml-1 font-normal text-muted-text">(optional)</span>
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
            Location{" "}
            <span className="ml-1 font-normal text-muted-text">(optional)</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Room 202, Library B"
            className={inputCls}
          />
        </div>

        {!isInPerson && (
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
        )}

        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5"
          >
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Creating…" : "Create Meeting"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="px-4 text-sm font-medium text-muted-text hover:text-dark-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
