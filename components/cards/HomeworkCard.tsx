import StatusBadge from "@/components/ui/StatusBadge";

type HomeworkStatus = "not-started" | "in-progress" | "submitted";

interface HomeworkCardProps {
  title: string;
  course: string;
  dueDate: string;
  status: HomeworkStatus;
  preview: string;
}

export default function HomeworkCard({
  title,
  course,
  dueDate,
  status,
  preview,
}: HomeworkCardProps) {
  return (
    <article className="bg-card-bg border border-soft-border rounded-xl shadow-card p-5 flex flex-col gap-3 hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-dark-text text-sm leading-snug truncate">
            {title}
          </h3>
          <p className="text-xs text-muted-text mt-0.5">{course}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="text-sm text-muted-text leading-relaxed line-clamp-2">
        {preview}
      </p>

      <div className="flex items-center justify-between pt-1 border-t border-soft-border">
        <span className="text-xs text-muted-text">
          Due <span className="font-medium text-dark-text">{dueDate}</span>
        </span>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:text-primary-dark focus-visible:outline-primary px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          aria-label={`Open assignment: ${title}`}
        >
          Open Assignment
        </button>
      </div>
    </article>
  );
}
