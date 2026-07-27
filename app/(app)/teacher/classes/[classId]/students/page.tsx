import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import RemoveStudentButton from "@/components/classes/RemoveStudentButton";

export const metadata: Metadata = { title: "Students" };

type StudentRow = {
  student_id: string;
  full_name: string;
  email: string;
  joined_at: string;
};

type Props = { params: Promise<{ classId: string }> };

export default async function StudentsPage({ params }: Props) {
  const { classId } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_class_students", {
    p_class_id: classId,
  });
  const students = (data as StudentRow[]) ?? [];

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div>
      {students.length === 0 ? (
        <div className="bg-card-bg border border-soft-border rounded-2xl p-8 text-sm text-muted-text text-center shadow-card">
          No students have joined yet.
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
                  {s.full_name ?? "Unknown"}
                </p>
                <p className="text-xs text-muted-text truncate">{s.email}</p>
                <p className="text-xs text-muted-text">
                  Joined {formatDate(s.joined_at)}
                </p>
              </div>
              <RemoveStudentButton
                classId={classId}
                studentId={s.student_id}
                studentName={s.full_name ?? "this student"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
