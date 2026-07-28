"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Pencil, X, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import DeleteAssignmentButton from "./DeleteAssignmentButton";
import AssignmentFileManager from "./AssignmentFileManager";

export type Assignment = {
  id: string;
  title: string;
  instructions: string | null;
  due_at: string | null;
  points: number;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function AssignmentCard({
  assignment,
  classId,
}: {
  assignment: Assignment;
  classId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(assignment.title);
  const [instructions, setInstructions] = useState(assignment.instructions ?? "");
  const [dueAt, setDueAt] = useState(
    assignment.due_at ? toDatetimeLocal(assignment.due_at) : ""
  );
  const [points, setPoints] = useState(String(assignment.points));
  const [status, setStatus] = useState<"draft" | "published">(assignment.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function cancelEdit() {
    setTitle(assignment.title);
    setInstructions(assignment.instructions ?? "");
    setDueAt(assignment.due_at ? toDatetimeLocal(assignment.due_at) : "");
    setPoints(String(assignment.points));
    setStatus(assignment.status);
    setError("");
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Title is required."); return; }
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts < 0) { setError("Points must be 0 or greater."); return; }

    setLoading(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("assignments")
      .update({
        title: title.trim(),
        instructions: instructions.trim() || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        points: pts,
        status,
      })
      .eq("id", assignment.id);

    setLoading(false);
    if (dbError) { setError(dbError.message); return; }
    setEditing(false);
    router.refresh();
  }

  const isOverdue =
    assignment.due_at &&
    new Date(assignment.due_at) < new Date() &&
    assignment.status === "published";

  return (
    <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
          <BookOpen size={14} className="text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-dark-text">{assignment.title}</h3>
            <StatusBadge status={assignment.status} />
            {isOverdue && (
              <span className="text-xs font-medium text-red-500">Overdue</span>
            )}
          </div>
          <p className="text-xs text-muted-text mt-0.5">
            {assignment.due_at
              ? `Due ${formatDate(assignment.due_at)}`
              : "No due date"}{" "}
            · {assignment.points} pts
          </p>
        </div>
        <button
          type="button"
          onClick={() => (editing ? cancelEdit() : setEditing(true))}
          aria-label={editing ? "Cancel edit" : "Edit assignment"}
          className="p-1.5 text-muted-text hover:text-dark-text hover:bg-slate-100 rounded-lg transition-colors shrink-0"
        >
          {editing ? (
            <X size={15} aria-hidden="true" />
          ) : (
            <Pencil size={15} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Instructions + submissions link (display mode) */}
      {!editing && (
        <div className="px-5 pb-4 border-t border-soft-border">
          {assignment.instructions && (
            <p className="text-sm text-muted-text mt-3 mb-3 line-clamp-2">
              {assignment.instructions}
            </p>
          )}
          <div className={assignment.instructions ? "" : "mt-3"}>
            <Link
              href={`/teacher/classes/${classId}/assignments/${assignment.id}/submissions`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors border border-blue-100"
            >
              <Users size={12} aria-hidden="true" />
              View Submissions
            </Link>
          </div>
        </div>
      )}

      {/* Files (display mode) */}
      {!editing && <AssignmentFileManager assignmentId={assignment.id} />}

      {/* Edit form */}
      {editing && (
        <div className="border-t border-soft-border px-5 py-4">
          <form onSubmit={handleSave} noValidate className="flex flex-col gap-4">
            <FieldLabel label="Title" required>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
              />
            </FieldLabel>

            <FieldLabel label="Instructions" optional>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                className={inputCls + " resize-y"}
              />
            </FieldLabel>

            <div className="grid sm:grid-cols-2 gap-3">
              <FieldLabel label="Due Date" optional>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className={inputCls}
                />
              </FieldLabel>
              <FieldLabel label="Points">
                <input
                  type="number"
                  min="0"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className={inputCls}
                />
              </FieldLabel>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-dark-text">Published</span>
              <button
                type="button"
                role="switch"
                aria-checked={status === "published"}
                onClick={() =>
                  setStatus(status === "draft" ? "published" : "draft")
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                  status === "published" ? "bg-primary" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    status === "published" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {error && (
              <p
                role="alert"
                className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5"
              >
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 text-sm text-muted-text hover:text-dark-text transition-colors"
              >
                Cancel
              </button>
              <DeleteAssignmentButton assignmentId={assignment.id} />
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "draft" | "published" }) {
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        status === "published"
          ? "bg-green-100 text-green-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {status === "published" ? "Published" : "Draft"}
    </span>
  );
}

function FieldLabel({
  label,
  children,
  required,
  optional,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-dark-text">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-muted-text">(optional)</span>
        )}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";
