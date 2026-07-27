"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface EditClassFormProps {
  classId: string;
  currentName: string;
  currentSubject: string | null;
  currentDescription?: string | null;
  currentStartDate?: string | null;
}

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";

export default function EditClassForm({
  classId,
  currentName,
  currentSubject,
  currentDescription,
  currentStartDate,
}: EditClassFormProps) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [subject, setSubject] = useState(currentSubject ?? "");
  const [description, setDescription] = useState(currentDescription ?? "");
  const [startDate, setStartDate] = useState(currentStartDate ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!name.trim()) {
      setError("Class name cannot be blank.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("classes")
      .update({
        name: name.trim(),
        subject: subject.trim() || null,
        description: description.trim() || null,
        start_date: startDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", classId);

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="className" className="text-sm font-medium text-dark-text">
          Class Name
        </label>
        <input
          id="className"
          type="text"
          required
          value={name}
          onChange={(e) => { setName(e.target.value); setSuccess(false); }}
          className={inputCls}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="classSubject" className="text-sm font-medium text-dark-text">
            Subject{" "}
            <span className="font-normal text-muted-text">(optional)</span>
          </label>
          <input
            id="classSubject"
            type="text"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setSuccess(false); }}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="classStartDate" className="text-sm font-medium text-dark-text">
            Start Date{" "}
            <span className="font-normal text-muted-text">(optional)</span>
          </label>
          <input
            id="classStartDate"
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setSuccess(false); }}
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="classDescription" className="text-sm font-medium text-dark-text">
          Description{" "}
          <span className="font-normal text-muted-text">(optional)</span>
        </label>
        <textarea
          id="classDescription"
          rows={2}
          value={description}
          onChange={(e) => { setDescription(e.target.value); setSuccess(false); }}
          placeholder="Brief description for students…"
          className={`${inputCls} resize-y`}
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

      {success && (
        <p
          role="status"
          className="text-sm text-success bg-green-50 border border-green-200 rounded-xl px-3.5 py-2.5"
        >
          Class updated.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
