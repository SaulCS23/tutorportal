"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DeleteScheduleButton({
  scheduleId,
}: {
  scheduleId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("class_schedules")
      .delete()
      .eq("id", scheduleId);

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
        <span className="text-xs text-muted-text">Delete?</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
        >
          {loading ? "Deleting…" : "Yes"}
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
      <Trash2 size={14} aria-hidden="true" />
      Delete
    </button>
  );
}
