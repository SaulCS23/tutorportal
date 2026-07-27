import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Clock, CheckCircle, XCircle, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/ui/StatusBadge";
import GradeSubmissionForm from "@/components/teacher/submissions/GradeSubmissionForm";
import type { SubmissionForGrading } from "@/components/teacher/submissions/GradeSubmissionForm";

type Props = {
  params: Promise<{ classId: string; assignmentId: string }>;
};

type RawAssignment = {
  id: string;
  title: string;
  instructions: string | null;
  due_at: string | null;
  points: number;
  status: "draft" | "published";
  class_id: string;
};

type StudentRow = {
  student_id: string;
  full_name: string;
  email: string;
  joined_at: string;
};

type RawSubmission = {
  id: string;
  assignment_id: string;
  student_id: string;
  answer_text: string | null;
  status: "draft" | "submitted" | "graded" | "returned";
  submitted_at: string;
  updated_at: string;
  score: number | null;
  max_score: number | null;
  teacher_feedback: string | null;
  graded_at: string | null;
  graded_by: string | null;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function submissionBadge(
  sub: RawSubmission | undefined,
  dueAt: string | null
): "submitted" | "draft" | "graded" | "returned" | "late" | "missing" {
  if (!sub) return "missing";
  if (sub.status === "graded") return "graded";
  if (sub.status === "returned") return "returned";
  if (sub.status === "draft") return "draft";
  // submitted — check if late
  if (dueAt && new Date(sub.submitted_at) > new Date(dueAt)) return "late";
  return "submitted";
}

export default async function SubmissionsPage({ params }: Props) {
  const { classId, assignmentId } = await params;
  const supabase = await createClient();

  // Fetch assignment — verify it belongs to this class
  const { data: rawAssignment } = await supabase
    .from("assignments")
    .select("id, title, instructions, due_at, points, status, class_id")
    .eq("id", assignmentId)
    .eq("class_id", classId)
    .maybeSingle();

  const assignment = rawAssignment as RawAssignment | null;
  if (!assignment) notFound();

  // Enrolled students via existing SECURITY DEFINER RPC
  const { data: studentsData } = await supabase.rpc("get_class_students", {
    p_class_id: classId,
  });
  const students = (studentsData as StudentRow[]) ?? [];

  // All submissions for this assignment (teacher RLS allows this)
  const { data: subsData } = await supabase
    .from("assignment_submissions")
    .select(
      "id, assignment_id, student_id, answer_text, status, submitted_at, updated_at, score, max_score, teacher_feedback, graded_at, graded_by"
    )
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: true });

  const submissions = (subsData as RawSubmission[]) ?? [];
  const subMap = new Map(submissions.map((s) => [s.student_id, s]));

  // Stats
  const totalEnrolled = students.length;
  const submitted = submissions.filter((s) =>
    ["submitted", "graded", "returned"].includes(s.status)
  ).length;
  const graded = submissions.filter((s) =>
    ["graded", "returned"].includes(s.status)
  ).length;
  const notSubmitted = totalEnrolled - submissions.filter((s) =>
    s.status !== "draft"
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link
        href={`/teacher/classes/${classId}/assignments`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-text hover:text-dark-text transition-colors"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to Assignments
      </Link>

      {/* Assignment header */}
      <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
            <BookOpen size={14} className="text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-dark-text leading-snug">
              {assignment.title}
            </h2>
            <p className="text-xs text-muted-text mt-0.5">
              {assignment.due_at
                ? `Due ${formatDateTime(assignment.due_at)}`
                : "No due date"}{" "}
              {assignment.points > 0 && `· ${assignment.points} pts`}
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              { label: "Enrolled", value: totalEnrolled, color: "text-dark-text" },
              { label: "Submitted", value: submitted, color: "text-blue-600" },
              { label: "Not Submitted", value: notSubmitted, color: "text-red-500" },
              { label: "Graded", value: graded, color: "text-green-600" },
            ] as const
          ).map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-slate-50 border border-soft-border rounded-xl px-4 py-3 text-center"
            >
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-text mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Student list */}
      {students.length === 0 ? (
        <div className="bg-card-bg border border-soft-border rounded-2xl p-8 text-center text-sm text-muted-text shadow-card">
          No students enrolled in this class yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-4" role="list">
          {students.map((student) => {
            const sub = subMap.get(student.student_id);
            const badge = submissionBadge(sub, assignment.due_at);
            const hasSubmission = sub && sub.status !== "draft";
            const isLate =
              hasSubmission &&
              assignment.due_at &&
              new Date(sub!.submitted_at) > new Date(assignment.due_at);

            return (
              <li key={student.student_id}>
                <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card overflow-hidden">
                  {/* Student header */}
                  <div className="px-5 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User size={14} className="text-muted-text" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-dark-text truncate">
                        {student.full_name || student.email}
                      </p>
                      {student.email && (
                        <p className="text-xs text-muted-text truncate">
                          {student.email}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={badge} />
                  </div>

                  {/* Submission detail */}
                  {sub ? (
                    <div className="border-t border-soft-border px-5 py-4 flex flex-col gap-3">
                      {/* Submission meta */}
                      <div className="flex items-center gap-3 text-xs text-muted-text flex-wrap">
                        {hasSubmission && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} aria-hidden="true" />
                            Submitted {formatDateTime(sub.submitted_at)}
                          </span>
                        )}
                        {isLate && (
                          <span className="text-orange-600 font-medium">Late</span>
                        )}
                        {sub.status === "draft" && (
                          <span className="text-muted-text italic">
                            Draft saved, not yet submitted
                          </span>
                        )}
                      </div>

                      {/* Answer */}
                      {sub.answer_text && (
                        <div>
                          <p className="text-xs font-medium text-muted-text mb-1">
                            Answer
                          </p>
                          <div className="bg-slate-50 border border-soft-border rounded-xl px-4 py-3 text-sm text-dark-text whitespace-pre-line max-h-40 overflow-y-auto">
                            {sub.answer_text}
                          </div>
                        </div>
                      )}

                      {/* Existing grade */}
                      {(sub.status === "graded" || sub.status === "returned") &&
                        sub.score !== null && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle
                              size={14}
                              className="text-green-500"
                              aria-hidden="true"
                            />
                            <span className="font-semibold text-dark-text">
                              {sub.score}
                              {sub.max_score !== null && ` / ${sub.max_score}`}
                            </span>
                            {sub.max_score !== null && sub.max_score > 0 && (
                              <span className="text-muted-text">
                                (
                                {Math.round(
                                  (sub.score / sub.max_score) * 100
                                )}
                                %)
                              </span>
                            )}
                          </div>
                        )}

                      {/* Grade form — show for submitted/graded/returned */}
                      {hasSubmission && (
                        <GradeSubmissionForm
                          submission={sub as SubmissionForGrading}
                          assignmentPoints={assignment.points}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="border-t border-soft-border px-5 py-3 flex items-center gap-2 text-xs text-muted-text">
                      <XCircle size={13} className="text-red-400" aria-hidden="true" />
                      No submission yet
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
