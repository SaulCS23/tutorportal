import type { Metadata } from "next";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { GraduationCap } from "lucide-react";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import { getInitials } from "@/lib/utils";
import { resolveTimeZone } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";
import CreateClassForm from "@/components/classes/CreateClassForm";
import JoinClassForm from "@/components/classes/JoinClassForm";

export const metadata: Metadata = { title: "My Classes" };

export default async function ClassesPage() {
  const profile = await getCurrentProfile();
  // Layout guards unauthenticated access; profile may be null for accounts
  // whose row in public.profiles was not created by the trigger.

  const supabase = await createClient();
  const isTeacher = profile?.role === "teacher";

  type TeacherClass = {
    id: string;
    name: string;
    subject: string | null;
    join_code: string;
    created_at: string;
  };

  type StudentMembership = {
    class_id: string;
    joined_at: string;
  };

  type ClassRow = {
    id: string;
    name: string;
    subject: string | null;
  };

  let teacherClasses: TeacherClass[] = [];
  let studentMemberships: StudentMembership[] = [];
  let studentClasses: ClassRow[] = [];

  if (isTeacher && profile) {
    const { data } = await supabase
      .from("classes")
      .select("id, name, subject, join_code, created_at")
      .eq("teacher_id", profile.id)
      .order("created_at", { ascending: false });
    teacherClasses = (data as TeacherClass[]) ?? [];
  } else if (profile) {
    // Fetch memberships
    const { data: memberships } = await supabase
      .from("class_members")
      .select("class_id, joined_at")
      .eq("student_id", profile.id)
      .order("joined_at", { ascending: false });
    studentMemberships = (memberships as StudentMembership[]) ?? [];

    // Fetch class details for those IDs
    if (studentMemberships.length > 0) {
      const ids = studentMemberships.map((m) => m.class_id);
      const { data: cls } = await supabase
        .from("classes")
        .select("id, name, subject")
        .in("id", ids);
      studentClasses = (cls as ClassRow[]) ?? [];
    }
  }

  const timezone = resolveTimeZone(profile?.timezone);
  const formatDate = (iso: string) => formatInTimeZone(new Date(iso), timezone, "MMM d, yyyy");

  return (
    <div>
      <TopBar title="My Classes" initials={getInitials(profile?.first_name, profile?.last_name)} />

      {isTeacher ? (
        <>
          <CreateClassForm />

          {teacherClasses.length === 0 ? (
            <EmptyState message="You haven't created any classes yet. Use the button above to create your first class." />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2" role="list">
              {teacherClasses.map((cls) => (
                <li key={cls.id}>
                  <Link
                    href={`/teacher/classes/${cls.id}`}
                    className="block bg-card-bg border border-soft-border rounded-2xl shadow-card p-5 hover:shadow-card-hover hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                        <GraduationCap size={18} className="text-primary" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-dark-text group-hover:text-primary transition-colors truncate">
                          {cls.name}
                        </p>
                        {cls.subject && (
                          <p className="text-xs text-muted-text mt-0.5 truncate">{cls.subject}</p>
                        )}
                        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-medium bg-slate-100 text-dark-text px-2 py-0.5 rounded-md tracking-wider">
                            {cls.join_code}
                          </span>
                          <span className="text-xs text-muted-text">
                            Created {formatDate(cls.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <JoinClassForm />

          {studentMemberships.length === 0 ? (
            <EmptyState message="You haven't joined any classes yet. Enter a class code above to get started." />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2" role="list">
              {studentMemberships.map((membership) => {
                const cls = studentClasses.find((c) => c.id === membership.class_id);
                if (!cls) return null;
                return (
                  <li key={membership.class_id}>
                    <Link
                      href={`/classes/${cls.id}`}
                      className="block bg-card-bg border border-soft-border rounded-2xl shadow-card p-5 hover:shadow-card-hover hover:border-primary/30 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                          <GraduationCap size={18} className="text-primary" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-dark-text group-hover:text-primary transition-colors truncate">
                            {cls.name}
                          </p>
                          {cls.subject && (
                            <p className="text-xs text-muted-text mt-0.5 truncate">{cls.subject}</p>
                          )}
                          <p className="mt-3 text-xs text-muted-text">
                            Joined {formatDate(membership.joined_at)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <GraduationCap size={22} className="text-muted-text" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted-text max-w-xs">{message}</p>
    </div>
  );
}
