"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/utils";
import { approveMakeupOption, rejectMakeupRequest } from "@/components/schedule/meetingCancellation";
import type { MakeupOption } from "@/components/schedule/meetingCancellation";

export type MakeupRequestForReview = {
  id: string;
  reason: string | null;
  studentName: string;
  meetingTitle: string;
  meetingStartTime: string;
  meetingTimezone: string;
  options: MakeupOption[];
};

function formatOption(opt: MakeupOption, timezone: string): string {
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

const inputCls =
  "w-full px-3 py-2 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text focus:outline-none focus:ring-2 focus:ring-primary transition";

export default function IndividualMakeupRequestCard({
  request,
}: {
  request: MakeupRequestForReview;
}) {
  const router = useRouter();
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleApprove() {
    if (!selectedOptionId) {
      setError("Select one of the three proposed times first.");
      return;
    }
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: rpcError } = await approveMakeupOption(
      supabase,
      request.id,
      selectedOptionId,
      note.trim() || null
    );
    setLoading(false);
    if (rpcError) {
      setError(rpcError);
      return;
    }
    router.refresh();
  }

  async function handleReject() {
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: rpcError } = await rejectMakeupRequest(supabase, request.id, note.trim() || null);
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
        <p className="text-sm font-semibold text-dark-text">{request.studentName}</p>
        <p className="text-xs text-muted-text mt-0.5">
          {request.meetingTitle} · originally {formatTime(request.meetingStartTime)}
        </p>
        {request.reason && (
          <p className="text-sm text-muted-text mt-2">&ldquo;{request.reason}&rdquo;</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
          Proposed times — choose one
        </p>
        {request.options.map((opt, i) => (
          <label
            key={opt.id}
            className={`flex items-center gap-2 text-sm rounded-xl border px-3 py-2 cursor-pointer transition-colors ${
              selectedOptionId === opt.id
                ? "border-primary bg-primary/5"
                : "border-soft-border hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name={`option-${request.id}`}
              checked={selectedOptionId === opt.id}
              onChange={() => setSelectedOptionId(opt.id)}
              className="accent-primary"
            />
            <span>
              Option {i + 1}: {formatOption(opt, request.meetingTimezone)}
            </span>
          </label>
        ))}
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

      {error && (
        <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 bg-primary text-white text-sm font-semibold py-2 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60"
        >
          {loading ? "Saving…" : "Approve Selected"}
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
    </div>
  );
}
