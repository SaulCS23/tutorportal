import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNED_URL_TTL_SECONDS = 300;

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Builds a storage object path scoped under an owning row's id, e.g.
 * "{assignmentId}/{uuid}-{file name}" or "{submissionId}/{uuid}-{file name}".
 * The owning id must be the first path segment — RLS policies on
 * storage.objects recover it via storage.foldername(name)[1].
 */
export function buildStoragePath(ownerId: string, fileName: string): string {
  return `${ownerId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}

export async function uploadFile(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  return { error: error?.message ?? null };
}

export async function getSignedFileUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return { url: data?.signedUrl ?? null, error: error?.message ?? null };
}

export async function deleteFile(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return { error: error?.message ?? null };
}

/** Recovers the original file name from a path built by buildStoragePath. */
export function fileNameFromPath(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.length > 37 ? last.slice(37) : last;
}
