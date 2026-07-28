import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Link as LinkIcon } from "lucide-react";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import type { ClassMeetingWithTeacher } from "@/lib/supabase/helpers";
import { getInitials, DAY_NAMES, formatTime, isSafeUrl } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";
import CopyButton from "@/components/ui/CopyButton";
import StatusBadge from "@/components/ui/StatusBadge";

export const metadata: Metadata = { title: "Schedule" };

type ScheduleRow = {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  meeting_provider: string | null;
  meeting_link: string | null;
  meeting_id: string | null;
  meeting_passcode: string | null;
  location: string | null;
  classes: { name: string; subject: string | null; teacher_id: string } | null;
};

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

const formatMeetingDate = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default async function SchedulePage() {
  const profile = await getCurrentProfile();
  const isTeacher = profile?.role === "teacher";
  const supabase = await createClient();

  const [{ data }, { data: meetingsData }] = await Promise.all([
    supabase
      .from("class_schedules")
      .select(
        "id, class_id, day_of_week, start_time, end_time, timezone, meeting_provider, meeting_link, meeting_id, meeting_passcode, location, classes ( name, subject, teacher_id )"
      )
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("class_meetings")
      .select(
        "id, class_id, title, description, meeting_date, start_time, end_time, timezone, meeting_provider, meeting_link, location, status, created_at, updated_at, classes ( name, subject, teacher_id )"
      )
      .order("meeting_date", { ascending: true })
      .order("start_time", { ascending: true }),
  ]);

  const schedules = (data as unknown as ScheduleRow[]) ?? [];
  const meetings = (meetingsData as unknown as ClassMeetingWithTeacher[]) ?? [];

  const today = todayISODate();
  const upcomingMeetings = meetings.filter((m) => m.meeting_date >= today);
  const pastMeetings = meetings
    .filter((m) => m.meeting_date < today)
    .sort((a, b) => (a.meeting_date < b.meeting_date ? 1 : -1));

  // For student view, batch-load teacher names (schedules + meetings combined)
  let teacherMap: Record<string, string> = {};
  if (!isTeacher) {
    const teacherIds = [
      ...new Set(
        [...schedules, ...meetings]
          .map((s) => s.classes?.teacher_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    if (teacherIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds);
      teacherMap = Object.fromEntries(
        (profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])
      );
    }
  }

  // Group by day_of_week, maintain weekday order (0=Sun … 6=Sat)
  const grouped = new Map<number, ScheduleRow[]>();
  for (const s of schedules) {
    const d = s.day_of_week;
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d)!.push(s);
  }
  const sortedDays = [...grouped.keys()].sort((a, b) => a - b);

  const emptyMessage = isTeacher
    ? "You have not added any classes meetings or schedules yet. Open a class and use the Meetings or Schedule tab."
    : "None of your classes have meetings or a weekly schedule yet.";

  const nothingAtAll = schedules.length === 0 && meetings.length === 0;

  return (
    <div>
      <TopBar
        title="Schedule"
        initials={getInitials(profile?.first_name, profile?.last_name)}
      />

      <div className="mb-6">
        <p className="text-muted-text text-sm">
          Your classes&apos; meetings and weekly schedule.
        </p>
      </div>

      {nothingAtAll ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <CalendarDays size={22} className="text-muted-text" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted-text max-w-xs">{emptyMessage}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {meetings.length > 0 && (
            <section aria-labelledby="meetings-heading">
              <h2
                id="meetings-heading"
                className="text-base font-semibold text-dark-text mb-3 pb-2 border-b border-soft-border"
              >
                Meetings
              </h2>

              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-3">
                    Upcoming
                  </h3>
                  {upcomingMeetings.length === 0 ? (
                    <p className="text-sm text-muted-text">No upcoming meetings.</p>
                  ) : (
                    <ul className="flex flex-col gap-3" role="list">
                      {upcomingMeetings.map((m) => {
                        const className = m.classes?.name ?? "Unknown Class";
                        const teacherName = m.classes?.teacher_id
                          ? teacherMap[m.classes.teacher_id]
                          : null;
                        const safeLink = isSafeUrl(m.meeting_link) ? m.meeting_link! : null;

                        return (
                          <li
                            key={m.id}
                            className="bg-card-bg border border-soft-border rounded-2xl shadow-card overflow-hidden"
                          >
                            <div className="px-5 py-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Link
                                      href={
                                        isTeacher
                                          ? `/teacher/classes/${m.class_id}`
                                          : `/classes/${m.class_id}`
                                      }
                                      className="text-sm font-semibold text-dark-text hover:text-primary transition-colors"
                                    >
                                      {className}
                                    </Link>
                                    <StatusBadge status={m.status} />
                                  </div>
                                  <p className="text-xs text-muted-text mt-0.5">{m.title}</p>
                                  {!isTeacher && teacherName && (
                                    <p className="text-xs text-muted-text mt-0.5">{teacherName}</p>
                                  )}
                                </div>
                                {m.meeting_provider && (
                                  <span className="text-xs font-medium text-muted-text bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                                    {m.meeting_provider}
                                  </span>
                                )}
                              </div>

                              <p className="text-sm text-muted-text mt-2">
                                {formatMeetingDate(m.meeting_date)} · {formatTime(m.start_time)} – {formatTime(m.end_time)}{" "}
                                <span className="text-slate-400 text-xs">({m.timezone})</span>
                              </p>
                            </div>

                            {(m.location || safeLink) && (
                              <div className="border-t border-soft-border px-5 py-3 flex flex-col gap-2">
                                {m.location && (
                                  <p className="text-xs text-muted-text">
                                    <span className="font-medium text-dark-text">Location:</span> {m.location}
                                  </p>
                                )}
                                {safeLink && (
                                  <a
                                    href={safeLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dark transition-colors mt-1"
                                  >
                                    <LinkIcon size={14} aria-hidden="true" />
                                    {m.meeting_provider === "Google Meet" ? "Join Google Meet" : "Join Meeting"}
                                  </a>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {pastMeetings.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-3">
                      Past
                    </h3>
                    <ul className="flex flex-col gap-3" role="list">
                      {pastMeetings.map((m) => {
                        const className = m.classes?.name ?? "Unknown Class";
                        return (
                          <li
                            key={m.id}
                            className="bg-card-bg border border-soft-border rounded-2xl shadow-card px-5 py-4 opacity-80"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-dark-text">{className}</span>
                                  <StatusBadge status={m.status} />
                                </div>
                                <p className="text-xs text-muted-text mt-0.5">{m.title}</p>
                              </div>
                            </div>
                            <p className="text-sm text-muted-text mt-2">
                              {formatMeetingDate(m.meeting_date)} · {formatTime(m.start_time)} – {formatTime(m.end_time)}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {schedules.length > 0 && (
          <section aria-labelledby="weekly-schedule-heading">
            <h2
              id="weekly-schedule-heading"
              className="text-base font-semibold text-dark-text mb-3 pb-2 border-b border-soft-border"
            >
              Weekly Schedule
            </h2>
            <div className="flex flex-col gap-8">
          {sortedDays.map((day) => (
            <section key={day} aria-labelledby={`sched-day-${day}`}>
              <h2
                id={`sched-day-${day}`}
                className="text-base font-semibold text-dark-text mb-3 pb-2 border-b border-soft-border"
              >
                {DAY_NAMES[day]}
              </h2>
              <ul className="flex flex-col gap-3" role="list">
                {grouped.get(day)!.map((s) => {
                  const className = s.classes?.name ?? "Unknown Class";
                  const teacherName = s.classes?.teacher_id
                    ? teacherMap[s.classes.teacher_id]
                    : null;
                  const safeLink = isSafeUrl(s.meeting_link)
                    ? s.meeting_link!
                    : null;

                  return (
                    <li
                      key={s.id}
                      className="bg-card-bg border border-soft-border rounded-2xl shadow-card overflow-hidden"
                    >
                      {/* Card header */}
                      <div className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={
                                isTeacher
                                  ? `/teacher/classes/${s.class_id}`
                                  : `/classes/${s.class_id}`
                              }
                              className="text-sm font-semibold text-dark-text hover:text-primary transition-colors"
                            >
                              {className}
                            </Link>
                            {s.classes?.subject && (
                              <p className="text-xs text-muted-text mt-0.5">
                                {s.classes.subject}
                              </p>
                            )}
                            {!isTeacher && teacherName && (
                              <p className="text-xs text-muted-text mt-0.5">
                                {teacherName}
                              </p>
                            )}
                          </div>
                          {s.meeting_provider && (
                            <span className="text-xs font-medium text-muted-text bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                              {s.meeting_provider}
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-muted-text mt-2">
                          {formatTime(s.start_time)} – {formatTime(s.end_time)}{" "}
                          <span className="text-slate-400 text-xs">
                            ({s.timezone})
                          </span>
                        </p>
                      </div>

                      {/* Meeting details */}
                      {(s.location ||
                        s.meeting_id ||
                        s.meeting_passcode ||
                        safeLink) && (
                        <div className="border-t border-soft-border px-5 py-3 flex flex-col gap-2">
                          {s.location && (
                            <p className="text-xs text-muted-text">
                              <span className="font-medium text-dark-text">
                                Location:
                              </span>{" "}
                              {s.location}
                            </p>
                          )}
                          {s.meeting_id && (
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-text">
                                <span className="font-medium text-dark-text">
                                  Meeting ID:
                                </span>{" "}
                                {s.meeting_id}
                              </p>
                              <CopyButton
                                text={s.meeting_id}
                                label="meeting ID"
                              />
                            </div>
                          )}
                          {s.meeting_passcode && (
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-text">
                                <span className="font-medium text-dark-text">
                                  Passcode:
                                </span>{" "}
                                {s.meeting_passcode}
                              </p>
                              <CopyButton
                                text={s.meeting_passcode}
                                label="passcode"
                              />
                            </div>
                          )}
                          {safeLink && (
                            <a
                              href={safeLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dark transition-colors mt-1"
                            >
                              <LinkIcon size={14} aria-hidden="true" />
                              {s.meeting_provider === "Google Meet"
                                ? "Join Google Meet"
                                : "Join Meeting"}
                            </a>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
            </div>
          </section>
          )}
        </div>
      )}
    </div>
  );
}
