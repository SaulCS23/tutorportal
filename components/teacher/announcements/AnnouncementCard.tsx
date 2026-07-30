"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { Megaphone, Pencil, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useViewerTimezone } from "@/components/timezone/TimezoneProvider";
import DeleteAnnouncementButton from "./DeleteAnnouncementButton";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export default function AnnouncementCard({
  announcement,
}: {
  announcement: Announcement;
}) {
  const router = useRouter();
  const viewerTimezone = useViewerTimezone();
  const formatDate = (iso: string) => formatInTimeZone(new Date(iso), viewerTimezone, "MMM d, yyyy");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(announcement.title);
  const [body, setBody] = useState(announcement.body);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function cancelEdit() {
    setTitle(announcement.title);
    setBody(announcement.body);
    setError("");
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Title is required."); return; }
    if (!body.trim()) { setError("Message is required."); return; }

    setLoading(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("announcements")
      .update({ title: title.trim(), body: body.trim() })
      .eq("id", announcement.id);

    setLoading(false);
    if (dbError) { setError(dbError.message); return; }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
          <Megaphone size={14} className="text-warning" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-dark-text">{announcement.title}</h3>
          <p className="text-xs text-muted-text mt-0.5">
            {formatDate(announcement.created_at)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => (editing ? cancelEdit() : setEditing(true))}
          aria-label={editing ? "Cancel edit" : "Edit announcement"}
          className="p-1.5 text-muted-text hover:text-dark-text hover:bg-slate-100 rounded-lg transition-colors shrink-0"
        >
          {editing ? (
            <X size={15} aria-hidden="true" />
          ) : (
            <Pencil size={15} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Body preview (display mode) */}
      {!editing && (
        <div className="px-5 pb-4 border-t border-soft-border">
          <p className="text-sm text-muted-text mt-3 whitespace-pre-line line-clamp-4">
            {announcement.body}
          </p>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="border-t border-soft-border px-5 py-4">
          <form onSubmit={handleSave} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-dark-text">
                Title{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-dark-text">
                Message{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
              </label>
              <textarea
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
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
              <DeleteAnnouncementButton announcementId={announcement.id} />
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";
