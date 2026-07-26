import StatusBadge from "@/components/ui/StatusBadge";

type LessonStatus = "upcoming" | "completed";

interface LessonCardProps {
  course: string;
  topic: string;
  date: string;
  time: string;
  status: LessonStatus;
}

export default function LessonCard({
  course,
  topic,
  date,
  time,
  status,
}: LessonCardProps) {
  const isUpcoming = status === "upcoming";

  return (
    <article className="bg-card-bg border border-soft-border rounded-xl shadow-card p-5 flex flex-col gap-3 hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-dark-text text-sm leading-snug">
            {course}
          </h3>
          <p className="text-xs text-muted-text mt-0.5">{topic}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-text">
        <span>
          <span className="font-medium text-dark-text">{date}</span>
        </span>
        <span aria-hidden="true">·</span>
        <span>{time}</span>
      </div>

      <div className="pt-1 border-t border-soft-border">
        {isUpcoming ? (
          <button
            type="button"
            disabled
            aria-label={`Join lesson: ${course} — ${topic} (not yet available)`}
            className="w-full text-sm font-medium text-white bg-primary rounded-lg py-2 px-4 opacity-50 cursor-not-allowed"
          >
            Join Lesson
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Review lesson: ${course} — ${topic}`}
            className="w-full text-sm font-medium text-primary border border-primary rounded-lg py-2 px-4 hover:bg-blue-50 transition-colors"
          >
            Review Session
          </button>
        )}
      </div>
    </article>
  );
}
