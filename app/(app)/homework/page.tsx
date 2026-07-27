import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import { getInitials } from "@/lib/utils";
import TopBar from "@/components/nav/TopBar";
import HomeworkList from "@/components/homework/HomeworkList";

export const metadata: Metadata = { title: "Homework" };

export default async function HomeworkPage() {
  const profile = await getCurrentProfile();

  return (
    <div>
      <TopBar title="Homework" initials={getInitials(profile?.first_name, profile?.last_name)} />

      <div className="mb-6">
        <p className="text-muted-text text-sm">
          All your assignments in one place. Stay on top of due dates.
        </p>
      </div>

      <HomeworkList />
    </div>
  );
}
