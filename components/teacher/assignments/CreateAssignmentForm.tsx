"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { combineDateAndTime } from "@/lib/utils";
import DatePicker from "@/components/ui/DatePicker";

export default function CreateAssignmentForm({ classId }: { classId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [points, setPoints] = useState("0");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setTitle("");
    setInstructions("");
    setDueDate("");
    setDueTime("");
    setPoints("0");
    setStatus("draft");
    setError("");
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts < 0) {
      setError("Points must be 0 or greater.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: dbError } = await supabase.from("assignments").insert({
      class_id: classId,
      title: title.trim(),
      instructions: instructions.trim() || null,
      due_at: combineDateAndTime(dueDate, dueTime),
      points: pts,
      status,
    });

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    reset();
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-dark transition-colors"
      >
        <Plus size={16} aria-hidden="true" />
        New Assignment
      </button>
    );
  }

  return (
    <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6">
      <h2 className="text-base font-semibold text-dark-text mb-4">New Assignment</h2>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FieldLabel label="Title" required>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. SAT Math Practice Set 4"
            className={inputCls}
          />
        </FieldLabel>

        <FieldLabel label="Instructions" optional>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Add instructions for students…"
            rows={3}
            className={inputCls + " resize-y"}
          />
        </FieldLabel>

        <div className="grid sm:grid-cols-2 gap-3">
          <FieldLabel label="Due Date" optional>
            <div className="flex flex-col gap-2">
              <DatePicker value={dueDate} onChange={setDueDate} />
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                placeholder="Defaults to 11:59 PM"
                aria-label="Due time (optional, defaults to 11:59 PM)"
                className={inputCls}
              />
            </div>
          </FieldLabel>

          <FieldLabel label="Points" required>
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
          <span className="text-sm font-medium text-dark-text">Publish immediately</span>
          <Toggle
            checked={status === "published"}
            onChange={(v) => setStatus(v ? "published" : "draft")}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5"
          >
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Creating…" : "Create Assignment"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="px-4 text-sm font-medium text-muted-text hover:text-dark-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
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

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
        checked ? "bg-primary" : "bg-slate-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";
