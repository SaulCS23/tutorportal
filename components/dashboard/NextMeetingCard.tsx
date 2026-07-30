"use client";

import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, Clock, Link as LinkIcon } from "lucide-react";
import { isSafeUrl } from "@/lib/utils";
import {
  nextScheduleOccurrenceDate,
  getMeetingStartInstant,
  getMeetingEndInstant,
  formatZonedTime,
} from "@/lib/timezone";
import { useViewerTimezone } from "@/components/timezone/TimezoneProvider";
import SectionHeading from "@/components/ui/SectionHeading";
import JoinMeetingLink from "@/components/schedule/JoinMeetingLink";
import { clickableCardProps, stopCardClick } from "@/lib/clickableCard";

export type NextMeeting = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  meeting_provider: string | null;
  meeting_link: string | null;
  location: string | null;
  classes: { name: string; subject: string | null } | null;
  /** The concrete class_meetings row for this occurrence, if one has
   *  been created yet — lets the Join button record attendance the same
   *  way every other real-meeting Join link does. Null/undefined for a
   *  pure recurring-template occurrence with no dated meeting yet. */
  meetingId?: string | null;
  /** The concrete "YYYY-MM-DD" calendar date this occurs on, when known
   *  (see scheduleItems.ts#getNextMeeting) — used instead of re-deriving
   *  a date from day_of_week/start_time, which only ever finds the
   *  nearest occurrence of that weekday within the next ~13 days and
   *  would be wrong for a concrete meeting (e.g. a rescheduled makeup)
   *  dated further out than that. Falls back to the day-of-week
   *  projection when absent (a pure recurring-template occurrence). */
  date?: string;
};

/**
 * The next meeting instant is resolved once, identically, by
 * scheduleItems.ts#getNextMeeting — the same helper the Schedule page
 * uses — so this card and the Schedule page can never disagree about
 * which meeting is "next" or at what time. The "Join" button uses
 * `meetingId` when a real class_meetings row is the winning occurrence,
 * so attendance is recorded exactly like every other real-meeting Join
 * link; it falls back to a plain, unrecorded link only when no dated
 * meeting exists yet and the recurring template's own projection won.
 */
export default function NextMeetingCard({ meeting }: { meeting: NextMeeting | null }) {
  const router = useRouter();
  const viewerTimezone = useViewerTimezone();

  if (!meeting) {
    return (
      <section aria-labelledby="next-lesson-heading">
        <SectionHeading title="Next Meeting" id="next-lesson-heading" />
        <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6 text-center text-sm text-muted-text">
          No upcoming meetings scheduled.
        </div>
      </section>
    );
  }

  const safeLink = isSafeUrl(meeting.meeting_link) ? meeting.meeting_link! : null;

  // day_of_week is the recurring slot's own weekday — resolve it to a
  // concrete calendar occurrence, then to absolute start/end instants,
  // so every displayed value (day name, date, time) is derived from the
  // same instant and shown in the viewer's timezone, never the raw
  // stored day_of_week/start_time/end_time/timezone fields directly.
  const occurrenceDate = meeting.date ?? nextScheduleOccurrenceDate(meeting.day_of_week, meeting.start_time, meeting.timezone);
  const startInstant = getMeetingStartInstant({
    meeting_date: occurrenceDate,
    start_time: meeting.start_time,
    timezone: meeting.timezone,
  });
  const endInstant = getMeetingEndInstant({
    meeting_date: occurrenceDate,
    end_time: meeting.end_time,
    timezone: meeting.timezone,
  });
  const dayLabel = formatInTimeZone(startInstant, viewerTimezone, "EEEE");
  const timeRangeLabel = `${formatZonedTime(startInstant.toISOString(), viewerTimezone)} – ${formatZonedTime(endInstant.toISOString(), viewerTimezone)}`;

  return (
    <section aria-labelledby="next-lesson-heading">
      <SectionHeading title="Next Meeting" id="next-lesson-heading" />
      <div
        {...clickableCardProps(() => router.push("/schedule"), "Open schedule")}
        className="bg-primary rounded-2xl p-6 text-white shadow-card cursor-pointer transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
      >
        <div className="flex items-center gap-2 text-blue-100 text-xs font-medium mb-4">
          <CalendarDays size={14} aria-hidden="true" />
          <span>Upcoming</span>
        </div>
        <h3 className="text-xl font-bold mb-1">
          {meeting.classes?.name ?? "Class"}
        </h3>
        {meeting.classes?.subject && (
          <p className="text-blue-100 text-sm mb-3">{meeting.classes.subject}</p>
        )}
        <dl className="grid grid-cols-2 gap-y-2 text-sm mb-5">
          <div className="flex items-center gap-2 col-span-2">
            <CalendarDays size={13} className="text-blue-200" aria-hidden="true" />
            <dt className="sr-only">Day</dt>
            <dd>{dayLabel}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-blue-200" aria-hidden="true" />
            <dt className="sr-only">Time</dt>
            <dd>{timeRangeLabel}</dd>
          </div>
          {meeting.meeting_provider && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Provider</dt>
              <dd className="text-blue-100">{meeting.meeting_provider}</dd>
            </div>
          )}
          {meeting.location && (
            <div className="flex items-center gap-2 col-span-2">
              <dt className="sr-only">Location</dt>
              <dd className="text-blue-100">{meeting.location}</dd>
            </div>
          )}
        </dl>

        {safeLink && meeting.meetingId ? (
          <JoinMeetingLink
            meetingId={meeting.meetingId}
            href={safeLink}
            onClick={stopCardClick}
            className="w-full flex items-center justify-center gap-2 bg-white/20 border border-white/30 text-white text-sm font-medium rounded-xl py-2.5 hover:bg-white/30 transition-colors"
          >
            <LinkIcon size={14} aria-hidden="true" />
            {meeting.meeting_provider === "Google Meet"
              ? "Join Google Meet"
              : "Join Meeting"}
          </JoinMeetingLink>
        ) : safeLink ? (
          <a
            href={safeLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stopCardClick}
            className="w-full flex items-center justify-center gap-2 bg-white/20 border border-white/30 text-white text-sm font-medium rounded-xl py-2.5 hover:bg-white/30 transition-colors"
          >
            <LinkIcon size={14} aria-hidden="true" />
            {meeting.meeting_provider === "Google Meet"
              ? "Join Google Meet"
              : "Join Meeting"}
          </a>
        ) : (
          <div className="w-full bg-white/10 border border-white/20 text-white/60 text-sm font-medium rounded-xl py-2.5 text-center">
            No meeting link
          </div>
        )}
      </div>
    </section>
  );
}
