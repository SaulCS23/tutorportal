import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Users, BookOpen, Megaphone, Clock, Link as LinkIcon } from "lucide-react";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import { getInitials, DAY_NAMES, formatTime, isSafeUrl, formatDueDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";
import CopyCodeButton from "@/components/classes/CopyCodeButton";
import CopyButton from "@/components/ui/CopyButton";
import EditClassForm from "@/components/classes/EditClassForm";
import RemoveStudentButton from "@/components/classes/RemoveStudentButton";
import DeleteClassButton from "@/components/classes/DeleteClassButton";
import LeaveClassButton from "@/components/classes/LeaveClassButton";
import StatusBadge from "@/components/ui/StatusBadge";
import JoinMeetingLink from "@/components/schedule/JoinMeetingLink";

export const metadata: Metadata = { title: "Class" };

type Props = { params: Promise<{ id: string }> };

type ClassRow = {
  id: string;
  name: string;
  subject: string | null;
  description: string | null;
  start_date: string | null;
  teacher_id: string;
  join_code: string;
  created_at: string;
};

type StudentRow = {
  student_id: string;
  full_name: string;
  email: string;
  joined_at: string;
};

type ScheduleRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  meeting_provider: string | null;
  meeting_link: string | null;
  meeting_id: string | null;
  meeting_passcode: string | null;
  location: string | null;
};

type AssignmentRow = {
  id: string;
  title: string;
  instructions: string | null;
  due_at: string | null;
  points: number;
  status: "draft" | "published";
};

type MeetingRow = {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  meeting_provider: string | null;
  meeting_link: string | null;
  location: string | null;
  status: "scheduled" | "completed" | "cancelled";
};

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatMeetingDate = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default async function ClassDetailPage({ params }: Props) {
  const { id } = await params;

  const [profile, supabase] = await Promise.all([
    getCurrentProfile(),
    createClient(),
  ]);

  const { data: cls } = await supabase
    .from("classes")
    .select(
      "id, name, subject, description, start_date, teacher_id, join_code, created_at"
    )
    .eq("id", id)
    .single();

  if (!cls) notFound();

  const typedCls = cls as ClassRow;
  const isOwner =
    profile?.role === "teacher" && typedCls.teacher_id === profile?.id;
  const isStudent = profile?.role === "student";

  const [teacherResult, countResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", typedCls.teacher_id)
      .single(),
    supabase
      .from("class_members")
      .select("*", { count: "exact", head: true })
      .eq("class_id", id),
  ]);

  const teacherName =
    (teacherResult.data as { full_name: string } | null)?.full_name ?? "Unknown";
  const memberCount = countResult.count ?? 0;

  // Parallel: students (teacher only), schedule, meetings, assignments, announcements
  const [
    studentsResult,
    schedulesResult,
    meetingsResult,
    assignmentsResult,
    announcementsResult,
  ] = await Promise.all([
      isOwner
        ? supabase.rpc("get_class_students", { p_class_id: id })
        : Promise.resolve({ data: [] }),
      supabase
        .from("class_schedules")
        .select(
          "id, day_of_week, start_time, end_time, timezone, meeting_provider, meeting_link, meeting_id, meeting_passcode, location"
        )
        .eq("class_id", id)
        .order("day_of_week")
        .order("start_time"),
      supabase
        .from("class_meetings")
        .select(
          "id, title, description, meeting_date, start_time, end_time, timezone, meeting_provider, meeting_link, location, status"
        )
        .eq("class_id", id)
        .order("meeting_date", { ascending: true })
        .order("start_time", { ascending: true }),
      supabase
        .from("assignments")
        .select("id, title, instructions, due_at, points, status")
        .eq("class_id", id)
        .order("due_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("announcements")
        .select("id, title, body, created_at")
        .eq("class_id", id)
        .order("created_at", { ascending: false }),
    ]);

  const students = (studentsResult.data as StudentRow[]) ?? [];
  const schedules = (schedulesResult.data as ScheduleRow[]) ?? [];
  const allMeetings = (meetingsResult.data as MeetingRow[]) ?? [];
  const allAssignments = (assignmentsResult.data as AssignmentRow[]) ?? [];
  const announcements = (announcementsResult.data as AnnouncementRow[]) ?? [];

  const todayISO = new Date().toISOString().slice(0, 10);
  const upcomingMeetings = allMeetings.filter((m) => m.meeting_date >= todayISO);

  // Students only see published assignments
  const visibleAssignments = isOwner
    ? allAssignments
    : allAssignments.filter((a) => a.status === "published");

  return (
    <div>
      <TopBar
        title={typedCls.name}
        initials={getInitials(profile?.first_name, profile?.last_name)}
      />

      <div className="mb-5">
        <Link
          href="/classes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-text hover:text-dark-text transition-colors"
        >
          <ChevronLeft size={15} aria-hidden="true" />
          My Classes
        </Link>
      </div>

      <div className="max-w-2xl flex flex-col gap-6">
        {/* Class summary */}
        <section
          aria-labelledby="class-info-heading"
          className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6"
        >
          <h2 id="class-info-heading" className="sr-only">
            Class information
          </h2>

          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-bold text-dark-text">
                {typedCls.name}
              </h2>
              {typedCls.subject && (
                <p className="mt-0.5 text-sm text-muted-text">
                  {typedCls.subject}
                </p>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-text shrink-0">
              <Users size={13} aria-hidden="true" />
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </span>
          </div>

          {typedCls.description && (
            <p className="text-sm text-dark-text leading-relaxed mb-4">
              {typedCls.description}
            </p>
          )}

          <dl className="flex flex-col gap-2 text-sm border-t border-soft-border pt-4">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-text">Teacher</dt>
              <dd className="font-medium text-dark-text">{teacherName}</dd>
            </div>
            {typedCls.start_date && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-text">Start Date</dt>
                <dd className="font-medium text-dark-text">
                  {formatDate(typedCls.start_date)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-text">Created</dt>
              <dd className="font-medium text-dark-text">
                {formatDate(typedCls.created_at)}
              </dd>
            </div>
          </dl>
        </section>

        {/* Teacher: join code */}
        {isOwner && (
          <section
            aria-labelledby="join-code-heading"
            className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6"
          >
            <h2
              id="join-code-heading"
              className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-4"
            >
              Join Code
            </h2>
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono font-bold text-dark-text tracking-widest text-2xl">
                {typedCls.join_code}
              </span>
              <CopyCodeButton code={typedCls.join_code} />
            </div>
          </section>
        )}

        {/* Upcoming Meetings */}
        {upcomingMeetings.length > 0 && (
          <section aria-labelledby="meetings-heading">
            <h2
              id="meetings-heading"
              className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
            >
              Upcoming Meetings
            </h2>
            <ul className="flex flex-col gap-3" role="list">
              {upcomingMeetings.map((m) => {
                const safeLink = isSafeUrl(m.meeting_link) ? m.meeting_link! : null;
                return (
                  <li
                    key={m.id}
                    className="bg-card-bg border border-soft-border rounded-2xl shadow-card overflow-hidden"
                  >
                    <div className="flex items-start gap-3 px-5 py-4">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock size={14} className="text-primary" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-dark-text">{m.title}</p>
                          <StatusBadge status={m.status} />
                        </div>
                        <p className="text-xs text-muted-text mt-0.5">
                          {formatMeetingDate(m.meeting_date)} · {formatTime(m.start_time)} – {formatTime(m.end_time)}{" "}
                          <span className="text-slate-400">({m.timezone})</span>
                        </p>
                        {m.meeting_provider && (
                          <p className="text-xs text-muted-text">{m.meeting_provider}</p>
                        )}
                      </div>
                    </div>
                    {(m.description || m.location || safeLink) && (
                      <div className="border-t border-soft-border px-5 py-3 flex flex-col gap-2">
                        {m.description && (
                          <p className="text-xs text-muted-text">{m.description}</p>
                        )}
                        {m.location && (
                          <p className="text-xs text-muted-text">
                            <span className="font-medium text-dark-text">Location:</span>{" "}
                            {m.location}
                          </p>
                        )}
                        {safeLink && (
                          <JoinMeetingLink
                            meetingId={m.id}
                            href={safeLink}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dark transition-colors mt-1"
                          >
                            <LinkIcon size={14} aria-hidden="true" />
                            {m.meeting_provider === "Google Meet"
                              ? "Join Google Meet"
                              : "Join Meeting"}
                          </JoinMeetingLink>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Weekly Schedule */}
        {schedules.length > 0 && (
          <section aria-labelledby="schedule-heading">
            <h2
              id="schedule-heading"
              className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
            >
              Weekly Schedule
            </h2>
            <ul className="flex flex-col gap-3" role="list">
              {schedules.map((s) => {
                const safeLink = isSafeUrl(s.meeting_link) ? s.meeting_link! : null;
                return (
                  <li
                    key={s.id}
                    className="bg-card-bg border border-soft-border rounded-2xl shadow-card overflow-hidden"
                  >
                    <div className="flex items-start gap-3 px-5 py-4">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock size={14} className="text-primary" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-dark-text">
                          {DAY_NAMES[s.day_of_week]}
                        </p>
                        <p className="text-xs text-muted-text mt-0.5">
                          {formatTime(s.start_time)} – {formatTime(s.end_time)}{" "}
                          <span className="text-slate-400">({s.timezone})</span>
                        </p>
                        {s.meeting_provider && (
                          <p className="text-xs text-muted-text">{s.meeting_provider}</p>
                        )}
                      </div>
                    </div>
                    {(s.location || s.meeting_id || s.meeting_passcode || safeLink) && (
                      <div className="border-t border-soft-border px-5 py-3 flex flex-col gap-2">
                        {s.location && (
                          <p className="text-xs text-muted-text">
                            <span className="font-medium text-dark-text">Location:</span>{" "}
                            {s.location}
                          </p>
                        )}
                        {s.meeting_id && (
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-text">
                              <span className="font-medium text-dark-text">Meeting ID:</span>{" "}
                              {s.meeting_id}
                            </p>
                            <CopyButton text={s.meeting_id} label="meeting ID" />
                          </div>
                        )}
                        {s.meeting_passcode && (
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-text">
                              <span className="font-medium text-dark-text">Passcode:</span>{" "}
                              {s.meeting_passcode}
                            </p>
                            <CopyButton text={s.meeting_passcode} label="passcode" />
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
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <section aria-labelledby="announcements-list-heading">
            <h2
              id="announcements-list-heading"
              className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
            >
              Announcements
            </h2>
            <ul className="flex flex-col gap-3" role="list">
              {announcements.map((a) => (
                <li
                  key={a.id}
                  className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Megaphone size={14} className="text-warning" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-dark-text">{a.title}</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        {formatShortDate(a.created_at)}
                      </p>
                      <p className="text-sm text-amber-900 leading-relaxed mt-2 whitespace-pre-line">
                        {a.body}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Assignments */}
        {visibleAssignments.length > 0 && (
          <section aria-labelledby="assignments-list-heading">
            <h2
              id="assignments-list-heading"
              className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
            >
              Assignments
            </h2>
            <ul className="flex flex-col gap-3" role="list">
              {visibleAssignments.map((a) => {
                const overdue =
                  a.due_at && new Date(a.due_at) < new Date();
                return (
                  <li
                    key={a.id}
                    className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                          <BookOpen size={14} className="text-primary" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-dark-text">
                            {a.title}
                          </p>
                          {a.instructions && (
                            <p className="text-xs text-muted-text mt-0.5 line-clamp-2">
                              {a.instructions}
                            </p>
                          )}
                        </div>
                      </div>
                      {isOwner ? (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                            a.status === "published"
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {a.status === "published" ? "Published" : "Draft"}
                        </span>
                      ) : overdue ? (
                        <span className="text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-200 px-2.5 py-0.5 rounded-full shrink-0">
                          Overdue
                        </span>
                      ) : (
                        <span className="text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-200 px-2.5 py-0.5 rounded-full shrink-0">
                          Upcoming
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-soft-border text-xs text-muted-text">
                      <span>
                        Due:{" "}
                        <span className="font-medium text-dark-text">
                          {a.due_at ? formatDueDate(a.due_at) : "No due date"}
                        </span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{a.points} pts</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Teacher: edit class */}
        {isOwner && (
          <section
            aria-labelledby="edit-class-heading"
            className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6"
          >
            <h2
              id="edit-class-heading"
              className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-4"
            >
              Edit Details
            </h2>
            <EditClassForm
              classId={typedCls.id}
              currentName={typedCls.name}
              currentSubject={typedCls.subject}
              currentDescription={typedCls.description}
              currentStartDate={typedCls.start_date}
            />
          </section>
        )}

        {/* Teacher: student roster */}
        {isOwner && (
          <section aria-labelledby="roster-heading">
            <h2
              id="roster-heading"
              className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
            >
              Students
            </h2>

            {students.length === 0 ? (
              <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6 text-sm text-muted-text text-center">
                No students have joined yet. Share the join code above.
              </div>
            ) : (
              <ul
                className="bg-card-bg border border-soft-border rounded-2xl shadow-card divide-y divide-soft-border"
                role="list"
              >
                {students.map((s) => (
                  <li
                    key={s.student_id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 first:rounded-t-2xl last:rounded-b-2xl"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-dark-text truncate">
                        {s.full_name ?? "Unknown Student"}
                      </p>
                      <p className="text-xs text-muted-text truncate">
                        {s.email}
                      </p>
                      <p className="text-xs text-muted-text">
                        Joined {formatDate(s.joined_at)}
                      </p>
                    </div>
                    <RemoveStudentButton
                      classId={typedCls.id}
                      studentId={s.student_id}
                      studentName={s.full_name ?? "this student"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Teacher: danger zone */}
        {isOwner && (
          <section
            aria-labelledby="danger-heading"
            className="bg-card-bg border border-red-200 rounded-2xl shadow-card p-6"
          >
            <h2
              id="danger-heading"
              className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-4"
            >
              Danger Zone
            </h2>
            <p className="text-sm text-muted-text mb-4">
              Deleting this class is permanent and will remove all enrolled
              students.
            </p>
            <DeleteClassButton classId={typedCls.id} />
          </section>
        )}

        {/* Student: leave class */}
        {isStudent && profile && (
          <section aria-label="Class actions">
            <LeaveClassButton classId={typedCls.id} studentId={profile.id} />
          </section>
        )}
      </div>
    </div>
  );
}
