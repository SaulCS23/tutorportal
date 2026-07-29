import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Megaphone, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDueDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Class Overview" };

type Props = { params: Promise<{ classId: string }> };

export default async function TeacherClassOverviewPage({ params }: Props) {
  const { classId } = await params;
  const supabase = await createClient();

  const [{ data: announcements }, { data: assignments }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, created_at")
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("assignments")
      .select("id, title, due_at, status, points")
      .eq("class_id", classId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(3),
  ]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="flex flex-col gap-8">
      {/* Upcoming assignments */}
      <section aria-labelledby="upcoming-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="upcoming-heading"
            className="text-sm font-semibold text-muted-text uppercase tracking-wide"
          >
            Upcoming Assignments
          </h2>
          <Link
            href={`/teacher/classes/${classId}/assignments`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View all
            <ChevronRight size={12} aria-hidden="true" />
          </Link>
        </div>

        {!assignments || assignments.length === 0 ? (
          <EmptyCard message="No assignments yet." />
        ) : (
          <ul className="flex flex-col gap-2" role="list">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 bg-card-bg border border-soft-border rounded-xl px-4 py-3 shadow-card"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <BookOpen size={14} className="text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-dark-text truncate">{a.title}</p>
                  <p className="text-xs text-muted-text">
                    {a.due_at ? `Due ${formatDueDate(a.due_at)}` : "No due date"} · {a.points} pts
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    a.status === "published"
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {a.status === "published" ? "Published" : "Draft"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent announcements */}
      <section aria-labelledby="announcements-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="announcements-heading"
            className="text-sm font-semibold text-muted-text uppercase tracking-wide"
          >
            Recent Announcements
          </h2>
          <Link
            href={`/teacher/classes/${classId}/announcements`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View all
            <ChevronRight size={12} aria-hidden="true" />
          </Link>
        </div>

        {!announcements || announcements.length === 0 ? (
          <EmptyCard message="No announcements yet." />
        ) : (
          <ul className="flex flex-col gap-2" role="list">
            {announcements.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 bg-card-bg border border-soft-border rounded-xl px-4 py-3 shadow-card"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <Megaphone size={14} className="text-warning" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-dark-text truncate">{a.title}</p>
                  <p className="text-xs text-muted-text">{formatDate(a.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="bg-card-bg border border-soft-border rounded-xl px-4 py-8 text-sm text-muted-text text-center shadow-card">
      {message}
    </div>
  );
}
