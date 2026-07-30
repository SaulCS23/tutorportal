import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

/**
 * ============================================================
 * Shared timezone architecture — the single place every date/time
 * conversion, validation, and viewer-local formatting decision is made.
 * Nothing else in the app should call Intl.DateTimeFormat, toLocaleString,
 * toLocaleDateString, toLocaleTimeString, or do manual offset math for a
 * *stored, absolute* date/time — import from here instead.
 *
 * Built on date-fns-tz, which resolves real IANA tzdata rules (including
 * DST transitions) the same way Postgres's `AT TIME ZONE` does — never a
 * hand-rolled UTC-offset calculation.
 *
 * Two primitives everything else composes from:
 *   - fromZonedTime(naiveString, tz)  → wall-clock-in-tz to real UTC instant
 *   - formatInTimeZone(instant, tz, fmt) → real UTC instant to a string
 *     formatted as wall-clock-in-tz
 * Deliberately NOT using date-fns-tz's toZonedTime + local Date getters
 * anywhere in this file — reading a shifted Date's local getters only
 * gives the right answer if you know what timezone the *runtime* itself
 * is in (server vs. browser differ), which is exactly the kind of
 * environment-dependent footgun this module exists to avoid.
 * ============================================================
 */

/** The app's documented fallback timezone — used only when a viewer or
 *  creator has no saved/valid timezone yet (never overwrites a real one;
 *  see profiles.timezone and set_own_timezone_if_unset, 20240119). */
export const DEFAULT_TIMEZONE = "America/Panama";

/**
 * The curated timezone list for every picker in the app (Account page,
 * meeting/schedule creation and edit forms) — one shared list instead of
 * the same array duplicated per form.
 */
export const TIMEZONE_OPTIONS = [
  { value: "America/Panama", label: "America/Panama (UTC-5)" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Denver", label: "America/Denver" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "America/Bogota", label: "America/Bogota" },
  { value: "America/Lima", label: "America/Lima" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Madrid", label: "Europe/Madrid" },
  { value: "UTC", label: "UTC" },
] as const;

/** True for any real, resolvable IANA zone name. */
export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    // Throws RangeError for an unrecognized zone name — the standard way
    // to ask the platform's own tzdata whether a name is real.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** A valid zone name, or DEFAULT_TIMEZONE if the input is missing/invalid. */
export function resolveTimeZone(tz: string | null | undefined): string {
  return isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}

/** The browser's own IANA zone, or DEFAULT_TIMEZONE if detection is
 *  unavailable or returns something unrecognized. Client-side only. */
export function detectBrowserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return resolveTimeZone(tz);
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Converts a "YYYY-MM-DD" date + "HH:MM" (or "HH:MM:SS") time, interpreted
 * as wall-clock time in `timeZone`, into the real UTC instant it
 * represents. The one function every creation form (meeting, schedule,
 * assignment due date) uses to turn a creator-entered local date/time
 * into a stored absolute timestamp.
 */
export function zonedDateTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const tz = resolveTimeZone(timeZone);
  const [h, m] = (timeStr || "00:00").split(":").map((v) => parseInt(v, 10) || 0);
  const naive = `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  return fromZonedTime(naive, tz);
}

/** The inverse of zonedDateTimeToUtc, for pre-filling an edit form: splits
 *  a stored UTC instant back into the "YYYY-MM-DD" date and "HH:MM" time
 *  it represents in `timeZone`. */
export function utcToZonedParts(iso: string, timeZone: string): { date: string; time: string } {
  const tz = resolveTimeZone(timeZone);
  const instant = new Date(iso);
  return {
    date: formatInTimeZone(instant, tz, "yyyy-MM-dd"),
    time: formatInTimeZone(instant, tz, "HH:mm"),
  };
}

/** Viewer-local date, e.g. "Jul 30, 2026". */
export function formatZonedDate(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  return formatInTimeZone(new Date(iso), resolveTimeZone(timeZone), "MMM d, yyyy");
}

/** Viewer-local time of day, e.g. "6:00 PM". */
export function formatZonedTime(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  return formatInTimeZone(new Date(iso), resolveTimeZone(timeZone), "h:mm a");
}

/** Viewer-local date and time, e.g. "Jul 30, 2026, 6:00 PM". */
export function formatZonedDateTime(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  return formatInTimeZone(new Date(iso), resolveTimeZone(timeZone), "MMM d, yyyy, h:mm a");
}

/** A plain "YYYY-MM-DD" date-only value, formatted for display — never
 *  timezone-shifted, since a date-only value has no instant to convert.
 *  Reuses the same day/month/year token layout as formatZonedDate so a
 *  date-only value and a timed value read consistently side by side. */
export function formatCalendarDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  // A pure calendar computation, deliberately via Date.UTC + UTC getters
  // read back through Intl with timeZone: "UTC" — never touches any real
  // timezone conversion, so the calendar date can never shift by a day.
  return formatInTimeZone(new Date(Date.UTC(y, m - 1, d)), "UTC", "MMM d, yyyy");
}

type ZonedMeeting = {
  meeting_date: string; // "YYYY-MM-DD"
  timezone: string;
};

/** The absolute UTC instant a meeting starts. */
export function getMeetingStartInstant(
  meeting: ZonedMeeting & { start_time: string }
): Date {
  return zonedDateTimeToUtc(meeting.meeting_date, meeting.start_time.slice(0, 5), meeting.timezone);
}

/** The absolute UTC instant a meeting ends. */
export function getMeetingEndInstant(meeting: ZonedMeeting & { end_time: string }): Date {
  return zonedDateTimeToUtc(meeting.meeting_date, meeting.end_time.slice(0, 5), meeting.timezone);
}

/**
 * The one shared "has this meeting actually ended" check, used by every
 * attendance summary/history/alert query instead of a meeting_date-only
 * cutoff — a meeting that ended earlier today is concluded the instant
 * its absolute end timestamp passes, not merely "the day is over".
 */
export function hasMeetingConcluded(
  meeting: ZonedMeeting & { end_time: string },
  now: Date = new Date()
): boolean {
  return getMeetingEndInstant(meeting) < now;
}

export type JoinAttendanceStatus = "present" | "late" | "absent";

/**
 * Present if joined at or before start+10min; late if after that but at
 * or before the meeting's end (inclusive); absent if after the end.
 * Mirrors record_meeting_join's SQL exactly (20240119 migration) — kept
 * here too so any client-side recomputation/verification always agrees
 * with what the database actually stored.
 */
export function computeJoinAttendanceStatus(
  meeting: ZonedMeeting & { start_time: string; end_time: string },
  joinedAt: Date
): JoinAttendanceStatus {
  const start = getMeetingStartInstant(meeting);
  const end = getMeetingEndInstant(meeting);
  const presentCutoff = new Date(start.getTime() + 10 * 60 * 1000);
  if (joinedAt <= presentCutoff) return "present";
  if (joinedAt <= end) return "late";
  return "absent";
}

/** A pure calendar-date computation (Gregorian day-of-week), never a
 *  real-timezone conversion — used to walk from one "YYYY-MM-DD" string
 *  to another without ever constructing an ambiguous local Date. */
function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** 0=Sunday…6=Saturday for a "YYYY-MM-DD" string, matching Date#getDay's
 *  convention — exported so callers deriving a weekday from a stored
 *  date-only column (e.g. class_meetings.meeting_date) never re-implement
 *  this calendar math themselves. */
export function weekdayOfDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * The next "YYYY-MM-DD" occurrence (in `timeZone`) of a recurring weekly
 * slot (dayOfWeek 0=Sunday…6=Saturday, matching Date#getDay) on or after
 * `now` — DST-safe, since the actual start instant is computed fresh via
 * zonedDateTimeToUtc (real IANA offset for that specific calendar date),
 * never a fixed day-count/offset assumption. Replaces the old
 * toLocaleString-round-trip implementation in lib/utils.ts#daysUntilNext.
 */
export function nextScheduleOccurrenceDate(
  dayOfWeek: number,
  startTime: string,
  timeZone: string,
  now: Date = new Date()
): string {
  const tz = resolveTimeZone(timeZone);
  const todayStr = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const todayDow = weekdayOfDateString(todayStr);
  const daysAhead = (dayOfWeek - todayDow + 7) % 7;
  let candidateStr = addDaysToDateString(todayStr, daysAhead);

  if (daysAhead === 0) {
    const occursAt = zonedDateTimeToUtc(candidateStr, startTime.slice(0, 5), tz);
    if (occursAt <= now) {
      candidateStr = addDaysToDateString(candidateStr, 7);
    }
  }
  return candidateStr;
}
