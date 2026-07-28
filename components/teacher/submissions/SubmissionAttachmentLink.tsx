"use client";

import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSignedFileUrl, fileNameFromPath } from "@/lib/supabase/storage";

const BUCKET = "submission-files";

export default function SubmissionAttachmentLink({
  path,
}: {
  path: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { url, error: signError } = await getSignedFileUrl(
      supabase,
      BUCKET,
      path
    );
    setLoading(false);
    if (signError || !url) {
      setError(signError ?? "Could not open file.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center gap-2 bg-slate-50 border border-soft-border rounded-xl px-4 py-3 text-left hover:border-primary/30 transition-colors disabled:opacity-60"
      >
        <FileText size={14} className="text-primary shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-sm font-medium text-dark-text truncate">
          {fileNameFromPath(path)}
        </span>
        {loading ? (
          <Loader2 size={14} className="text-muted-text animate-spin shrink-0" aria-hidden="true" />
        ) : (
          <Download size={14} className="text-muted-text shrink-0" aria-hidden="true" />
        )}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
