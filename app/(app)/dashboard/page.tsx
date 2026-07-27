import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  BookOpen,
  Megaphone,
  GraduationCap,
  Users,
  Link as LinkIcon,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import { getInitials, DAY_NAMES, formatTime, isSafeUrl, findNextSchedule } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";
import SectionHeading from "@/components/ui/SectionHeading";

export const metadata: Metadata = { title: "Dashboard" };

// ── Types ─────────────────────────────────────────────────────

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
  classes: { name: string; subject: string | null } | null;
};

type AssignmentRow = {
  id: string;
  title: string;
  due_at: string | null;
  points: number;
  status: "draft" | "published";
  class_id: string;
  classes: { name: string } | null;
};

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  classes: { name: string } | null;
};

// ── Helpers ───────────────────────────────────────────────────

function formatDueDate(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isOverdue(due_at: string | null) {
  if (!due_at) return false;
  return new Date(due_at) < new Date();
}

// ── Page ──────────────────────────────────────────────────────

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const firstName = profile?.first_name ?? profile?.full_name?.split(" ")[0] ?? "there";
  const isTeacher = profile?.role === "teacher";
  const initials = getInitials(profile?.first_name, profile?.last_name);

  const supabase = await createClient();

  // ── Teacher data ──────────────────────────────────────────
  if (isTeacher) {
    const [
      { count: classCount },
      { count: studentCount },
      { data: rawSchedules },
      { data: rawAssignments },
      { data: rawAnnouncements },
    ] = await Promise.all([
      supabase
        .from("classes")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", profile!.id),
      supabase
        .from("class_members")
        .select(
          "class_id, classes!inner( teacher_id )",
          { count: "exact", head: true }
        )
        .eq("classes.teacher_id", profile!.id),
      supabase
        .from("class_schedules")
        .select(
          "id, class_id, day_of_week, start_time, end_time, timezone, meeting_provider, meeting_link, meeting_id, meeting_passcode, location, classes ( name, subject )"
        )
        .order("day_of_week")
        .order("start_time"),
      supabase
        .from("assignments")
        .select("id, title, due_at, points, status, class_id, classes ( name )")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(5),
      supabase
        .from("announcements")
        .select("id, title, body, created_at, classes ( name )")
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    const schedules = (rawSchedules as unknown as ScheduleRow[]) ?? [];
    const assignments = (rawAssignments as unknown as AssignmentRow[]) ?? [];
    const announcements = (rawAnnouncements as unknown as AnnouncementRow[]) ?? [];
    const nextMeeting = findNextSchedule(schedules);

    return (
      <TeacherDashboard
        firstName={firstName}
        initials={initials}
        classCount={classCount ?? 0}
        studentCount={studentCount ?? 0}
        scheduleCount={schedules.length}
        nextMeeting={nextMeeting}
        assignments={assignments}
        announcements={announcements}
        isTeacher
      />
    );
  }

  // ── Student data ──────────────────────────────────────────
  const [
    { count: classCount },
    { data: rawSchedules },
    { data: rawAssignments },
    { data: rawAnnouncements },
  ] = await Promise.all([
    supabase
      .from("class_members")
      .select("*", { count: "exact", head: true })
      .eq("student_id", profile!.id),
    supabase
      .from("class_schedules")
      .select(
        "id, class_id, day_of_week, start_time, end_time, timezone, meeting_provider, meeting_link, meeting_id, meeting_passcode, location, classes ( name, subject, teacher_id )"
      )
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("assignments")
      .select("id, title, due_at, points, status, class_id, classes ( name )")
      .eq("status", "published")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("announcements")
      .select("id, title, body, created_at, classes ( name )")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const schedules = (rawSchedules as unknown as ScheduleRow[]) ?? [];
  const assignments = (rawAssignments as unknown as AssignmentRow[]) ?? [];
  const announcements = (rawAnnouncements as unknown as AnnouncementRow[]) ?? [];
  const nextMeeting = findNextSchedule(schedules);
  const upcomingCount = assignments.filter((a) => !isOverdue(a.due_at)).length;

  return (
    <StudentDashboard
      firstName={firstName}
      initials={initials}
      classCount={classCount ?? 0}
      upcomingAssignmentCount={upcomingCount}
      scheduleCount={schedules.length}
      nextMeeting={nextMeeting}
      assignments={assignments}
      announcements={announcements}
    />
  );
}

// ── Teacher view ──────────────────────────────────────────────

function TeacherDashboard({
  firstName,
  initials,
  classCount,
  studentCount,
  scheduleCount,
  nextMeeting,
  assignments,
  announcements,
  isTeacher,
}: {
  firstName: string;
  initials: string;
  classCount: number;
  studentCount: number;
  scheduleCount: number;
  nextMeeting: ScheduleRow | null;
  assignments: AssignmentRow[];
  announcements: AnnouncementRow[];
  isTeacher: boolean;
}) {
  void isTeacher;
  return (
    <div>
      <TopBar title="Dashboard" initials={initials} />
      <WelcomeSection firstName={firstName} roleLabel="Teacher" />

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard icon={<GraduationCap size={16} />} label="Classes" value={classCount} href="/classes" />
        <StatCard icon={<Users size={16} />} label="Students" value={studentCount} />
        <StatCard icon={<CalendarDays size={16} />} label="Meetings" value={scheduleCount} href="/schedule" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <NextMeetingCard meeting={nextMeeting} />

        <section aria-labelledby="assignments-heading">
          <SectionHeading title="Assignments" id="assignments-heading" />
          {assignments.length === 0 ? (
            <EmptyCard message="No assignments yet." href="/classes" linkText="Open a class" />
          ) : (
            <ul className="flex flex-col gap-3" role="list">
              {assignments.slice(0, 4).map((a) => (
                <AssignmentListItem key={a.id} assignment={a} isTeacher />
              ))}
            </ul>
          )}
        </section>

        <RecentAnnouncementsCard announcements={announcements} />
      </div>
    </div>
  );
}

// ── Student view ──────────────────────────────────────────────

function StudentDashboard({
  firstName,
  initials,
  classCount,
  upcomingAssignmentCount,
  scheduleCount,
  nextMeeting,
  assignments,
  announcements,
}: {
  firstName: string;
  initials: string;
  classCount: number;
  upcomingAssignmentCount: number;
  scheduleCount: number;
  nextMeeting: ScheduleRow | null;
  assignments: AssignmentRow[];
  announcements: AnnouncementRow[];
}) {
  return (
    <div>
      <TopBar title="Dashboard" initials={initials} />
      <WelcomeSection firstName={firstName} roleLabel="Student" />

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard icon={<GraduationCap size={16} />} label="Classes" value={classCount} href="/classes" />
        <StatCard icon={<BookOpen size={16} />} label="Upcoming" value={upcomingAssignmentCount} href="/homework" />
        <StatCard icon={<CalendarDays size={16} />} label="Meetings" value={scheduleCount} href="/schedule" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <NextMeetingCard meeting={nextMeeting} />

        <section aria-labelledby="hw-heading">
          <SectionHeading title="Homework Due Soon" id="hw-heading" />
          {assignments.length === 0 ? (
            <EmptyCard message="No assignments yet." />
          ) : (
            <ul className="flex flex-col gap-3" role="list">
              {assignments.slice(0, 4).map((a) => (
                <AssignmentListItem key={a.id} assignment={a} isTeacher={false} />
              ))}
            </ul>
          )}
        </section>

        <RecentAnnouncementsCard announcements={announcements} />
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────

function WelcomeSection({ firstName, roleLabel }: { firstName: string; roleLabel: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-dark-text">
        Welcome back, {firstName}
      </h2>
      <p className="mt-1 text-muted-text">Here is what is coming up.</p>
      <span className="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-primary border border-blue-100">
        {roleLabel}
      </span>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-4 flex flex-col items-center gap-1 text-center">
      <div className="text-muted-text">{icon}</div>
      <p className="text-2xl font-bold text-dark-text">{value}</p>
      <p className="text-xs text-muted-text">{label}</p>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="hover:scale-[1.02] transition-transform">
        {inner}
      </Link>
    );
  }
  return inner;
}

function NextMeetingCard({ meeting }: { meeting: ScheduleRow | null }) {
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

  return (
    <section aria-labelledby="next-lesson-heading">
      <SectionHeading title="Next Meeting" id="next-lesson-heading" />
      <div className="bg-primary rounded-2xl p-6 text-white shadow-card">
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
            <dd>{DAY_NAMES[meeting.day_of_week]}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-blue-200" aria-hidden="true" />
            <dt className="sr-only">Time</dt>
            <dd>
              {formatTime(meeting.start_time)} – {formatTime(meeting.end_time)}
            </dd>
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

        {safeLink ? (
          <a
            href={safeLink}
            target="_blank"
            rel="noopener noreferrer"
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

function AssignmentListItem({
  assignment,
  isTeacher,
}: {
  assignment: AssignmentRow;
  isTeacher: boolean;
}) {
  const overdue =
    !isTeacher && assignment.due_at
      ? new Date(assignment.due_at) < new Date()
      : false;

  const href = isTeacher
    ? `/teacher/classes/${assignment.class_id}/assignments`
    : `/homework/${assignment.id}`;

  return (
    <li className="bg-card-bg border border-soft-border rounded-xl p-4 flex items-center gap-3 shadow-card">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
        <BookOpen size={15} className="text-primary" aria-hidden="true" />
      </div>
      <Link href={href} className="min-w-0 flex-1 hover:opacity-80 transition-opacity">
        <p className="text-sm font-medium text-dark-text truncate">
          {assignment.title}
        </p>
        <p className="text-xs text-muted-text truncate">
          {assignment.classes?.name ?? "Unknown Class"} ·{" "}
          {formatDueDate(assignment.due_at)}
        </p>
      </Link>
      {isTeacher ? (
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
            assignment.status === "published"
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {assignment.status === "published" ? "Published" : "Draft"}
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
    </li>
  );
}

function RecentAnnouncementsCard({
  announcements,
}: {
  announcements: AnnouncementRow[];
}) {
  return (
    <section aria-labelledby="announcements-heading">
      <SectionHeading title="Recent Announcements" id="announcements-heading" />
      {announcements.length === 0 ? (
        <EmptyCard message="No announcements yet." />
      ) : (
        <ul className="flex flex-col gap-3" role="list">
          {announcements.map((a) => (
            <li
              key={a.id}
              className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-card"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Megaphone size={14} className="text-warning" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  {a.classes?.name && (
                    <p className="text-xs font-medium text-amber-600 mb-0.5">
                      {a.classes.name}
                    </p>
                  )}
                  <p className="text-sm font-medium text-dark-text">{a.title}</p>
                  <p className="text-sm text-amber-900 leading-relaxed mt-0.5 line-clamp-2">
                    {a.body}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyCard({
  message,
  href,
  linkText,
}: {
  message: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <div className="bg-card-bg border border-soft-border rounded-xl p-6 text-sm text-muted-text text-center shadow-card">
      {message}
      {href && linkText && (
        <Link href={href} className="ml-1 text-primary hover:underline">
          {linkText}
        </Link>
      )}
    </div>
  );
}
