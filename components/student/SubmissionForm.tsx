"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, FileText, CheckCircle, Lock, Upload, Download, Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  buildStoragePath,
  uploadFile,
  getSignedFileUrl,
  deleteFile,
  fileNameFromPath,
} from "@/lib/supabase/storage";

const SUBMISSION_FILES_BUCKET = "submission-files";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB — matches the bucket's file_size_limit
const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export type Submission = {
  id: string;
  assignment_id: string;
  student_id: string;
  answer_text: string | null;
  attachment_url: string | null;
  status: "draft" | "submitted" | "graded" | "returned";
  submitted_at: string;
  updated_at: string;
  score: number | null;
  max_score: number | null;
  teacher_feedback: string | null;
  graded_at: string | null;
};

interface SubmissionFormProps {
  assignmentId: string;
  existingSubmission: Submission | null;
  dueAt: string | null;
  maxPoints: number;
}

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SubmissionForm({
  assignmentId,
  existingSubmission,
  dueAt,
  maxPoints,
}: SubmissionFormProps) {
  const router = useRouter();
  const isPastDue = dueAt ? new Date(dueAt) < new Date() : false;
  const isGraded =
    existingSubmission?.status === "graded" ||
    existingSubmission?.status === "returned";

  const canEdit =
    !isGraded &&
    !(existingSubmission?.status === "submitted" && isPastDue);

  const [answer, setAnswer] = useState(existingSubmission?.answer_text ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState(
    existingSubmission?.attachment_url ?? null
  );
  const [fileError, setFileError] = useState("");
  const [fileBusy, setFileBusy] = useState(false);

  function validateFile(file: File): string | null {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return "Only PDF, PNG, or JPEG files are supported.";
    }
    if (file.size > MAX_FILE_SIZE) return "File is too large. Maximum size is 20 MB.";
    return null;
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError("");
    const validationError = validateFile(file);
    if (validationError) {
      setFileError(validationError);
      return;
    }
    setPendingFile(file);
  }

  async function handleViewAttachment() {
    if (!attachmentUrl) return;
    setFileError("");
    const supabase = createClient();
    const { url, error: signError } = await getSignedFileUrl(
      supabase,
      SUBMISSION_FILES_BUCKET,
      attachmentUrl
    );
    if (signError || !url) {
      setFileError(signError ?? "Could not open file.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleRemoveAttachment() {
    if (!existingSubmission || !attachmentUrl) return;
    setFileError("");
    setFileBusy(true);
    const supabase = createClient();

    const { error: dbError } = await supabase
      .from("assignment_submissions")
      .update({ attachment_url: null })
      .eq("id", existingSubmission.id);

    if (dbError) {
      setFileError(dbError.message);
      setFileBusy(false);
      return;
    }

    await deleteFile(supabase, SUBMISSION_FILES_BUCKET, attachmentUrl);
    setAttachmentUrl(null);
    setFileBusy(false);
    router.refresh();
  }

  async function saveSubmission(status: "draft" | "submitted") {
    setError("");
    setSuccess("");
    setFileError("");
    setLoading(true);

    const supabase = createClient();

    if (existingSubmission) {
      let newAttachmentUrl: string | undefined;
      if (pendingFile) {
        const path = buildStoragePath(existingSubmission.id, pendingFile.name);
        const { error: uploadError } = await uploadFile(
          supabase,
          SUBMISSION_FILES_BUCKET,
          path,
          pendingFile
        );
        if (uploadError) {
          setFileError(uploadError);
        } else {
          newAttachmentUrl = path;
        }
      }

      const { error: dbError } = await supabase
        .from("assignment_submissions")
        .update({
          answer_text: answer.trim() || null,
          status,
          ...(newAttachmentUrl ? { attachment_url: newAttachmentUrl } : {}),
        })
        .eq("id", existingSubmission.id);

      if (dbError) {
        setError(dbError.message);
        setLoading(false);
        return;
      }

      if (newAttachmentUrl) {
        setAttachmentUrl(newAttachmentUrl);
        setPendingFile(null);
      }
    } else {
      const { data, error: dbError } = await supabase
        .from("assignment_submissions")
        .insert({
          assignment_id: assignmentId,
          answer_text: answer.trim() || null,
          status,
        })
        .select("id")
        .single();

      if (dbError) {
        setError(dbError.message);
        setLoading(false);
        return;
      }

      if (pendingFile && data) {
        const path = buildStoragePath(data.id, pendingFile.name);
        const { error: uploadError } = await uploadFile(
          supabase,
          SUBMISSION_FILES_BUCKET,
          path,
          pendingFile
        );
        if (uploadError) {
          setFileError(uploadError);
        } else {
          const { error: attachError } = await supabase
            .from("assignment_submissions")
            .update({ attachment_url: path })
            .eq("id", data.id);
          if (attachError) {
            setFileError(attachError.message);
          } else {
            setAttachmentUrl(path);
            setPendingFile(null);
          }
        }
      }
    }

    setLoading(false);
    setConfirmSubmit(false);
    setSuccess(
      status === "submitted"
        ? "Assignment submitted successfully."
        : "Draft saved."
    );
    router.refresh();
  }

  // ── Graded view ──────────────────────────────────────────────

  if (isGraded && existingSubmission) {
    const pct =
      existingSubmission.score !== null &&
      existingSubmission.max_score !== null &&
      existingSubmission.max_score > 0
        ? Math.round(
            (existingSubmission.score / existingSubmission.max_score) * 100
          )
        : null;

    return (
      <div className="flex flex-col gap-5">
        {/* Grade display */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-green-600" aria-hidden="true" />
            <span className="text-sm font-semibold text-green-800">
              {existingSubmission.status === "returned"
                ? "Returned by teacher"
                : "Graded"}
            </span>
            {existingSubmission.graded_at && (
              <span className="text-xs text-green-700 ml-auto">
                {formatDateTime(existingSubmission.graded_at)}
              </span>
            )}
          </div>

          {existingSubmission.score !== null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-green-800">
                {existingSubmission.score}
              </span>
              {existingSubmission.max_score !== null && (
                <span className="text-base text-green-700">
                  / {existingSubmission.max_score}
                </span>
              )}
              {pct !== null && (
                <span className="text-sm font-medium text-green-600 ml-2">
                  {pct}%
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-green-700">No score recorded.</p>
          )}

          {existingSubmission.teacher_feedback && (
            <div className="mt-4 pt-4 border-t border-green-200">
              <p className="text-xs font-medium text-green-800 mb-1">
                Teacher feedback
              </p>
              <p className="text-sm text-green-900 whitespace-pre-line">
                {existingSubmission.teacher_feedback}
              </p>
            </div>
          )}
        </div>

        {/* Read-only answer */}
        {existingSubmission.answer_text && (
          <div>
            <p className="text-xs font-medium text-muted-text mb-2">
              Your submitted answer
            </p>
            <div className="bg-card-bg border border-soft-border rounded-xl px-4 py-3 text-sm text-dark-text whitespace-pre-line">
              {existingSubmission.answer_text}
            </div>
          </div>
        )}

        {/* Read-only attachment */}
        {attachmentUrl && (
          <div>
            <p className="text-xs font-medium text-muted-text mb-2">
              Attached file
            </p>
            <button
              type="button"
              onClick={handleViewAttachment}
              className="w-full flex items-center gap-2 bg-card-bg border border-soft-border rounded-xl px-4 py-3 text-left hover:border-primary/30 transition-colors"
            >
              <FileText size={14} className="text-primary shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm font-medium text-dark-text truncate">
                {fileNameFromPath(attachmentUrl)}
              </span>
              <Download size={14} className="text-muted-text shrink-0" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Submitted (past due) — read-only ─────────────────────────

  if (existingSubmission?.status === "submitted" && isPastDue) {
    return (
      <div className="flex flex-col gap-5">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex items-center gap-3">
          <Lock size={15} className="text-blue-600 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Submitted</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Submitted on {formatDateTime(existingSubmission.submitted_at)}.
              Waiting for your teacher to grade.
            </p>
          </div>
        </div>

        {existingSubmission.answer_text && (
          <div>
            <p className="text-xs font-medium text-muted-text mb-2">
              Your answer
            </p>
            <div className="bg-card-bg border border-soft-border rounded-xl px-4 py-3 text-sm text-dark-text whitespace-pre-line">
              {existingSubmission.answer_text}
            </div>
          </div>
        )}

        {attachmentUrl && (
          <div>
            <p className="text-xs font-medium text-muted-text mb-2">
              Attached file
            </p>
            <button
              type="button"
              onClick={handleViewAttachment}
              className="w-full flex items-center gap-2 bg-card-bg border border-soft-border rounded-xl px-4 py-3 text-left hover:border-primary/30 transition-colors"
            >
              <FileText size={14} className="text-primary shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm font-medium text-dark-text truncate">
                {fileNameFromPath(attachmentUrl)}
              </span>
              <Download size={14} className="text-muted-text shrink-0" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Editable form ─────────────────────────────────────────────

  if (!canEdit && existingSubmission) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
        <p className="text-sm text-amber-800">
          This assignment is locked for editing.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {existingSubmission?.status === "submitted" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <CheckCircle size={15} className="text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-blue-800">
              Submitted — {formatDateTime(existingSubmission.submitted_at)}
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              You can still edit your answer before the due date.
            </p>
          </div>
        </div>
      )}

      {existingSubmission?.status === "draft" && (
        <div className="bg-slate-50 border border-soft-border rounded-xl px-4 py-3">
          <p className="text-xs text-muted-text">
            Draft saved — {formatDateTime(existingSubmission.updated_at)}
          </p>
        </div>
      )}

      {/* Answer field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="answer-text"
          className="text-sm font-medium text-dark-text"
        >
          Your Answer
          {maxPoints > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-text">
              ({maxPoints} pts)
            </span>
          )}
        </label>
        <textarea
          id="answer-text"
          rows={8}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Write your answer here…"
          className={`${inputCls} resize-y`}
        />
      </div>

      {/* Attachment — optional file upload */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-dark-text">
          Attachment{" "}
          <span className="font-normal text-muted-text">(optional)</span>
        </label>

        {attachmentUrl && !pendingFile ? (
          <div className="flex items-center gap-2 bg-slate-50 border border-soft-border rounded-xl px-3.5 py-2.5">
            <FileText size={14} className="text-muted-text shrink-0" aria-hidden="true" />
            <button
              type="button"
              onClick={handleViewAttachment}
              className="min-w-0 flex-1 text-left text-sm font-medium text-dark-text hover:text-primary transition-colors truncate"
            >
              {fileNameFromPath(attachmentUrl)}
            </button>
            <Download size={13} className="text-muted-text shrink-0" aria-hidden="true" />
            <button
              type="button"
              onClick={handleRemoveAttachment}
              disabled={fileBusy}
              aria-label="Remove attached file"
              className="p-1 text-muted-text hover:text-red-600 rounded-md transition-colors disabled:opacity-60 shrink-0"
            >
              {fileBusy ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 size={13} aria-hidden="true" />
              )}
            </button>
          </div>
        ) : pendingFile ? (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2.5">
            <FileText size={14} className="text-primary shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm font-medium text-dark-text truncate">
              {pendingFile.name}
            </span>
            <span className="text-xs text-muted-text shrink-0">Will upload on save</span>
            <button
              type="button"
              onClick={() => setPendingFile(null)}
              aria-label="Remove selected file"
              className="p-1 text-muted-text hover:text-red-600 rounded-md transition-colors shrink-0"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <label className="inline-flex items-center gap-2 bg-slate-50 border border-dashed border-soft-border rounded-xl px-4 py-3 text-muted-text cursor-pointer hover:bg-slate-100 transition-colors w-fit">
            <Upload size={14} aria-hidden="true" />
            <span className="text-xs font-medium">Attach a file (PDF, PNG, or JPEG)</span>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="sr-only"
              onChange={handleFileSelect}
            />
          </label>
        )}

        {fileError && (
          <p role="alert" className="text-xs text-red-600">
            {fileError}
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3.5 py-2.5"
        >
          {success}
        </p>
      )}

      {/* Confirm submit overlay */}
      {confirmSubmit && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 flex flex-col gap-3">
          <p className="text-sm font-semibold text-amber-900">
            Are you sure you want to submit?
          </p>
          <p className="text-sm text-amber-800">
            {isPastDue
              ? "This assignment is past due. Your submission will be marked as late."
              : "Once submitted, your teacher will be able to review your work. You can still edit before the due date."}
          </p>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={() => saveSubmission("submitted")}
              className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {loading ? "Submitting…" : "Yes, Submit"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmSubmit(false)}
              className="px-4 text-sm text-muted-text hover:text-dark-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!confirmSubmit && (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => setConfirmSubmit(true)}
            className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            <Send size={14} aria-hidden="true" />
            Submit Assignment
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => saveSubmission("draft")}
            className="px-4 text-sm font-medium text-muted-text bg-card-bg border border-soft-border rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save Draft"}
          </button>
        </div>
      )}
    </div>
  );
}
