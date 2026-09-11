"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestTeacherAccessAction } from "@/app/actions/teacherAccess";
import StatusBadge from "@/components/ui/StatusBadge";

type LatestRequest = {
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewer_note: string | null;
} | null;

export default function TeacherAccessRequest({
  latestRequest,
}: {
  latestRequest: LatestRequest;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await requestTeacherAccessAction(message);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    setExpanded(false);
    setJustSubmitted(true);
    router.refresh();
  }

  if (justSubmitted || latestRequest?.status === "pending") {
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-text">
          Your request to become a teacher is awaiting review.
        </p>
        <StatusBadge status="pending" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {latestRequest?.status === "rejected" && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-text">
            Your previous teacher access request was not approved.
            {latestRequest.reviewer_note ? ` "${latestRequest.reviewer_note}"` : ""}
          </p>
          <StatusBadge status="rejected" />
        </div>
      )}

      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-sm font-semibold text-primary hover:underline"
        >
          Request Teacher Access
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="teacher-access-message" className="text-sm font-medium text-dark-text">
            Tell us why you&apos;d like teacher access (optional)
          </label>
          <textarea
            id="teacher-access-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. I tutor SAT Math and would like to manage my own class."
            className="w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition resize-none"
          />

          {error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting…" : "Submit Request"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-sm font-medium text-muted-text hover:text-dark-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
