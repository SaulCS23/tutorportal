type Status =
  | "not-started"
  | "in-progress"
  | "submitted"
  | "upcoming"
  | "completed"
  | "overdue"
  | "draft"
  | "published"
  | "graded"
  | "returned"
  | "late"
  | "missing"
  | "scheduled"
  | "cancelled"
  | "group_pending_reschedule";

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
    className: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  },
  upcoming: {
    label: "Upcoming",
    className: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  },
  completed: {
    label: "Completed",
    className: "bg-green-50 text-green-700 ring-1 ring-green-200",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-50 text-red-700 ring-1 ring-red-200",
  },
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-500",
  },
  published: {
    label: "Published",
    className: "bg-green-50 text-green-700 ring-1 ring-green-200",
  },
  graded: {
    label: "Graded",
    className: "bg-green-50 text-green-700 ring-1 ring-green-200",
  },
  returned: {
    label: "Returned",
    className: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
  },
  late: {
    label: "Late",
    className: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  },
  missing: {
    label: "Missing",
    className: "bg-red-50 text-red-600 ring-1 ring-red-200",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-slate-100 text-slate-500",
  },
  group_pending_reschedule: {
    label: "Pending Reschedule",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
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
