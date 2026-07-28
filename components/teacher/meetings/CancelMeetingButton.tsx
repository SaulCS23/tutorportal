"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function CancelMeetingButton({
  meetingId,
}: {
  meetingId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("class_meetings")
      .update({ status: "cancelled" })
      .eq("id", meetingId);

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      setConfirming(false);
      return;
    }
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-text">Cancel this meeting?</span>
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
        >
          {loading ? "Cancelling…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-muted-text hover:text-dark-text"
        >
          No
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
    >
      <XCircle size={14} aria-hidden="true" />
      Cancel Meeting
    </button>
  );
}
