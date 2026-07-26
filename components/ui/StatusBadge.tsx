type Status =
  | "not-started"
  | "in-progress"
  | "submitted"
  | "upcoming"
  | "completed";

const config: Record<Status, { label: string; className: string }> = {
  "not-started": {
    label: "Not Started",
    className: "bg-slate-100 text-slate-600",
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
  submitted: {
    label: "Submitted",
    className: "bg-green-50 text-green-700 ring-1 ring-green-200",
  },
  upcoming: {
    label: "Upcoming",
    className: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  },
  completed: {
    label: "Completed",
    className: "bg-green-50 text-green-700 ring-1 ring-green-200",
  },
};

export default function StatusBadge({ status }: { status: Status }) {
  const { label, className } = config[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}
