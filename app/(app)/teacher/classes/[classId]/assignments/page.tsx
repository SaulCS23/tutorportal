import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import CreateAssignmentForm from "@/components/teacher/assignments/CreateAssignmentForm";
import AssignmentCard from "@/components/teacher/assignments/AssignmentCard";

export const metadata: Metadata = { title: "Assignments" };

type Assignment = {
  id: string;
  title: string;
  instructions: string | null;
  due_at: string | null;
  points: number;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
};

type Props = { params: Promise<{ classId: string }> };

export default async function AssignmentsPage({ params }: Props) {
  const { classId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("assignments")
    .select("id, title, instructions, due_at, points, status, created_at, updated_at")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  const assignments = (data as Assignment[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <CreateAssignmentForm classId={classId} />

      {assignments.length === 0 ? (
        <div className="bg-card-bg border border-soft-border rounded-2xl p-8 text-sm text-muted-text text-center shadow-card">
          No assignments yet. Create your first one above.
        </div>
      ) : (
        <ul className="flex flex-col gap-4" role="list">
          {assignments.map((a) => (
            // Keying on updated_at too forces a remount (not just a prop
            // update) whenever this assignment is actually saved, so the
            // edit form's local state can never go stale relative to
            // what's really in the database.
            <li key={`${a.id}:${a.updated_at}`}>
              <AssignmentCard assignment={a} classId={classId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
