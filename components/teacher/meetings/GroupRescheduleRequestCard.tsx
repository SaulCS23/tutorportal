"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/utils";
import DatePicker from "@/components/ui/DatePicker";
import { rejectGroupReschedule, resolveGroupReschedule } from "@/components/schedule/meetingCancellation";

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
};

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
  const [showForm, setShowForm] = useState(false);
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

  const majorityPct = Math.round(
    (request.thresholdCount / request.eligibleStudentCount) * 100
  );

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
    router.refresh();
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

      {error && (
        <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {showForm ? (
        <form onSubmit={handleResolve} noValidate className="flex flex-col gap-3 border-t border-soft-border pt-3">
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
              onClick={() => setShowForm(false)}
              className="px-4 text-sm text-muted-text hover:text-dark-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowForm(true)}
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
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
