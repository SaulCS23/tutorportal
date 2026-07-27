import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import { getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";
import CopyCodeButton from "@/components/classes/CopyCodeButton";
import ClassTabNav from "@/components/teacher/ClassTabNav";

type Props = {
  children: React.ReactNode;
  params: Promise<{ classId: string }>;
};

export default async function TeacherClassLayout({ children, params }: Props) {
  const { classId } = await params;

  const [profile, supabase] = await Promise.all([
    getCurrentProfile(),
    createClient(),
  ]);

  if (!profile || profile.role !== "teacher") redirect("/classes");

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, subject, join_code")
    .eq("id", classId)
    .eq("teacher_id", profile.id)
    .single();

  if (!cls) notFound();

  const { count: studentCount } = await supabase
    .from("class_members")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classId);

  return (
    <div>
      <TopBar
        title={cls.name}
        initials={getInitials(profile.first_name, profile.last_name)}
      />

      {/* Back link */}
      <Link
        href="/classes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-text hover:text-dark-text transition-colors mb-4"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        My Classes
      </Link>

      {/* Class header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-dark-text truncate">{cls.name}</h1>
            {cls.subject && (
              <p className="text-sm text-muted-text mt-0.5">{cls.subject}</p>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-text shrink-0 pt-1">
            <Users size={13} aria-hidden="true" />
            {studentCount ?? 0}{" "}
            {(studentCount ?? 0) === 1 ? "student" : "students"}
          </span>
        </div>

        <div className="inline-flex items-center gap-2 mt-3">
          <span className="font-mono text-sm font-bold text-dark-text tracking-widest bg-slate-100 px-3 py-1 rounded-lg">
            {cls.join_code}
          </span>
          <CopyCodeButton code={cls.join_code} />
        </div>
      </div>

      <ClassTabNav classId={classId} />

      {children}
    </div>
  );
}
