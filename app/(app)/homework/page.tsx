import type { Metadata } from "next";
import TopBar from "@/components/nav/TopBar";
import HomeworkList from "@/components/homework/HomeworkList";

export const metadata: Metadata = { title: "Homework" };

export default function HomeworkPage() {
  return (
    <div>
      <TopBar title="Homework" />

      <div className="mb-6">
        <p className="text-muted-text text-sm">
          All your assignments in one place. Stay on top of due dates.
        </p>
      </div>

      <HomeworkList />
    </div>
  );
}
