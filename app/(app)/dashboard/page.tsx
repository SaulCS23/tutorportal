import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import TopBar from "@/components/nav/TopBar";
import StatusBadge from "@/components/ui/StatusBadge";
import SectionHeading from "@/components/ui/SectionHeading";
import {
  CalendarDays,
  Clock,
  User,
  BookOpen,
  Megaphone,
} from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

const homeworkItems = [
  {
    id: 1,
    title: "SAT Math Practice Set 4",
    dueDate: "September 7",
    status: "in-progress" as const,
  },
  {
    id: 2,
    title: "SAT Grammar Review",
    dueDate: "September 9",
    status: "not-started" as const,
  },
  {
    id: 3,
    title: "AP Calculus Integration Practice",
    dueDate: "September 12",
    status: "not-started" as const,
  },
];

const weeklySchedule = [
  { day: "Tuesday", course: "SAT Math" },
  { day: "Thursday", course: "SAT Reading & Writing" },
  { day: "Sunday", course: "AP Calculus BC" },
];

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const firstName = profile?.full_name?.split(" ")[0] ?? "Student";
  const accountType = profile?.role === "teacher" ? "Teacher" : "Student";

  return (
    <div>
      <TopBar title="Dashboard" />

      {/* Welcome */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-dark-text">
          Welcome back, {firstName} 👋
        </h2>
        <p className="mt-1 text-muted-text">
          Here is what is coming up this week.
        </p>
        <span className="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-primary border border-blue-100">
          {accountType}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Next Lesson */}
        <section aria-labelledby="next-lesson-heading">
          <SectionHeading title="Next Lesson" id="next-lesson-heading" />
          <div className="bg-primary rounded-2xl p-6 text-white shadow-card">
            <div className="flex items-center gap-2 text-blue-100 text-xs font-medium mb-4">
              <CalendarDays size={14} aria-hidden="true" />
              <span>Upcoming</span>
            </div>
            <h3 className="text-xl font-bold mb-1">SAT Math</h3>
            <p className="text-blue-100 text-sm mb-5">Advanced Algebra</p>
            <dl className="grid grid-cols-2 gap-y-3 text-sm mb-6">
              <div className="flex items-center gap-2">
                <CalendarDays size={14} aria-hidden="true" className="text-blue-200" />
                <div>
                  <dt className="sr-only">Date</dt>
                  <dd>Tuesday, September 8</dd>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} aria-hidden="true" className="text-blue-200" />
                <div>
                  <dt className="sr-only">Time</dt>
                  <dd>5:00 PM</dd>
                </div>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <User size={14} aria-hidden="true" className="text-blue-200" />
                <div>
                  <dt className="sr-only">Teacher</dt>
                  <dd>Saul Assis</dd>
                </div>
              </div>
            </dl>
            <button
              type="button"
              disabled
              aria-label="Join lesson — not yet available"
              className="w-full bg-white/20 text-white text-sm font-medium rounded-xl py-2.5 cursor-not-allowed opacity-60 border border-white/30"
            >
              Join Lesson
            </button>
          </div>
        </section>

        {/* Homework Due Soon */}
        <section aria-labelledby="homework-heading">
          <SectionHeading title="Homework Due Soon" id="homework-heading" />
          <ul className="flex flex-col gap-3" role="list">
            {homeworkItems.map((item) => (
              <li
                key={item.id}
                className="bg-card-bg border border-soft-border rounded-xl p-4 flex items-center justify-between gap-3 shadow-card"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <BookOpen size={15} className="text-primary" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-dark-text truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-text">Due {item.dueDate}</p>
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        </section>

        {/* Weekly Schedule */}
        <section aria-labelledby="schedule-heading">
          <SectionHeading title="Weekly Schedule" id="schedule-heading" />
          <ul className="flex flex-col gap-2" role="list">
            {weeklySchedule.map(({ day, course }) => (
              <li
                key={day}
                className="bg-card-bg border border-soft-border rounded-xl px-4 py-3 flex items-center justify-between shadow-card"
              >
                <span className="text-sm font-medium text-dark-text">{day}</span>
                <span className="text-sm text-muted-text">{course}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Announcement */}
        <section aria-labelledby="announcement-heading">
          <SectionHeading title="Announcement" id="announcement-heading" />
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-card">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <Megaphone size={15} className="text-warning" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-text mb-1">
                  From Saul Assis
                </p>
                <p className="text-sm text-amber-900 leading-relaxed">
                  Remember to complete Practice Test 3 before Thursday&apos;s
                  session.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
