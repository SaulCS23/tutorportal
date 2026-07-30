import { formatInTimeZone } from "date-fns-tz";
import {
  DEFAULT_TIMEZONE,
  resolveTimeZone,
  zonedDateTimeToUtc,
  utcToZonedParts,
  formatZonedDate,
  formatZonedDateTime,
} from "./timezone";

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

/**
 * The app's documented fallback timezone — re-exported here so existing
 * imports of `APP_TIMEZONE` from lib/utils keep working. lib/timezone.ts
 * (as DEFAULT_TIMEZONE) is the source of truth; do not redefine this.
 */
export const APP_TIMEZONE = DEFAULT_TIMEZONE;

/**
 * Converts a "YYYY-MM-DD" date + "HH:MM" time, interpreted as wall-clock
 * time in `timeZone` (the *creator's* saved timezone — callers must pass
 * it explicitly, not rely on the APP_TIMEZONE default, for a correctly
 * viewer-independent absolute timestamp), into the real UTC instant it
 * represents. Thin wrapper over lib/timezone.ts#zonedDateTimeToUtc — see
 * that module for the actual conversion, kept in one place.
 *
 * Defaults the time to 23:59 when a date is chosen but no time is set,
 * so a due date is never silently dropped just because the time segment
 * wasn't touched (the original bug with a combined datetime-local input).
 */
export function combineDateAndTime(
  dateStr: string,
  timeStr: string,
  timeZone: string = APP_TIMEZONE
): string | null {
  if (!dateStr) return null;
  return zonedDateTimeToUtc(dateStr, timeStr || "23:59", timeZone).toISOString();
}

/**
 * The inverse of combineDateAndTime, for pre-filling an edit form: splits
 * a stored UTC instant back into the "YYYY-MM-DD" date and "HH:MM" time
 * it represents in `timeZone`.
 */
export function splitDateAndTime(
  iso: string,
  timeZone: string = APP_TIMEZONE
): { date: string; time: string } {
  return utcToZonedParts(iso, timeZone);
}

/**
 * Formats a stored due_at instant for display in `timeZone` — pass the
 * *viewer's* saved timezone, not the creator's. Every assignment
 * interface (teacher card, student homework list, assignment detail,
 * dashboard) uses this (or formatDueDateTime) instead of its own
 * toLocaleString call, so a due date reads identically everywhere for a
 * given viewer regardless of whether the code runs in the browser or on
 * the server.
 */
export function formatDueDate(iso: string | null, timeZone: string = APP_TIMEZONE): string {
  if (!iso) return "No due date";
  return formatZonedDate(iso, timeZone);
}

/** Same as formatDueDate but includes the time of day. */
export function formatDueDateTime(iso: string | null, timeZone: string = APP_TIMEZONE): string {
  if (!iso) return "No due date";
  return formatZonedDateTime(iso, timeZone);
}

// ── Schedule utilities ────────────────────────────────────────

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Formats a PostgreSQL time string ("HH:MM" or "HH:MM:SS") as
 * 12-hour time with AM/PM, e.g. "6:00 PM".
 */
export function formatTime(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? "0", 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Returns true only if the URL uses http or https.
 * Prevents rendering of javascript:, data:, and other unsafe protocols.
 */
export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Formats a Date using its *local* getters as "YYYY-MM-DD" — never
 * `toISOString()`, which reads UTC and can report the wrong calendar date
 * for part of the day depending on the runtime's timezone offset.
 */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parses a "YYYY-MM-DD" string into a local Date at midnight (never via
 * `new Date(string)`, which some browsers parse as UTC and can shift the
 * displayed day by one depending on the local timezone offset).
 */
export function parseLocalISODate(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/**
 * Returns "today" as a "YYYY-MM-DD" string in the given timezone —
 * usually the *viewer's* saved timezone; callers with no viewer context
 * (or nothing more precise available) fall back to APP_TIMEZONE. Reads
 * the calendar date directly via Intl in the target zone (formatInTimeZone),
 * never a local-getter round-trip, so a server running in UTC still
 * reports the correct calendar date for a viewer in any zone.
 */
export function todayISODateInTimezone(tz: string = APP_TIMEZONE): string {
  return formatInTimeZone(new Date(), resolveTimeZone(tz), "yyyy-MM-dd");
}
