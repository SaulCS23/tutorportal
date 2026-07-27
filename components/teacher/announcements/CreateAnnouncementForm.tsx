"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function CreateAnnouncementForm({ classId }: { classId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setTitle("");
    setBody("");
    setError("");
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Title is required."); return; }
    if (!body.trim()) { setError("Message is required."); return; }

    setLoading(true);
    const supabase = createClient();
    const { error: dbError } = await supabase.from("announcements").insert({
      class_id: classId,
      title: title.trim(),
      body: body.trim(),
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
        <Megaphone size={16} aria-hidden="true" />
        New Announcement
      </button>
    );
  }

  return (
    <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6">
      <h2 className="text-base font-semibold text-dark-text mb-4">New Announcement</h2>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ann-title" className="text-sm font-medium text-dark-text">
            Title{" "}
            <span className="text-red-500" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="ann-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Reminder: Practice Test this Saturday"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ann-body" className="text-sm font-medium text-dark-text">
            Message{" "}
            <span className="text-red-500" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="ann-body"
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your announcement here…"
            rows={4}
            className={inputCls + " resize-y"}
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
            {loading ? "Posting…" : "Post Announcement"}
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

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";
