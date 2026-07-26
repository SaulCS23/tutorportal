"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DeleteClassButton({ classId }: { classId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("classes")
      .delete()
      .eq("id", classId);

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      setConfirming(false);
      return;
    }

    router.push("/classes");
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-dark-text">
          Delete this class? This will remove all enrolled students and cannot be undone.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="px-4 py-2 text-sm font-medium text-muted-text hover:text-dark-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
    >
      <Trash2 size={15} aria-hidden="true" />
      Delete Class
    </button>
  );
}
