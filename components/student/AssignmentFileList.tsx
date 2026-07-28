"use client";

import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSignedFileUrl } from "@/lib/supabase/storage";

const BUCKET = "assignment-files";

export type AssignmentFile = {
  id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssignmentFileList({
  files,
}: {
  files: AssignmentFile[];
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (files.length === 0) return null;

  async function handleDownload(file: AssignmentFile) {
    setError("");
    setDownloadingId(file.id);
    const supabase = createClient();
    const { url, error: signError } = await getSignedFileUrl(
      supabase,
      BUCKET,
      file.storage_path
    );
    setDownloadingId(null);
    if (signError || !url) {
      setError(signError ?? "Could not open file.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="px-6 py-5 border-b border-soft-border">
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-3">
        Assignment Files
      </p>

      {error && (
        <p
          role="alert"
          className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3"
        >
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2" role="list">
        {files.map((file) => (
          <li key={file.id}>
            <button
              type="button"
              onClick={() => handleDownload(file)}
              disabled={downloadingId === file.id}
              className="w-full flex items-center gap-2 bg-slate-50 border border-soft-border rounded-xl px-3.5 py-2.5 text-left hover:bg-blue-50 hover:border-blue-100 transition-colors disabled:opacity-60"
            >
              <FileText
                size={14}
                className="text-primary shrink-0"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 text-sm font-medium text-dark-text truncate">
                {file.file_name}
              </span>
              <span className="text-xs text-muted-text shrink-0">
                {formatFileSize(file.file_size)}
              </span>
              {downloadingId === file.id ? (
                <Loader2
                  size={14}
                  className="text-muted-text animate-spin shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Download
                  size={14}
                  className="text-muted-text shrink-0"
                  aria-hidden="true"
                />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
