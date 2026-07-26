import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import { getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";
import DeleteClassButton from "@/components/classes/DeleteClassButton";
import LeaveClassButton from "@/components/classes/LeaveClassButton";

export const metadata: Metadata = { title: "Class" };

type Props = { params: Promise<{ id: string }> };

export default async function ClassDetailPage({ params }: Props) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  // Layout guards unauthenticated access; profile may be null for legacy accounts.

  const supabase = await createClient();

  type ClassRow = {
    id: string;
    name: string;
    subject: string | null;
    teacher_id: string;
    join_code: string;
    created_at: string;
  };

  type MemberRow = {
    student_id: string;
    joined_at: string;
  };

  type ProfileRow = {
    id: string;
    full_name: string;
  };

  // RLS ensures only the teacher or an enrolled student can see this row
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, subject, teacher_id, join_code, created_at")
    .eq("id", id)
    .single();

  if (!cls) notFound();

  const typedCls = cls as ClassRow;
  const isOwner = profile?.role === "teacher" && typedCls.teacher_id === profile?.id;
  const isStudent = profile?.role === "student";

  // Teacher name — covered by profiles RLS policies added in migration
  const { data: teacherData } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", typedCls.teacher_id)
    .single();

  const teacherName = (teacherData as { full_name: string } | null)?.full_name ?? "Unknown";

  // Member count — visible to both teacher and enrolled student
  const { count: memberCount } = await supabase
    .from("class_members")
    .select("*", { count: "exact", head: true })
    .eq("class_id", id);

  // Full member list — only fetched for the owning teacher
  let members: (MemberRow & { profile: ProfileRow | null })[] = [];

  if (isOwner) {
    const { data: memberRows } = await supabase
      .from("class_members")
      .select("student_id, joined_at")
      .eq("class_id", id)
      .order("joined_at", { ascending: true });

    const rows = (memberRows as MemberRow[]) ?? [];

    if (rows.length > 0) {
      const studentIds = rows.map((r) => r.student_id);
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", studentIds);

      const profileMap = new Map(
        ((profileRows as ProfileRow[]) ?? []).map((p) => [p.id, p])
      );

      members = rows.map((r) => ({
        ...r,
        profile: profileMap.get(r.student_id) ?? null,
      }));
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div>
      <TopBar title={typedCls.name} initials={getInitials(profile?.full_name)} />

      {/* Back link */}
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
        {/* Class summary card */}
        <section
          aria-labelledby="class-info-heading"
          className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6"
        >
          <h2 id="class-info-heading" className="sr-only">Class information</h2>

          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-bold text-dark-text">{typedCls.name}</h2>
              {typedCls.subject && (
                <p className="mt-0.5 text-sm text-muted-text">{typedCls.subject}</p>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-text shrink-0">
              <Users size={13} aria-hidden="true" />
              {memberCount ?? 0} {(memberCount ?? 0) === 1 ? "member" : "members"}
            </span>
          </div>

          <dl className="flex flex-col gap-2 text-sm border-t border-soft-border pt-4">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-text">Teacher</dt>
              <dd className="font-medium text-dark-text">{teacherName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-text">Created</dt>
              <dd className="font-medium text-dark-text">{formatDate(typedCls.created_at)}</dd>
            </div>
            {isOwner && (
              <div className="flex justify-between gap-4 mt-1 pt-3 border-t border-soft-border">
                <dt className="text-muted-text">Join Code</dt>
                <dd className="font-mono font-bold text-dark-text tracking-widest text-base">
                  {typedCls.join_code}
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* Teacher: student roster */}
        {isOwner && (
          <section aria-labelledby="roster-heading">
            <h2
              id="roster-heading"
              className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
            >
              Students
            </h2>

            {members.length === 0 ? (
              <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6 text-sm text-muted-text text-center">
                No students have joined yet. Share the join code above.
              </div>
            ) : (
              <ul className="bg-card-bg border border-soft-border rounded-2xl shadow-card divide-y divide-soft-border" role="list">
                {members.map((m) => (
                  <li
                    key={m.student_id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 first:rounded-t-2xl last:rounded-b-2xl"
                  >
                    <div>
                      <p className="text-sm font-medium text-dark-text">
                        {m.profile?.full_name ?? "Unknown Student"}
                      </p>
                      <p className="text-xs text-muted-text">
                        Joined {formatDate(m.joined_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Actions */}
        <section aria-label="Class actions">
          {isOwner && <DeleteClassButton classId={typedCls.id} />}
          {isStudent && profile && (
            <LeaveClassButton classId={typedCls.id} studentId={profile.id} />
          )}
        </section>
      </div>
    </div>
  );
}
