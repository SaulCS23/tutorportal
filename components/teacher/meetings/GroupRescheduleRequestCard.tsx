"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatTime, splitDateAndTime } from "@/lib/utils";
import { useViewerTimezone } from "@/components/timezone/TimezoneProvider";
import DatePicker from "@/components/ui/DatePicker";
import { rejectGroupReschedule, resolveGroupReschedule } from "@/components/schedule/meetingCancellation";

export type ProposalForReview = {
  id: string;
  studentName: string;
  createdAt: string;
  options: { id: string; proposed_start_at: string; proposed_end_at: string }[];
};

export type GroupRescheduleForReview = {
  id: string;
  meetingTitle: string;
  meetingStartTime: string;
  meetingEndTime: string;
  meetingTimezone: string;
  meetingProvider: string | null;
  meetingLink: string | null;
  location: string | null;
  thresholdCount: number;
  eligibleStudentCount: number;
  /** The individual makeup requests that led to this majority — kept and
   *  shown even though their own status became 'superseded_by_group_reschedule',
   *  since the times each student proposed are still useful reference for
   *  the teacher picking one final group time, and are now directly
   *  selectable to pre-fill the reschedule form below. */
  proposals: ProposalForReview[];
};

/** One of a student's three proposed slots, or the teacher's own custom time. */
type Choice =
  | {
      kind: "proposal";
      studentName: string;
      optionIndex: number;
      startAt: string;
      endAt: string;
    }
  | { kind: "other" };

function formatProposalOption(
  opt: { proposed_start_at: string; proposed_end_at: string },
  timezone: string
): string {
  const start = new Date(opt.proposed_start_at);
  const end = new Date(opt.proposed_end_at);
  const dateLabel = start.toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startLabel = start.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  const endLabel = end.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateLabel}, ${startLabel} – ${endLabel}`;
}

function formatRequestedAt(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text focus:outline-none focus:ring-2 focus:ring-primary transition";

const PROVIDER_OPTIONS = [
  { value: "Google Meet", label: "Google Meet" },
  { value: "Zoom", label: "Zoom" },
  { value: "Microsoft Teams", label: "Microsoft Teams" },
  { value: "Other", label: "Other" },
  { value: "In person", label: "In person" },
];

export default function GroupRescheduleRequestCard({
  request,
}: {
  request: GroupRescheduleForReview;
}) {
  const router = useRouter();
  // Purely informational displays (what/when a student proposed) always
  // show in the reviewing teacher's own timezone — separate from the
  // `timezone` form field below, which is part of the actual reschedule
  // write path and stays anchored to the original meeting's timezone by
  // design (untouched here).
  const viewerTimezone = useViewerTimezone();
  const [showChoices, setShowChoices] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [meetingDate, setMeetingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timezone, setTimezone] = useState(request.meetingTimezone);
  const [provider, setProvider] = useState(request.meetingProvider ?? "");
  const [meetingLink, setMeetingLink] = useState(request.meetingLink ?? "");
  const [location, setLocation] = useState(request.location ?? "");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resolved, setResolved] = useState(false);

  const majorityPct = Math.round(
    (request.thresholdCount / request.eligibleStudentCount) * 100
  );

  function selectProposalOption(
    studentName: string,
    optionIndex: number,
    opt: { proposed_start_at: string; proposed_end_at: string }
  ) {
    setChoice({
      kind: "proposal",
      studentName,
      optionIndex,
      startAt: opt.proposed_start_at,
      endAt: opt.proposed_end_at,
    });
    const start = splitDateAndTime(opt.proposed_start_at, request.meetingTimezone);
    const end = splitDateAndTime(opt.proposed_end_at, request.meetingTimezone);
    setMeetingDate(start.date);
    setStartTime(start.time);
    setEndTime(end.time);
  }

  function selectOther() {
    setChoice({ kind: "other" });
    setMeetingDate("");
    setStartTime("");
    setEndTime("");
  }

  function startFlow() {
    setError("");
    setShowChoices(true);
  }

  function cancelFlow() {
    setError("");
    setShowChoices(false);
    setChoice(null);
  }

  function backToChoices() {
    setChoice(null);
  }

  async function handleReject() {
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: rpcError } = await rejectGroupReschedule(
      supabase,
      request.id,
      note.trim() || null
    );
    setLoading(false);
    if (rpcError) {
      setError(rpcError);
      return;
    }
    router.refresh();
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!meetingDate) {
      setError("Pick a new date.");
      return;
    }
    if (!startTime || !endTime) {
      setError("Start and end time are required.");
      return;
    }
    if (endTime <= startTime) {
      setError("End time must be after start time.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: rpcError } = await resolveGroupReschedule(supabase, {
      groupRequestId: request.id,
      meetingDate,
      startTime,
      endTime,
      timezone: timezone.trim() || null,
      meetingProvider: provider.trim() || null,
      meetingLink: meetingLink.trim() || null,
      location: location.trim() || null,
      teacherNote: note.trim() || null,
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcError);
      return;
    }
    setResolved(true);
  }

  if (resolved) {
    return (
      <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-5 flex flex-col gap-3">
        <p className="text-sm font-semibold text-dark-text">{request.meetingTitle}</p>
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex flex-col gap-1">
          <p className="text-sm font-semibold text-green-800">Meeting rescheduled</p>
          <p className="text-xs text-green-700">
            All {request.eligibleStudentCount} student
            {request.eligibleStudentCount === 1 ? "" : "s"} in the class have been notified of
            the new time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="self-start text-sm font-medium text-primary hover:underline"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-5 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-dark-text">{request.meetingTitle}</p>
        <p className="text-xs text-muted-text mt-0.5">
          Originally {formatTime(request.meetingStartTime)} – {formatTime(request.meetingEndTime)}
        </p>
        <p className="text-sm text-amber-700 mt-2 font-medium">
          {request.thresholdCount} of {request.eligibleStudentCount} students requested
          cancellation ({majorityPct}%)
        </p>
      </div>

      {!showChoices && request.proposals.length > 0 && (
        <div className="border-t border-soft-border pt-3 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
            Proposed times submitted (reference only)
          </p>
          {request.proposals.map((p) => (
            <div key={p.id} className="rounded-xl border border-soft-border px-3 py-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium text-dark-text">{p.studentName}</p>
                <p className="text-xs text-muted-text">
                  Requested {formatRequestedAt(p.createdAt, viewerTimezone)}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                {p.options.map((opt, i) => (
                  <p key={opt.id} className="text-xs text-muted-text">
                    Option {i + 1}: {formatProposalOption(opt, viewerTimezone)}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {!showChoices ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={startFlow}
            className="flex-1 bg-primary text-white text-sm font-semibold py-2 rounded-xl hover:bg-primary-dark transition-colors"
          >
            Reschedule Group
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={loading}
            className="px-4 text-sm font-medium text-red-600 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-60"
          >
            Reject Request
          </button>
        </div>
      ) : choice === null ? (
        <div className="border-t border-soft-border pt-3 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
            Choose a time for the new meeting
          </p>
          {request.proposals.map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-dark-text">
                {p.studentName}{" "}
                <span className="font-normal text-muted-text">
                  — requested {formatRequestedAt(p.createdAt, viewerTimezone)}
                </span>
              </p>
              <div className="flex flex-col gap-1.5">
                {p.options.map((opt, i) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 text-sm rounded-xl border border-soft-border px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <input
                      type="radio"
                      name={`reschedule-choice-${request.id}`}
                      onChange={() => selectProposalOption(p.studentName, i, opt)}
                      className="accent-primary"
                    />
                    <span>
                      Option {i + 1}: {formatProposalOption(opt, viewerTimezone)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <label className="flex items-center gap-2 text-sm rounded-xl border border-dashed border-soft-border px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="radio"
              name={`reschedule-choice-${request.id}`}
              onChange={selectOther}
              className="accent-primary"
            />
            <span className="font-medium text-dark-text">Choose another time</span>
          </label>

          <button
            type="button"
            onClick={cancelFlow}
            className="self-start text-sm text-muted-text hover:text-dark-text transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <form onSubmit={handleResolve} noValidate className="flex flex-col gap-3 border-t border-soft-border pt-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-text">
              {choice.kind === "proposal"
                ? `Using ${choice.studentName}'s Option ${choice.optionIndex + 1}`
                : "Custom time"}
            </p>
            <button
              type="button"
              onClick={backToChoices}
              className="text-xs font-medium text-primary hover:underline"
            >
              Change
            </button>
          </div>

          {choice.kind === "other" && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
              Reminder: none of the students proposed this time — make sure you have coordinated
              it with them directly before confirming.
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-dark-text">New Date</label>
              <DatePicker value={meetingDate} onChange={setMeetingDate} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-dark-text">Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-dark-text">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-dark-text">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-dark-text">Provider (optional)</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className={inputCls}>
              <option value="">— Select provider —</option>
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-dark-text">Meeting Link (optional)</label>
            <input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-dark-text">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-dark-text">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={`${inputCls} resize-y`}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-white text-sm font-semibold py-2 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {loading ? "Saving…" : "Confirm New Meeting"}
            </button>
            <button
              type="button"
              onClick={cancelFlow}
              className="px-4 text-sm text-muted-text hover:text-dark-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
