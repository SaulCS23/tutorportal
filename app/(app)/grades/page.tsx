import type { Metadata } from "next";
import Link from "next/link";
import { Award, BookOpen } from "lucide-react";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import { getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";

export const metadata: Metadata = { title: "Grades" };

type RawGrade = {
  id: string;
  status: "graded" | "returned";
  score: number | null;
  max_score: number | null;
  teacher_feedback: string | null;
  graded_at: string | null;
  submitted_at: string;
  assignments: {
    id: string;
    title: string;
    class_id: string;
    classes: { name: string } | null;
  } | null;
};

type GradeItem = {
  id: string;
  assignment_id: string;
  assignment_title: string;
  class_id: string;
  class_name: string;
  score: number | null;
  max_score: number | null;
  teacher_feedback: string | null;
  graded_at: string | null;
  status: "graded" | "returned";
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function percentage(score: number, maxScore: number): number {
  return Math.round((score / maxScore) * 100);
}

function gradeColor(pct: number): string {
  if (pct >= 90) return "text-green-600";
  if (pct >= 70) return "text-blue-600";
  if (pct >= 50) return "text-amber-600";
  return "text-red-600";
}

export default async function GradesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isTeacher = profile?.role === "teacher";

  if (isTeacher) {
    return (
      <div>
        <TopBar
          title="Grades"
          initials={getInitials(profile?.first_name, profile?.last_name)}
        />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Award size={22} className="text-muted-text" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-dark-text mb-1">
            Grade submissions from each assignment
          </p>
          <p className="text-sm text-muted-text max-w-xs mb-4">
            Open any class, go to the Assignments tab, and click{" "}
            <strong>View Submissions</strong> to grade student work.
          </p>
          <Link
            href="/classes"
            className="text-sm font-medium text-primary hover:underline"
          >
            Go to My Classes →
          </Link>
        </div>
      </div>
    );
  }

  const { data } = await supabase
    .from("assignment_submissions")
    .select(
      "id, status, score, max_score, teacher_feedback, graded_at, submitted_at, assignments ( id, title, class_id, classes ( name ) )"
    )
    .in("status", ["graded", "returned"])
    .order("graded_at", { ascending: false });

  const grades: GradeItem[] = ((data as unknown as RawGrade[]) ?? []).map(
    (r) => ({
      id: r.id,
      assignment_id: r.assignments?.id ?? "",
      assignment_title: r.assignments?.title ?? "Unknown assignment",
      class_id: r.assignments?.class_id ?? "",
      class_name: r.assignments?.classes?.name ?? "Unknown class",
      score: r.score,
      max_score: r.max_score,
      teacher_feedback: r.teacher_feedback,
      graded_at: r.graded_at,
      status: r.status,
    })
  );

  return (
    <div>
      <TopBar
        title="Grades"
        initials={getInitials(profile?.first_name, profile?.last_name)}
      />

      <div className="mb-6">
        <p className="text-sm text-muted-text">
          Your graded assignments.
        </p>
      </div>

      {grades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Award size={22} className="text-muted-text" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted-text max-w-xs">
            No graded assignments yet. Grades will appear here once your teacher
            reviews your submissions.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4" role="list">
          {grades.map((g) => {
            const pct =
              g.score !== null && g.max_score !== null && g.max_score > 0
                ? percentage(g.score, g.max_score)
                : null;

            return (
              <li key={g.id}>
                <article className="bg-card-bg border border-soft-border rounded-2xl shadow-card overflow-hidden">
                  {/* Header */}
                  <div className="px-5 py-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                      <BookOpen size={14} className="text-primary" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-dark-text truncate">
                        {g.assignment_title}
                      </p>
                      <Link
                        href={`/classes/${g.class_id}`}
                        className="text-xs text-primary hover:underline mt-0.5 inline-block"
                      >
                        {g.class_name}
                      </Link>
                    </div>
                    {/* Score pill */}
                    {g.score !== null ? (
                      <div className="text-right shrink-0">
                        <p
                          className={`text-xl font-bold leading-none ${pct !== null ? gradeColor(pct) : "text-dark-text"}`}
                        >
                          {g.score}
                          {g.max_score !== null && (
                            <span className="text-sm font-normal text-muted-text">
                              /{g.max_score}
                            </span>
                          )}
                        </p>
                        {pct !== null && (
                          <p className={`text-xs font-medium mt-0.5 ${gradeColor(pct)}`}>
                            {pct}%
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-text shrink-0 pt-1">
                        No score
                      </span>
                    )}
                  </div>

                  {/* Feedback */}
                  {(g.teacher_feedback || g.graded_at) && (
                    <div className="border-t border-soft-border px-5 py-3 flex flex-col gap-2">
                      {g.graded_at && (
                        <p className="text-xs text-muted-text">
                          {g.status === "returned"
                            ? "Returned"
                            : "Graded"}{" "}
                          on{" "}
                          <span className="text-dark-text">
                            {formatDate(g.graded_at)}
                          </span>
                        </p>
                      )}
                      {g.teacher_feedback && (
                        <div>
                          <p className="text-xs font-medium text-muted-text mb-1">
                            Teacher feedback
                          </p>
                          <p className="text-sm text-dark-text whitespace-pre-line">
                            {g.teacher_feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
