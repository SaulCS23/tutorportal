/**
 * Returns two-letter initials for the avatar.
 *
 * Rules:
 *  - first + last given  → first letter of each  (Saul Assis → SA)
 *  - first only          → first two letters      (John → JO)
 *  - neither             → ?
 */
export function getInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string {
  const f = firstName?.trim();
  const l = lastName?.trim();

  if (!f) return "?";

  if (!l) {
    return f.length > 1
      ? (f[0] + f[1]).toUpperCase()
      : f[0].toUpperCase();
  }

  return (f[0] + l[0]).toUpperCase();
}
