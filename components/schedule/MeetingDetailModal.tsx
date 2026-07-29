"use client";

import { useEffect, useState } from "react";
import { X, Clock, MapPin, Link as LinkIcon, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTime, isSafeUrl } from "@/lib/utils";
import DatePicker from "@/components/ui/DatePicker";
import StatusBadge from "@/components/ui/StatusBadge";
import type { ScheduleItem } from "./scheduleItems";
import {
  getMeetingCancellationEligibility,
  getOwnMakeupRequest,
  submitMakeupRequest,
  type MeetingCancellationEligibility,
  type MakeupRequest,
  type MakeupOption,
} from "./meetingCancellation";

type OptionDraft = { date: string; startTime: string; endTime: string };

const emptyOptions = (): OptionDraft[] => [
  { date: "", startTime: "", endTime: "" },
  { date: "", startTime: "", endTime: "" },
  { date: "", startTime: "", endTime: "" },
];

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";

function formatDateLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatInstant(iso: string, timezone: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const REQUEST_STATUS_LABEL: Record<MakeupRequest["status"], string> = {
  pending: "Waiting for your teacher to review",
  approved: "Approved — your makeup lesson is scheduled",
  rejected: "Rejected by your teacher",
  resolved: "Resolved",
  superseded_by_group_reschedule:
    "Closed — the whole class is being rescheduled instead",
};

export default function MeetingDetailModal({
  item,
  teacherName,
  onClose,
}: {
  item: ScheduleItem;
  teacherName?: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<MeetingCancellationEligibility | null>(null);
  const [existingRequest, setExistingRequest] = useState<MakeupRequest | null>(null);
  const [existingOptions, setExistingOptions] = useState<MakeupOption[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>(emptyOptions());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const [eligResult, ownResult] = await Promise.all([
        getMeetingCancellationEligibility(supabase, item.id),
        getOwnMakeupRequest(supabase, item.id),
      ]);
      if (cancelled) return;
      setEligibility(eligResult.data);
      setExistingRequest(ownResult.request);
      setExistingOptions(ownResult.options);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    for (const opt of options) {
      if (!opt.date || !opt.startTime || !opt.endTime) {
        setSubmitError("All three proposed date/time options are required.");
        return;
      }
      if (opt.endTime <= opt.startTime) {
        setSubmitError("Each option's end time must be after its start time.");
        return;
      }
    }

    setSubmitting(true);
    const supabase = createClient();
    const tz = item.timezone;
    const toTimestamp = (opt: OptionDraft, time: string) => `${opt.date} ${time}:00 ${tz}`;

    const { error: rpcError } = await submitMakeupRequest(supabase, {
      meetingId: item.id,
      reason: reason.trim() || null,
      option1: { start: toTimestamp(options[0], options[0].startTime), end: toTimestamp(options[0], options[0].endTime) },
      option2: { start: toTimestamp(options[1], options[1].startTime), end: toTimestamp(options[1], options[1].endTime) },
      option3: { start: toTimestamp(options[2], options[2].startTime), end: toTimestamp(options[2], options[2].endTime) },
    });

    if (rpcError) {
      setSubmitting(false);
      setSubmitError(rpcError);
      return;
    }

    const refreshed = await getOwnMakeupRequest(supabase, item.id);
    setExistingRequest(refreshed.request);
    setExistingOptions(refreshed.options);
    setShowForm(false);
    setSubmitting(false);
  }

  const safeLink = isSafeUrl(item.meetingLink) ? item.meetingLink! : null;
  const heading = item.title ?? item.className;

  function updateOption(index: number, field: keyof OptionDraft, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meeting-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-card-bg w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-card-hover max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-soft-border sticky top-0 bg-card-bg z-10">
          <div className="min-w-0">
            <h2 id="meeting-modal-title" className="text-base font-bold text-dark-text truncate">
              {heading}
            </h2>
            <p className="text-xs text-muted-text mt-0.5 truncate">{item.className}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-muted-text hover:text-dark-text hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {item.status && <StatusBadge status={item.status} />}
            </div>
            <p className="flex items-center gap-2 text-dark-text">
              <Clock size={14} className="text-muted-text shrink-0" aria-hidden="true" />
              {formatDateLabel(item.date)} · {formatTime(item.startTime)} – {formatTime(item.endTime)}{" "}
              <span className="text-xs text-slate-400">({item.timezone})</span>
            </p>
            {teacherName && <p className="text-muted-text">with {teacherName}</p>}
            {item.location && (
              <p className="flex items-center gap-2 text-dark-text">
                <MapPin size={14} className="text-muted-text shrink-0" aria-hidden="true" />
                {item.location}
              </p>
            )}
            {safeLink && (
              <a
                href={safeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary font-medium hover:underline w-fit"
              >
                <LinkIcon size={14} aria-hidden="true" />
                {item.meetingProvider === "Google Meet" ? "Join Google Meet" : "Join Meeting"}
              </a>
            )}
          </div>

          <div className="border-t border-soft-border pt-4">
            {loading ? (
              <p className="text-sm text-muted-text">Loading cancellation policy…</p>
            ) : item.status === "cancelled" ? (
              <p className="text-sm text-muted-text">This meeting has been cancelled.</p>
            ) : item.status === "group_pending_reschedule" ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                A majority of the class requested to reschedule this meeting. Your teacher is
                coordinating a new time — no further action is needed here.
              </div>
            ) : item.status === "completed" ? (
              <p className="text-sm text-muted-text">This meeting has already taken place.</p>
            ) : existingRequest ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-dark-text">
                  {REQUEST_STATUS_LABEL[existingRequest.status]}
                </p>
                {existingRequest.reason && (
                  <p className="text-sm text-muted-text">Your reason: {existingRequest.reason}</p>
                )}
                {existingRequest.teacher_note && (
                  <p className="text-sm text-muted-text">
                    Teacher note: {existingRequest.teacher_note}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {existingOptions.map((opt, i) => (
                    <div
                      key={opt.id}
                      className={`text-xs rounded-lg px-3 py-2 border ${
                        existingRequest.selected_option_id === opt.id
                          ? "bg-green-50 border-green-200 text-green-800 font-medium"
                          : "bg-slate-50 border-soft-border text-muted-text"
                      }`}
                    >
                      Option {i + 1}: {formatInstant(opt.proposed_start_at, item.timezone)} –{" "}
                      {formatInstant(opt.proposed_end_at, item.timezone)}
                      {existingRequest.selected_option_id === opt.id && " (approved)"}
                    </div>
                  ))}
                </div>
              </div>
            ) : eligibility?.eligible ? (
              showForm ? (
                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                  <p className="text-xs text-muted-text bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5">
                    The group session will still happen as scheduled for everyone else. This
                    creates a request for a separate, individual makeup lesson (which may cost
                    more than the regular group lesson) at one of the three times below, once
                    your teacher approves one.
                  </p>

                  {options.map((opt, i) => (
                    <div key={i} className="flex flex-col gap-1.5 border border-soft-border rounded-xl p-3">
                      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                        Option {i + 1}
                      </p>
                      <DatePicker value={opt.date} onChange={(v) => updateOption(i, "date", v)} />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="time"
                          required
                          value={opt.startTime}
                          onChange={(e) => updateOption(i, "startTime", e.target.value)}
                          className={inputCls}
                          aria-label={`Option ${i + 1} start time`}
                        />
                        <input
                          type="time"
                          required
                          value={opt.endTime}
                          onChange={(e) => updateOption(i, "endTime", e.target.value)}
                          className={inputCls}
                          aria-label={`Option ${i + 1} end time`}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-dark-text">
                      Reason <span className="font-normal text-muted-text">(optional)</span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      className={`${inputCls} resize-y`}
                    />
                  </div>

                  {submitError && (
                    <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                      {submitError}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60"
                    >
                      {submitting ? "Submitting…" : "Submit Request"}
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
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-dark-text">
                    Cancellation cutoff:{" "}
                    <span className="font-semibold">
                      {eligibility ? formatInstant(eligibility.cutoff_at, item.timezone) : "—"}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-dark transition-colors"
                  >
                    Cancel attendance and request makeup
                  </button>
                </div>
              )
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-red-700">
                    This lesson is within the 24-hour cancellation window and remains chargeable.
                  </p>
                </div>
                {eligibility && (
                  <p className="text-xs text-muted-text">
                    Cutoff was {formatInstant(eligibility.cutoff_at, item.timezone)}.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
