"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type SubmissionForGrading = {
  id: string;
  assignment_id: string;
  student_id: string;
  answer_text: string | null;
  status: "draft" | "submitted" | "graded" | "returned";
  submitted_at: string;
  score: number | null;
  max_score: number | null;
  teacher_feedback: string | null;
  graded_at: string | null;
};

interface GradeSubmissionFormProps {
  submission: SubmissionForGrading;
  assignmentPoints: number;
}

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";

export default function GradeSubmissionForm({
  submission,
  assignmentPoints,
}: GradeSubmissionFormProps) {
  const router = useRouter();
  const defaultMax = submission.max_score ?? (assignmentPoints > 0 ? assignmentPoints : null);

  const [score, setScore] = useState(
    submission.score !== null ? String(submission.score) : ""
  );
  const [maxScore, setMaxScore] = useState(
    defaultMax !== null ? String(defaultMax) : ""
  );
  const [feedback, setFeedback] = useState(submission.teacher_feedback ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSave(returnToStudent: boolean) {
    setError("");
    setSuccess("");

    const scoreNum = score.trim() ? parseFloat(score) : null;
    const maxNum = maxScore.trim() ? parseFloat(maxScore) : null;

    if (scoreNum !== null && isNaN(scoreNum)) {
      setError("Score must be a number.");
      return;
    }
    if (scoreNum !== null && scoreNum < 0) {
      setError("Score cannot be negative.");
      return;
    }
    if (maxNum !== null && maxNum <= 0) {
      setError("Max score must be greater than 0.");
      return;
    }
    if (scoreNum !== null && maxNum !== null && scoreNum > maxNum) {
      setError("Score cannot exceed max score.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: dbError } = await supabase
      .from("assignment_submissions")
      .update({
        score: scoreNum,
        max_score: maxNum,
        teacher_feedback: feedback.trim() || null,
        status: returnToStudent ? "returned" : "graded",
      })
      .eq("id", submission.id);

    setLoading(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    setSuccess(
      returnToStudent
        ? "Submission returned to student."
        : "Grade saved."
    );
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave(false);
      }}
      noValidate
      className="flex flex-col gap-3 pt-3 border-t border-soft-border"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-dark-text">Score</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="e.g. 85"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-dark-text">
            Max Score
          </label>
          <input
            type="number"
            min="0.1"
            step="0.5"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            placeholder={
              assignmentPoints > 0 ? String(assignmentPoints) : "e.g. 100"
            }
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-dark-text">
          Feedback{" "}
          <span className="font-normal text-muted-text">(optional)</span>
        </label>
        <textarea
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Write feedback for the student…"
          className={`${inputCls} resize-y`}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2"
        >
          {success}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-primary text-white text-xs font-semibold py-2 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save Grade"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => handleSave(true)}
          className="flex-1 bg-card-bg border border-soft-border text-xs font-medium text-dark-text py-2 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-60"
        >
          Return to Student
        </button>
      </div>
    </form>
  );
}
