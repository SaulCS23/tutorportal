"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveTeacherAccessRequestAction,
  rejectTeacherAccessRequestAction,
} from "@/app/actions/teacherAccess";

export default function TeacherRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [showNoteFor, setShowNoteFor] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConfirm(action: "approve" | "reject") {
    setError("");
    setLoading(true);

    const result =
      action === "approve"
        ? await approveTeacherAccessRequestAction(requestId, note)
        : await rejectTeacherAccessRequestAction(requestId, note);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.refresh();
  }

  if (showNoteFor) {
    return (
      <div className="flex flex-col gap-2 mt-3">
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note to the student"
          className="w-full px-3 py-2 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition resize-none"
        />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleConfirm(showNoteFor)}
            className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              showNoteFor === "approve"
                ? "bg-primary text-white hover:bg-primary-dark"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {loading
              ? "Saving…"
              : showNoteFor === "approve"
                ? "Confirm Approve"
                : "Confirm Reject"}
          </button>
          <button
            type="button"
            onClick={() => setShowNoteFor(null)}
            className="text-sm font-medium text-muted-text hover:text-dark-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mt-3">
      <button
        type="button"
        onClick={() => setShowNoteFor("approve")}
        className="bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-dark transition-colors"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => setShowNoteFor("reject")}
        className="bg-card-bg border border-soft-border text-dark-text text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
      >
        Reject
      </button>
    </div>
  );
}
