import type { Metadata } from "next";
import TopBar from "@/components/nav/TopBar";
import LessonCard from "@/components/cards/LessonCard";
import SectionHeading from "@/components/ui/SectionHeading";

export const metadata: Metadata = { title: "Schedule" };

const upcomingLessons = [
  {
    id: 1,
    course: "SAT Math",
    topic: "Advanced Algebra",
    date: "Tuesday, Sep 8",
    time: "5:00 PM",
    status: "upcoming" as const,
  },
  {
    id: 2,
    course: "SAT Reading & Writing",
    topic: "Grammar and Transitions",
    date: "Thursday, Sep 10",
    time: "5:00 PM",
    status: "upcoming" as const,
  },
  {
    id: 3,
    course: "AP Calculus BC",
    topic: "Integration by Parts",
    date: "Sunday, Sep 13",
    time: "3:00 PM",
    status: "upcoming" as const,
  },
];

const previousLessons = [
  {
    id: 4,
    course: "SAT Math",
    topic: "Linear Equations",
    date: "Tuesday, Sep 1",
    time: "5:00 PM",
    status: "completed" as const,
  },
  {
    id: 5,
    course: "SAT Reading & Writing",
    topic: "Command of Evidence",
    date: "Thursday, Sep 3",
    time: "5:00 PM",
    status: "completed" as const,
  },
];

export default function SchedulePage() {
  return (
    <div>
      <TopBar title="Schedule" />

      <div className="mb-8">
        <p className="text-muted-text text-sm">
          Your upcoming and past tutoring sessions.
        </p>
      </div>

      <section aria-labelledby="upcoming-heading" className="mb-10">
        <SectionHeading
          id="upcoming-heading"
          title="Upcoming Lessons"
          description="Sessions scheduled for this week and beyond."
        />
        <ul className="grid gap-4 sm:grid-cols-2" role="list">
          {upcomingLessons.map((lesson) => (
            <li key={lesson.id}>
              <LessonCard
                course={lesson.course}
                topic={lesson.topic}
                date={lesson.date}
                time={lesson.time}
                status={lesson.status}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="previous-heading">
        <SectionHeading
          id="previous-heading"
          title="Previous Lessons"
          description="Sessions you have already completed."
        />
        <ul className="grid gap-4 sm:grid-cols-2" role="list">
          {previousLessons.map((lesson) => (
            <li key={lesson.id}>
              <LessonCard
                course={lesson.course}
                topic={lesson.topic}
                date={lesson.date}
                time={lesson.time}
                status={lesson.status}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
