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
 * The app's single default business timezone. Assignment due dates have
 * no per-row timezone column (unlike class_meetings/class_schedules) —
 * every teacher-entered date/time is interpreted in this zone, and every
 * display of a due date is formatted back into this same zone, so the
 * two always agree regardless of the viewer's own browser timezone or
 * the server's runtime timezone (Vercel runs in UTC).
 */
export const APP_TIMEZONE = "America/Panama";

/**
 * Converts a "YYYY-MM-DD" date + "HH:MM" time, interpreted as wall-clock
 * time in `timeZone`, into the real UTC instant it represents — the one
 * function every assignment form must use to turn a teacher-entered due
 * date into a stored `due_at`. Never mixes UTC and local getters: it
 * treats the input purely as "this wall clock, in this named zone" and
 * asks `Intl.DateTimeFormat` (which understands real IANA zone rules)
 * what that resolves to, rather than assuming the runtime's own
 * timezone the way `new Date(y, m, d, h, min)` would.
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
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = (timeStr || "23:59").split(":").map(Number);
  if (!y || !m || !d) return null;

  // First guess: treat the wall-clock components as if they were UTC.
  const utcGuess = Date.UTC(y, m - 1, d, h || 0, min || 0);

  // Ask what that instant actually reads as in the target zone.
  const parts = formatPartsInZone(new Date(utcGuess), timeZone);
  const hourValue = Number(parts.hour) % 24; // hour12:false can format midnight as "24"
  const asUtcOfFormatted = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hourValue,
    Number(parts.minute),
    Number(parts.second)
  );

  // The gap between "what we guessed" and "what that guess reads as in
  // the zone" is exactly the zone's offset at this date — remove it once.
  const offset = asUtcOfFormatted - utcGuess;
  return new Date(utcGuess - offset).toISOString();
}

function formatPartsInZone(date: Date, timeZone: string): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) parts[part.type] = part.value;
  return parts;
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
  const parts = formatPartsInZone(new Date(iso), timeZone);
  const hourValue = String(Number(parts.hour) % 24).padStart(2, "0");
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hourValue}:${parts.minute}`,
  };
}

/**
 * Formats a stored due_at instant for display — always in `timeZone`
 * (default America/Panama). Every assignment interface (teacher card,
 * student homework list, assignment detail, dashboard) uses this (or
 * formatDueDateTime) instead of its own toLocaleString call, so a due
 * date reads identically everywhere regardless of whether the code runs
 * in the browser or on the server.
 */
export function formatDueDate(iso: string | null, timeZone: string = APP_TIMEZONE): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Same as formatDueDate but includes the time of day. */
export function formatDueDateTime(iso: string | null, timeZone: string = APP_TIMEZONE): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleString("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
