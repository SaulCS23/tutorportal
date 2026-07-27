import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import { getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/nav/TopBar";
import HomeworkList from "@/components/homework/HomeworkList";
import type { AssignmentItem } from "@/components/homework/HomeworkList";

export const metadata: Metadata = { title: "Homework" };

export default async function HomeworkPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const isTeacher = profile.role === "teacher";

  let assignments: AssignmentItem[] = [];

  if (isTeacher) {
    // Fetch all assignments for classes the teacher owns, with class name
    const { data } = await supabase
      .from("assignments")
      .select(
        "id, title, instructions, due_at, points, status, class_id, classes ( name )"
      )
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    type RawRow = {
      id: string;
      title: string;
      instructions: string | null;
      due_at: string | null;
      points: number;
      status: "draft" | "published";
      class_id: string;
      classes: { name: string } | null;
    };

    assignments = ((data as unknown as RawRow[]) ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      class_name: r.classes?.name ?? "Unknown Class",
      instructions: r.instructions,
      due_at: r.due_at,
      points: r.points,
      status: r.status,
      class_id: r.class_id,
    }));
  } else {
    // Fetch only published assignments from enrolled classes
    const { data } = await supabase
      .from("assignments")
      .select(
        "id, title, instructions, due_at, points, status, class_id, classes ( name )"
      )
      .eq("status", "published")
      .order("due_at", { ascending: true, nullsFirst: false });

    type RawRow = {
      id: string;
      title: string;
      instructions: string | null;
      due_at: string | null;
      points: number;
      status: "draft" | "published";
      class_id: string;
      classes: { name: string } | null;
    };

    assignments = ((data as unknown as RawRow[]) ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      class_name: r.classes?.name ?? "Unknown Class",
      instructions: r.instructions,
      due_at: r.due_at,
      points: r.points,
      status: r.status,
      class_id: r.class_id,
    }));
  }

  return (
    <div>
      <TopBar
        title="Homework"
        initials={getInitials(profile.first_name, profile.last_name)}
      />

      <div className="mb-6">
        <p className="text-muted-text text-sm">
          {isTeacher
            ? "All assignments across your classes."
            : "All your assignments in one place. Stay on top of due dates."}
        </p>
      </div>

      <HomeworkList assignments={assignments} isTeacher={isTeacher} />
    </div>
  );
}
