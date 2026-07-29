import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock, Award } from "lucide-react";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import { getInitials, formatDueDateTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";
import StatusBadge from "@/components/ui/StatusBadge";
import SubmissionForm from "@/components/student/SubmissionForm";
import type { Submission } from "@/components/student/SubmissionForm";
import AssignmentFileList from "@/components/student/AssignmentFileList";
import type { AssignmentFile } from "@/components/student/AssignmentFileList";

type Props = { params: Promise<{ assignmentId: string }> };

type RawAssignment = {
  id: string;
  title: string;
  instructions: string | null;
  due_at: string | null;
  points: number;
  status: "draft" | "published";
  class_id: string;
  classes: { name: string; teacher_id: string } | null;
};

export default async function AssignmentDetailPage({ params }: Props) {
  const { assignmentId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  // Students only — teachers manage assignments from the teacher panel
  if (profile.role === "teacher") {
    redirect("/homework");
  }

  const supabase = await createClient();

  // Fetch assignment — RLS ensures student is enrolled and assignment is published
  const { data: rawAssignment } = await supabase
    .from("assignments")
    .select("id, title, instructions, due_at, points, status, class_id, classes ( name, teacher_id )")
    .eq("id", assignmentId)
    .eq("status", "published")
    .maybeSingle();

  const assignment = rawAssignment as unknown as RawAssignment | null;
  if (!assignment) notFound();

  // Fetch teacher name
  let teacherName = "Your teacher";
  if (assignment.classes?.teacher_id) {
    const { data: teacherProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", assignment.classes.teacher_id)
      .maybeSingle();
    if (teacherProfile?.full_name) teacherName = teacherProfile.full_name;
  }

  // Fetch student's existing submission
  const { data: rawSub } = await supabase
    .from("assignment_submissions")
    .select(
      "id, assignment_id, student_id, answer_text, attachment_url, status, submitted_at, updated_at, score, max_score, teacher_feedback, graded_at"
    )
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  const submission = rawSub as Submission | null;

  // Fetch assignment files — RLS ensures published + enrolled
  const { data: rawFiles } = await supabase
    .from("assignment_files")
    .select("id, storage_path, file_name, file_size")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });

  const files = (rawFiles as AssignmentFile[]) ?? [];

  const isPastDue = assignment.due_at
    ? new Date(assignment.due_at) < new Date()
    : false;

  // Determine display status for badge
  function getSubmissionBadge(): "submitted" | "draft" | "graded" | "returned" | "late" | "missing" | "upcoming" | "overdue" {
    if (!submission) return isPastDue ? "missing" : "upcoming";
    if (submission.status === "graded") return "graded";
    if (submission.status === "returned") return "returned";
    if (submission.status === "submitted") {
      return isPastDue ? "late" : "submitted";
    }
    return "draft";
  }

  return (
    <div>
      <TopBar
        title="Assignment"
        initials={getInitials(profile.first_name, profile.last_name)}
      />

      <Link
        href="/homework"
        className="inline-flex items-center gap-1.5 text-sm text-muted-text hover:text-dark-text transition-colors mb-5"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        All Homework
      </Link>

      {/* Assignment card */}
      <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card overflow-hidden mb-6">
        {/* Header */}
        <div className="px-6 py-5 border-b border-soft-border">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <BookOpen size={14} className="text-primary" aria-hidden="true" />
              </div>
              <h1 className="text-base font-bold text-dark-text leading-snug">
                {assignment.title}
              </h1>
            </div>
            <StatusBadge status={getSubmissionBadge()} />
          </div>
          <p className="text-xs text-muted-text mt-1">
            {assignment.classes?.name ? `${assignment.classes.name} · ` : ""}
            {teacherName}
          </p>
        </div>

        {/* Meta */}
        <div className="px-6 py-4 flex flex-wrap gap-4 border-b border-soft-border bg-slate-50/60">
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-muted-text" aria-hidden="true" />
            <span className="text-xs text-muted-text">
              {assignment.due_at ? (
                <>
                  Due{" "}
                  <span className={`font-medium ${isPastDue ? "text-red-600" : "text-dark-text"}`}>
                    {formatDueDateTime(assignment.due_at)}
                  </span>
                  {isPastDue && (
                    <span className="ml-1 text-red-500 font-medium">(Past due)</span>
                  )}
                </>
              ) : (
                <span className="text-muted-text">No due date</span>
              )}
            </span>
          </div>
          {assignment.points > 0 && (
            <div className="flex items-center gap-1.5">
              <Award size={13} className="text-muted-text" aria-hidden="true" />
              <span className="text-xs text-muted-text">
                <span className="font-medium text-dark-text">{assignment.points}</span> points
              </span>
            </div>
          )}
        </div>

        {/* Instructions */}
        {assignment.instructions && (
          <div className="px-6 py-5 border-b border-soft-border">
            <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">
              Instructions
            </p>
            <p className="text-sm text-dark-text leading-relaxed whitespace-pre-line">
              {assignment.instructions}
            </p>
          </div>
        )}

        <AssignmentFileList files={files} />

        {/* Submission form */}
        <div className="px-6 py-5">
          <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-4">
            Your Work
          </p>
          <SubmissionForm
            assignmentId={assignmentId}
            existingSubmission={submission}
            dueAt={assignment.due_at}
            maxPoints={assignment.points}
          />
        </div>
      </div>

      <p className="text-xs text-muted-text text-center">
        <Link
          href={`/classes/${assignment.class_id}`}
          className="hover:text-primary transition-colors"
        >
          View class page →
        </Link>
      </p>
    </div>
  );
}
