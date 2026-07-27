import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import { getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";
import CopyCodeButton from "@/components/classes/CopyCodeButton";
import EditClassForm from "@/components/classes/EditClassForm";
import RemoveStudentButton from "@/components/classes/RemoveStudentButton";
import DeleteClassButton from "@/components/classes/DeleteClassButton";
import LeaveClassButton from "@/components/classes/LeaveClassButton";

export const metadata: Metadata = { title: "Class" };

type Props = { params: Promise<{ id: string }> };

type ClassRow = {
  id: string;
  name: string;
  subject: string | null;
  teacher_id: string;
  join_code: string;
  created_at: string;
};

type StudentRow = {
  student_id: string;
  full_name: string;
  email: string;
  joined_at: string;
};

export default async function ClassDetailPage({ params }: Props) {
  const { id } = await params;

  const [profile, supabase] = await Promise.all([
    getCurrentProfile(),
    createClient(),
  ]);

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, subject, teacher_id, join_code, created_at")
    .eq("id", id)
    .single();

  if (!cls) notFound();

  const typedCls = cls as ClassRow;
  const isOwner =
    profile?.role === "teacher" && typedCls.teacher_id === profile?.id;
  const isStudent = profile?.role === "student";

  const [teacherResult, countResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", typedCls.teacher_id)
      .single(),
    supabase
      .from("class_members")
      .select("*", { count: "exact", head: true })
      .eq("class_id", id),
  ]);

  const teacherName =
    (teacherResult.data as { full_name: string } | null)?.full_name ??
    "Unknown";
  const memberCount = countResult.count ?? 0;

  let students: StudentRow[] = [];
  if (isOwner) {
    const { data } = await supabase.rpc("get_class_students", {
      p_class_id: id,
    });
    students = (data as StudentRow[]) ?? [];
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div>
      <TopBar title={typedCls.name} initials={getInitials(profile?.first_name, profile?.last_name)} />

      <div className="mb-5">
        <Link
          href="/classes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-text hover:text-dark-text transition-colors"
        >
          <ChevronLeft size={15} aria-hidden="true" />
          My Classes
        </Link>
      </div>

      <div className="max-w-2xl flex flex-col gap-6">
        {/* Class summary */}
        <section
          aria-labelledby="class-info-heading"
          className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6"
        >
          <h2 id="class-info-heading" className="sr-only">
            Class information
          </h2>

          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-bold text-dark-text">
                {typedCls.name}
              </h2>
              {typedCls.subject && (
                <p className="mt-0.5 text-sm text-muted-text">
                  {typedCls.subject}
                </p>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-text shrink-0">
              <Users size={13} aria-hidden="true" />
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </span>
          </div>

          <dl className="flex flex-col gap-2 text-sm border-t border-soft-border pt-4">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-text">Teacher</dt>
              <dd className="font-medium text-dark-text">{teacherName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-text">Created</dt>
              <dd className="font-medium text-dark-text">
                {formatDate(typedCls.created_at)}
              </dd>
            </div>
          </dl>
        </section>

        {/* Teacher: join code */}
        {isOwner && (
          <section
            aria-labelledby="join-code-heading"
            className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6"
          >
            <h2
              id="join-code-heading"
              className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-4"
            >
              Join Code
            </h2>
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono font-bold text-dark-text tracking-widest text-2xl">
                {typedCls.join_code}
              </span>
              <CopyCodeButton code={typedCls.join_code} />
            </div>
          </section>
        )}

        {/* Teacher: edit class */}
        {isOwner && (
          <section
            aria-labelledby="edit-class-heading"
            className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6"
          >
            <h2
              id="edit-class-heading"
              className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-4"
            >
              Edit Details
            </h2>
            <EditClassForm
              classId={typedCls.id}
              currentName={typedCls.name}
              currentSubject={typedCls.subject}
            />
          </section>
        )}

        {/* Teacher: student roster */}
        {isOwner && (
          <section aria-labelledby="roster-heading">
            <h2
              id="roster-heading"
              className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
            >
              Students
            </h2>

            {students.length === 0 ? (
              <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6 text-sm text-muted-text text-center">
                No students have joined yet. Share the join code above.
              </div>
            ) : (
              <ul
                className="bg-card-bg border border-soft-border rounded-2xl shadow-card divide-y divide-soft-border"
                role="list"
              >
                {students.map((s) => (
                  <li
                    key={s.student_id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 first:rounded-t-2xl last:rounded-b-2xl"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-dark-text truncate">
                        {s.full_name ?? "Unknown Student"}
                      </p>
                      <p className="text-xs text-muted-text truncate">
                        {s.email}
                      </p>
                      <p className="text-xs text-muted-text">
                        Joined {formatDate(s.joined_at)}
                      </p>
                    </div>
                    <RemoveStudentButton
                      classId={typedCls.id}
                      studentId={s.student_id}
                      studentName={s.full_name ?? "this student"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Teacher: danger zone */}
        {isOwner && (
          <section
            aria-labelledby="danger-heading"
            className="bg-card-bg border border-red-200 rounded-2xl shadow-card p-6"
          >
            <h2
              id="danger-heading"
              className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-4"
            >
              Danger Zone
            </h2>
            <p className="text-sm text-muted-text mb-4">
              Deleting this class is permanent and will remove all enrolled
              students.
            </p>
            <DeleteClassButton classId={typedCls.id} />
          </section>
        )}

        {/* Student: leave class */}
        {isStudent && profile && (
          <section aria-label="Class actions">
            <LeaveClassButton classId={typedCls.id} studentId={profile.id} />
          </section>
        )}
      </div>
    </div>
  );
}
