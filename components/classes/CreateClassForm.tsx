"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Check, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CreatedClass = { class_id: string; join_code: string };
type ViewState = "idle" | "form" | "success";

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
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

function validateGoogleMeetLink(url: string): string | null {
  if (!url.trim()) return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") {
      return "Google Meet link must use https.";
    }
    if (!u.hostname.endsWith("meet.google.com")) {
      return "Please use a Google Meet link from meet.google.com.";
    }
    return null;
  } catch {
    return "Enter a valid Google Meet URL (e.g. https://meet.google.com/abc-defg-hij).";
  }
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold text-muted-text uppercase tracking-wide pt-1">
      {title}
    </p>
  );
}

function Field({
  label,
  children,
  optional,
  required,
}: {
  label: string;
  children: React.ReactNode;
  optional?: boolean;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-dark-text">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-muted-text">(optional)</span>
        )}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            {" "}*
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

export default function CreateClassForm() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>("idle");

  // Basic info
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");

  // Schedule
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [timezone, setTimezone] = useState("America/Panama");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Google Meet
  const [meetLink, setMeetLink] = useState("");
  const [meetId, setMeetId] = useState("");
  const [meetPasscode, setMeetPasscode] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedClass | null>(null);
  const [copied, setCopied] = useState(false);

  function openForm() {
    setName("");
    setSubject("");
    setDescription("");
    setStartDate("");
    setDayOfWeek("1");
    setTimezone("America/Panama");
    setStartTime("");
    setEndTime("");
    setMeetLink("");
    setMeetId("");
    setMeetPasscode("");
    setError("");
    setView("form");
  }

  function cancel() {
    setView("idle");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Class name is required.");
      return;
    }

    // Validate schedule if any schedule field is filled
    const hasSchedule = startTime || endTime;
    if (hasSchedule) {
      if (!startTime) { setError("Start time is required when adding a schedule."); return; }
      if (!endTime)   { setError("End time is required when adding a schedule."); return; }
      if (endTime <= startTime) { setError("End time must be after start time."); return; }
    }

    // Validate Google Meet link
    const meetError = validateGoogleMeetLink(meetLink);
    if (meetError) { setError(meetError); return; }

    setLoading(true);
    const supabase = createClient();

    const { data, error: rpcError } = await supabase.rpc(
      "create_class_with_schedule",
      {
        p_name: name.trim(),
        p_subject: subject.trim() || null,
        p_description: description.trim() || null,
        p_start_date: startDate || null,
        p_day_of_week: hasSchedule ? parseInt(dayOfWeek, 10) : null,
        p_start_time: startTime || null,
        p_end_time: endTime || null,
        p_timezone: timezone,
        p_meeting_link: meetLink.trim() || null,
        p_meeting_id: meetId.trim() || null,
        p_meeting_passcode: meetPasscode.trim() || null,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    setCreated(data as CreatedClass);
    setView("success");
    setLoading(false);
  }

  async function copyCode() {
    if (!created) return;
    await navigator.clipboard.writeText(created.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function done() {
    setView("idle");
    setCreated(null);
    setCopied(false);
    router.refresh();
  }

  // ── Success state ─────────────────────────────────────────────

  if (view === "success" && created) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
        <p className="text-sm font-semibold text-success mb-1">Class created!</p>
        <p className="text-sm text-muted-text mb-4">
          Share this code with your students so they can join.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold tracking-widest text-dark-text font-mono">
            {created.join_code}
          </span>
          <button
            type="button"
            onClick={copyCode}
            aria-label="Copy join code"
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            {copied ? (
              <Check size={14} className="text-success" />
            ) : (
              <Copy size={14} />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          onClick={done}
          className="mt-5 text-sm font-medium text-primary hover:underline"
        >
          Done
        </button>
      </div>
    );
  }

  // ── Form state ────────────────────────────────────────────────

  if (view === "form") {
    return (
      <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6 mb-6">
        <h2 className="text-base font-semibold text-dark-text mb-5">
          New Class
        </h2>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

          {/* ── Basic info ── */}
          <SectionHeader title="Basic Info" />

          <Field label="Class Name" required>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SAT Math"
              className={inputCls}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Subject" optional>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Math, Reading & Writing"
                className={inputCls}
              />
            </Field>
            <Field label="Start Date" optional>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Description" optional>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description for students…"
              className={`${inputCls} resize-y`}
            />
          </Field>

          {/* ── Schedule ── */}
          <SectionHeader title="Weekly Meeting (optional)" />

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Day">
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
            </Field>
            <Field label="Timezone">
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
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Start Time">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="End Time">
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          {/* ── Google Meet ── */}
          <SectionHeader title="Google Meet" />

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 flex gap-2">
            <ExternalLink size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Create a recurring Google Meet meeting, then paste the link below.{" "}
              <a
                href="https://meet.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                Open Google Meet
              </a>
            </span>
          </div>

          <Field label="Google Meet Link" optional>
            <input
              type="url"
              value={meetLink}
              onChange={(e) => setMeetLink(e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij"
              className={inputCls}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Meeting ID" optional>
              <input
                type="text"
                value={meetId}
                onChange={(e) => setMeetId(e.target.value)}
                placeholder="e.g. abc-defg-hij"
                className={inputCls}
              />
            </Field>
            <Field label="Joining Instructions" optional>
              <input
                type="text"
                value={meetPasscode}
                onChange={(e) => setMeetPasscode(e.target.value)}
                placeholder="Passcode or note"
                className={inputCls}
              />
            </Field>
          </div>

          {/* ── Error + actions ── */}
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
              {loading ? "Creating…" : "Create Class"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="px-4 text-sm font-medium text-muted-text hover:text-dark-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── Idle state ────────────────────────────────────────────────

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={openForm}
        className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-dark transition-colors"
      >
        <Plus size={16} aria-hidden="true" />
        Create Class
      </button>
    </div>
  );
}
