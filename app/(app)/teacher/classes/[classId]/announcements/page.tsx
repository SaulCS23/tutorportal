import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import CreateAnnouncementForm from "@/components/teacher/announcements/CreateAnnouncementForm";
import AnnouncementCard from "@/components/teacher/announcements/AnnouncementCard";

export const metadata: Metadata = { title: "Announcements" };

type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type Props = { params: Promise<{ classId: string }> };

export default async function AnnouncementsPage({ params }: Props) {
  const { classId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, created_at, updated_at")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  const announcements = (data as Announcement[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <CreateAnnouncementForm classId={classId} />

      {announcements.length === 0 ? (
        <div className="bg-card-bg border border-soft-border rounded-2xl p-8 text-sm text-muted-text text-center shadow-card">
          No announcements yet. Post your first one above.
        </div>
      ) : (
        <ul className="flex flex-col gap-4" role="list">
          {announcements.map((a) => (
            <li key={a.id}>
              <AnnouncementCard announcement={a} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
