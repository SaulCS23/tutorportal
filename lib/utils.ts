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
 * Returns the number of days from today until the next occurrence of
 * `dayOfWeek` at `startTime` in `tz`.
 *
 * Returns 0 when the occurrence is later today.
 * Returns 7 when the occurrence is exactly one week away (same day/time passed).
 *
 * Uses `toLocaleString('en-US', { timeZone })` to derive local clock values
 * without importing a large calendar library.
 */
export function daysUntilNext(
  dayOfWeek: number,
  startTime: string,
  tz: string = "America/Panama"
): number {
  const now = new Date();
  // Derive the current time in the target timezone
  const localNow = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const todayDay = localNow.getDay();
  const [h, m] = startTime.split(":").map(Number);
  const schedMins = h * 60 + m;
  const nowMins = localNow.getHours() * 60 + localNow.getMinutes();

  let d = (dayOfWeek - todayDay + 7) % 7;
  // If it's the same weekday but the time has already passed, use next week
  if (d === 0 && nowMins >= schedMins) d = 7;
  return d;
}

/**
 * Finds and returns the schedule entry (from a pre-fetched list) that
 * occurs soonest, or null if the list is empty.
 */
export function findNextSchedule<T extends { day_of_week: number; start_time: string; timezone: string }>(
  schedules: T[]
): T | null {
  if (schedules.length === 0) return null;
  return schedules.reduce((best, s) => {
    const dB = daysUntilNext(best.day_of_week, best.start_time, best.timezone);
    const dS = daysUntilNext(s.day_of_week, s.start_time, s.timezone);
    if (dS < dB) return s;
    if (dS === dB && s.start_time < best.start_time) return s;
    return best;
  });
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
 * Returns "today" as a "YYYY-MM-DD" string in the given timezone (default
 * America/Panama, this app's default business timezone — there is no
 * per-user timezone stored anywhere). Computed via `toLocaleString` in the
 * target zone plus local getters, never `toISOString()`, so a server
 * running in UTC still reports the correct calendar date for a
 * Panama-based user during the ~5 hour UTC/Panama offset window.
 */
export function todayISODateInTimezone(tz: string = "America/Panama"): string {
  const localNow = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  return toLocalISODate(localNow);
}
