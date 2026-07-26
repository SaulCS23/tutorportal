export function getInitials(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  const first = parts[0][0].toUpperCase();
  const last = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : "";
  return first + last;
}
