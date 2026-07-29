"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, BookOpen } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { isClassNameRedundant } from "@/lib/utils";

export type AssignmentItem = {
  id: string;
  title: string;
  class_name: string;
  instructions: string | null;
  due_at: string | null;
  points: number;
  status: "draft" | "published";
  class_id: string;
};

type FilterStatus = "all" | "upcoming" | "overdue" | "draft" | "published";

interface HomeworkListProps {
  assignments: AssignmentItem[];
  isTeacher: boolean;
}

function formatDueDate(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDisplayStatus(
  item: AssignmentItem,
  isTeacher: boolean
): "upcoming" | "overdue" | "draft" | "published" {
  if (isTeacher) return item.status;
  if (!item.due_at) return "upcoming";
  return new Date(item.due_at) < new Date() ? "overdue" : "upcoming";
}

export default function HomeworkList({ assignments, isTeacher }: HomeworkListProps) {
  const [search, setSearch] = useState("");

  const filters: { value: FilterStatus; label: string }[] = isTeacher
    ? [
        { value: "all", label: "All" },
        { value: "published", label: "Published" },
        { value: "draft", label: "Draft" },
      ]
    : [
        { value: "all", label: "All" },
        { value: "upcoming", label: "Upcoming" },
        { value: "overdue", label: "Overdue" },
      ];

  const [filter, setFilter] = useState<FilterStatus>("all");

  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.class_name.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (filter === "all") return true;

      const displayStatus = getDisplayStatus(a, isTeacher);
      return displayStatus === filter;
    });
  }, [assignments, search, filter, isTeacher]);

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <BookOpen size={22} className="text-muted-text" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-text">No assignments yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search assignments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search assignments"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-card-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
          />
        </div>

        <div role="group" aria-label="Filter by status" className="flex gap-1.5 flex-wrap">
          {filters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                filter === value
                  ? "bg-primary text-white shadow-sm"
                  : "bg-card-bg border border-soft-border text-muted-text hover:text-dark-text hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-text text-sm py-16">
          No assignments match your search.
        </p>
      ) : (
        <ul
          className="flex flex-col gap-4"
          role="list"
          aria-label="Assignments"
        >
          {filtered.map((a) => {
            const displayStatus = getDisplayStatus(a, isTeacher);
            const classHref = isTeacher
              ? `/teacher/classes/${a.class_id}/assignments`
              : `/classes/${a.class_id}`;

            const actionHref = isTeacher
              ? classHref
              : `/homework/${a.id}`;
            const actionLabel = isTeacher ? "Manage" : "Open Assignment";

            return (
              <li key={a.id}>
                <article className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={actionHref}
                        className="font-semibold text-dark-text text-sm leading-snug hover:text-primary transition-colors"
                      >
                        {a.title}
                      </Link>
                      {!isClassNameRedundant(a.title, a.class_name) && (
                        <Link
                          href={classHref}
                          className="text-xs text-primary hover:underline mt-0.5 inline-block"
                        >
                          {a.class_name}
                        </Link>
                      )}
                    </div>
                    <StatusBadge status={displayStatus} />
                  </div>

                  {a.instructions && (
                    <p className="text-sm text-muted-text leading-relaxed line-clamp-2">
                      {a.instructions}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-soft-border">
                    <div className="text-xs text-muted-text">
                      Due{" "}
                      <span className="font-medium text-dark-text">
                        {formatDueDate(a.due_at)}
                      </span>
                      {a.points > 0 && (
                        <span className="ml-2 text-muted-text">
                          · {a.points} pts
                        </span>
                      )}
                    </div>
                    <Link
                      href={actionHref}
                      className="text-xs font-medium text-primary hover:text-primary-dark px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                      aria-label={`${actionLabel}: ${a.title}`}
                    >
                      {actionLabel}
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
