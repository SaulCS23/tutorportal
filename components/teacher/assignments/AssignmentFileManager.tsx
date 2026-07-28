"use client";

import { useEffect, useState } from "react";
import { FileText, Upload, Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  buildStoragePath,
  uploadFile,
  getSignedFileUrl,
  deleteFile,
} from "@/lib/supabase/storage";

const BUCKET = "assignment-files";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB — matches the bucket's file_size_limit

type AssignmentFile = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssignmentFileManager({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const [files, setFiles] = useState<AssignmentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("assignment_files")
        .select("id, storage_path, file_name, mime_type, file_size, created_at")
        .eq("assignment_id", assignmentId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setFiles((data as AssignmentFile[]) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Only PDF files are supported.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File is too large. Maximum size is 20 MB.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const path = buildStoragePath(assignmentId, file.name);

    const { error: uploadError } = await uploadFile(
      supabase,
      BUCKET,
      path,
      file
    );
    if (uploadError) {
      setError(uploadError);
      setUploading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("assignment_files")
      .insert({
        assignment_id: assignmentId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || "application/pdf",
        file_size: file.size,
      })
      .select("id, storage_path, file_name, mime_type, file_size, created_at")
      .single();

    setUploading(false);
    if (insertError) {
      setError(insertError.message);
      await supabase.storage.from(BUCKET).remove([path]);
      return;
    }

    setFiles((prev) => [...prev, data as AssignmentFile]);
  }

  async function handleView(file: AssignmentFile) {
    setError("");
    const supabase = createClient();
    const { url, error: signError } = await getSignedFileUrl(
      supabase,
      BUCKET,
      file.storage_path
    );
    if (signError || !url) {
      setError(signError ?? "Could not open file.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(file: AssignmentFile) {
    setError("");
    setBusyId(file.id);
    const supabase = createClient();

    const { error: dbError } = await supabase
      .from("assignment_files")
      .delete()
      .eq("id", file.id);

    if (dbError) {
      setError(dbError.message);
      setBusyId(null);
      return;
    }

    await deleteFile(supabase, BUCKET, file.storage_path);
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    setBusyId(null);
  }

  return (
    <div className="border-t border-soft-border px-5 py-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
          Files
        </p>
        <label
          className={`inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors border border-blue-100 cursor-pointer ${
            uploading ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          {uploading ? (
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          ) : (
            <Upload size={12} aria-hidden="true" />
          )}
          {uploading ? "Uploading…" : "Upload PDF"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-muted-text">Loading files…</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-text">No files attached yet.</p>
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2 bg-slate-50 border border-soft-border rounded-xl px-3 py-2"
            >
              <FileText
                size={14}
                className="text-muted-text shrink-0"
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => handleView(file)}
                className="min-w-0 flex-1 text-left text-xs font-medium text-dark-text hover:text-primary transition-colors truncate"
              >
                {file.file_name}
              </button>
              <span className="text-xs text-muted-text shrink-0">
                {formatFileSize(file.file_size)}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(file)}
                disabled={busyId === file.id}
                aria-label={`Delete ${file.file_name}`}
                className="p-1 text-muted-text hover:text-red-600 rounded-md transition-colors disabled:opacity-60 shrink-0"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
