"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", path: "" },
  { label: "Assignments", path: "/assignments" },
  { label: "Announcements", path: "/announcements" },
  { label: "Students", path: "/students" },
] as const;

export default function ClassTabNav({ classId }: { classId: string }) {
  const pathname = usePathname();
  const base = `/teacher/classes/${classId}`;

  return (
    <nav
      aria-label="Class sections"
      className="flex gap-1 border-b border-soft-border mb-6 overflow-x-auto"
    >
      {TABS.map(({ label, path }) => {
        const href = base + path;
        const isActive =
          path === "" ? pathname === base : pathname.startsWith(href);

        return (
          <Link
            key={path}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-text hover:text-dark-text hover:border-slate-300"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
