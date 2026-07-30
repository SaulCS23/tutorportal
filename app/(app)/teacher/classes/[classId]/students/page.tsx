import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getClassAttendanceHistory } from "@/lib/attendanceStats";
import StudentAttendanceRow from "@/components/teacher/students/StudentAttendanceRow";

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

  const [{ data }, attendanceRecords] = await Promise.all([
    supabase.rpc("get_class_students", { p_class_id: classId }),
    getClassAttendanceHistory(supabase, classId),
  ]);
  const students = (data as StudentRow[]) ?? [];
  const attendanceByStudent = new Map(attendanceRecords.map((r) => [r.studentId, r]));

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
          {students.map((s) => {
            const attendance = attendanceByStudent.get(s.student_id);
            return (
              <StudentAttendanceRow
                key={s.student_id}
                classId={classId}
                studentId={s.student_id}
                fullName={s.full_name}
                email={s.email}
                joinedAt={s.joined_at}
                tally={attendance?.tally ?? { present: 0, late: 0, absent: 0, total: 0, rate: 0 }}
                history={attendance?.history ?? []}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
