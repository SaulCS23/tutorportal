"use client";

import { useState, useMemo } from "react";
import HomeworkCard from "@/components/cards/HomeworkCard";
import { Search } from "lucide-react";

type Status = "all" | "not-started" | "in-progress" | "submitted";

const assignments = [
  {
    id: 1,
    title: "SAT Math Practice Set 4",
    course: "SAT Math",
    dueDate: "September 7",
    status: "in-progress" as const,
    preview:
      "Complete problems 1–30 from the College Board practice set. Show all working for grid-in questions.",
  },
  {
    id: 2,
    title: "SAT Grammar Review",
    course: "SAT Reading & Writing",
    dueDate: "September 9",
    status: "not-started" as const,
    preview:
      "Review transitions, punctuation, and sentence boundary rules. Focus on the passages provided in the shared folder.",
  },
  {
    id: 3,
    title: "AP Calculus Integration Practice",
    course: "AP Calculus BC",
    dueDate: "September 12",
    status: "not-started" as const,
    preview:
      "Solve the 15 integration problems. Include u-substitution and integration by parts methods where applicable.",
  },
  {
    id: 4,
    title: "SAT Reading: Evidence Questions",
    course: "SAT Reading & Writing",
    dueDate: "September 14",
    status: "not-started" as const,
    preview:
      "Read passages A and B and answer all command-of-evidence questions. Time yourself to stay within 13 minutes.",
  },
  {
    id: 5,
    title: "Algebra Word Problems Set",
    course: "SAT Math",
    dueDate: "September 3",
    status: "submitted" as const,
    preview:
      "Completed 20 word problems covering rate, ratio, and proportion. Submitted via the shared folder.",
  },
  {
    id: 6,
    title: "AP Calculus Limits Review",
    course: "AP Calculus BC",
    dueDate: "August 28",
    status: "submitted" as const,
    preview:
      "Reviewed limit definitions and solved 10 practice problems. All steps shown in the PDF submission.",
  },
];

const statusFilters: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "not-started", label: "Not Started" },
  { value: "in-progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
];

export default function HomeworkList() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status>("all");

  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      const matchesStatus = filter === "all" || a.status === filter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.course.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [search, filter]);

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

        <div
          role="group"
          aria-label="Filter by status"
          className="flex gap-1.5 flex-wrap"
        >
          {statusFilters.map(({ value, label }) => (
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
          className="grid gap-4 sm:grid-cols-2"
          role="list"
          aria-label="Assignments"
        >
          {filtered.map((a) => (
            <li key={a.id}>
              <HomeworkCard
                title={a.title}
                course={a.course}
                dueDate={a.dueDate}
                status={a.status}
                preview={a.preview}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
