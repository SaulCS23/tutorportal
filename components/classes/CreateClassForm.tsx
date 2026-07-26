"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CreatedClass = { id: string; name: string; join_code: string };
type ViewState = "idle" | "form" | "success";

export default function CreateClassForm() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>("idle");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedClass | null>(null);
  const [copied, setCopied] = useState(false);

  function openForm() {
    setName("");
    setSubject("");
    setError("");
    setView("form");
  }

  function cancel() {
    setView("idle");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Class name is required.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Session expired. Please sign in again.");
      setLoading(false);
      return;
    }

    const { data, error: dbError } = await supabase
      .from("classes")
      .insert({
        name: name.trim(),
        subject: subject.trim() || null,
        teacher_id: user.id,
      })
      .select("id, name, join_code")
      .single();

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    setCreated(data as CreatedClass);
    setView("success");
    setLoading(false);
  }

  async function copyCode() {
    if (!created) return;
    await navigator.clipboard.writeText(created.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function done() {
    setView("idle");
    setCreated(null);
    setCopied(false);
    router.refresh();
  }

  if (view === "success" && created) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
        <p className="text-sm font-semibold text-success mb-1">
          Class created — {created.name}
        </p>
        <p className="text-sm text-muted-text mb-4">
          Share this code with your students so they can join.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold tracking-widest text-dark-text font-mono">
            {created.join_code}
          </span>
          <button
            type="button"
            onClick={copyCode}
            aria-label="Copy join code"
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            {copied ? (
              <Check size={14} className="text-success" />
            ) : (
              <Copy size={14} />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          onClick={done}
          className="mt-5 text-sm font-medium text-primary hover:underline"
        >
          Done
        </button>
      </div>
    );
  }

  if (view === "form") {
    return (
      <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6 mb-6">
        <h2 className="text-base font-semibold text-dark-text mb-4">
          New Class
        </h2>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cls-name" className="text-sm font-medium text-dark-text">
              Class Name <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="cls-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SAT Math"
              className="w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cls-subject" className="text-sm font-medium text-dark-text">
              Subject <span className="text-muted-text font-normal">(optional)</span>
            </label>
            <input
              id="cls-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Math, Reading & Writing"
              className="w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Creating…" : "Create Class"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="px-4 text-sm font-medium text-muted-text hover:text-dark-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={openForm}
        className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-dark transition-colors"
      >
        <Plus size={16} aria-hidden="true" />
        Create Class
      </button>
    </div>
  );
}
