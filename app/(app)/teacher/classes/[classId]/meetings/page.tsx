import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { ClassMeeting } from "@/lib/supabase/helpers";
import CreateMeetingForm from "@/components/teacher/meetings/CreateMeetingForm";
import MeetingCard from "@/components/teacher/meetings/MeetingCard";

export const metadata: Metadata = { title: "Meetings" };

type Props = { params: Promise<{ classId: string }> };

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function TeacherMeetingsPage({ params }: Props) {
  const { classId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("class_meetings")
    .select(
      "id, class_id, title, description, meeting_date, start_time, end_time, timezone, meeting_provider, meeting_link, location, status, created_at, updated_at"
    )
    .eq("class_id", classId)
    .order("meeting_date", { ascending: true })
    .order("start_time", { ascending: true });

  const meetings = (data as ClassMeeting[]) ?? [];

  const today = todayISODate();
  const upcoming = meetings.filter((m) => m.meeting_date >= today);
  const past = meetings
    .filter((m) => m.meeting_date < today)
    .sort((a, b) => (a.meeting_date < b.meeting_date ? 1 : -1));

  return (
    <div className="flex flex-col gap-6">
      <CreateMeetingForm classId={classId} />

      <section aria-labelledby="upcoming-meetings-heading">
        <h2
          id="upcoming-meetings-heading"
          className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
        >
          Upcoming Meetings
        </h2>
        {upcoming.length === 0 ? (
          <div className="bg-card-bg border border-soft-border rounded-2xl p-8 text-sm text-muted-text text-center shadow-card">
            No upcoming meetings. Create one above.
          </div>
        ) : (
          <ul className="flex flex-col gap-4" role="list">
            {upcoming.map((m) => (
              <li key={m.id}>
                <MeetingCard meeting={m} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-meetings-heading">
          <h2
            id="past-meetings-heading"
            className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
          >
            Past Meetings
          </h2>
          <ul className="flex flex-col gap-4" role="list">
            {past.map((m) => (
              <li key={m.id}>
                <MeetingCard meeting={m} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
