"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface RemoveStudentButtonProps {
  classId: string;
  studentId: string;
  studentName: string;
}

export default function RemoveStudentButton({
  classId,
  studentId,
  studentName,
}: RemoveStudentButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRemove() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("class_members")
      .delete()
      .match({ class_id: classId, student_id: studentId });

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      setConfirming(false);
      return;
    }

    router.refresh();
  }

  if (error) {
    return (
      <p role="alert" className="text-xs text-red-600">
        {error}
      </p>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="text-xs text-muted-text hover:text-dark-text transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleRemove}
          disabled={loading}
          className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-60"
        >
          {loading ? "Removing…" : "Confirm"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs text-muted-text hover:text-red-600 transition-colors shrink-0"
      aria-label={`Remove ${studentName} from class`}
    >
      Remove
    </button>
  );
}
