import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { todayISODateInTimezone } from "@/lib/utils";
import type { ClassMeeting } from "@/lib/supabase/helpers";
import CreateMeetingForm from "@/components/teacher/meetings/CreateMeetingForm";
import MeetingCard from "@/components/teacher/meetings/MeetingCard";
import IndividualMakeupRequestCard from "@/components/teacher/meetings/IndividualMakeupRequestCard";
import type { MakeupRequestForReview } from "@/components/teacher/meetings/IndividualMakeupRequestCard";
import GroupRescheduleRequestCard from "@/components/teacher/meetings/GroupRescheduleRequestCard";
import type { GroupRescheduleForReview } from "@/components/teacher/meetings/GroupRescheduleRequestCard";

export const metadata: Metadata = { title: "Meetings" };

type Props = { params: Promise<{ classId: string }> };

type RawMakeupRequest = {
  id: string;
  reason: string | null;
  class_meetings: { title: string; start_time: string; timezone: string } | null;
  profiles: { full_name: string } | null;
};

type RawMakeupOption = {
  id: string;
  request_id: string;
  proposed_start_at: string;
  proposed_end_at: string;
};

type RawGroupRequest = {
  id: string;
  threshold_count: number;
  eligible_student_count: number;
  class_meetings: {
    title: string;
    start_time: string;
    end_time: string;
    timezone: string;
    meeting_provider: string | null;
    meeting_link: string | null;
    location: string | null;
  } | null;
};

export default async function TeacherMeetingsPage({ params }: Props) {
  const { classId } = await params;
  const supabase = await createClient();

  const [{ data }, { data: makeupRequestsData }, { data: groupRequestsData }] = await Promise.all([
    supabase
      .from("class_meetings")
      .select(
        "id, class_id, title, description, meeting_date, start_time, end_time, timezone, meeting_provider, meeting_link, location, status, created_at, updated_at"
      )
      .eq("class_id", classId)
      .order("meeting_date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("individual_makeup_requests")
      .select(
        "id, reason, created_at, class_meetings!inner ( title, start_time, timezone, class_id ), profiles ( full_name )"
      )
      .eq("status", "pending")
      .eq("class_meetings.class_id", classId)
      .order("created_at", { ascending: true }),
    supabase
      .from("group_reschedule_requests")
      .select(
        "id, threshold_count, eligible_student_count, created_at, class_meetings ( title, start_time, end_time, timezone, meeting_provider, meeting_link, location )"
      )
      .eq("class_id", classId)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  const meetings = (data as ClassMeeting[]) ?? [];

  const today = todayISODateInTimezone();
  const upcoming = meetings.filter((m) => m.meeting_date >= today);
  const past = meetings
    .filter((m) => m.meeting_date < today)
    .sort((a, b) => (a.meeting_date < b.meeting_date ? 1 : -1));

  const rawMakeupRequests = (makeupRequestsData as unknown as RawMakeupRequest[]) ?? [];
  const rawGroupRequests = (groupRequestsData as unknown as RawGroupRequest[]) ?? [];

  const optionsByRequest: Record<string, RawMakeupOption[]> = {};
  if (rawMakeupRequests.length > 0) {
    const { data: optionsData } = await supabase
      .from("individual_makeup_options")
      .select("id, request_id, proposed_start_at, proposed_end_at")
      .in(
        "request_id",
        rawMakeupRequests.map((r) => r.id)
      )
      .order("proposed_start_at", { ascending: true });

    for (const opt of (optionsData as RawMakeupOption[]) ?? []) {
      (optionsByRequest[opt.request_id] ??= []).push(opt);
    }
  }

  const makeupRequests: MakeupRequestForReview[] = rawMakeupRequests.map((r) => ({
    id: r.id,
    reason: r.reason,
    studentName: r.profiles?.full_name ?? "Unknown Student",
    meetingTitle: r.class_meetings?.title ?? "Meeting",
    meetingStartTime: r.class_meetings?.start_time ?? "00:00:00",
    meetingTimezone: r.class_meetings?.timezone ?? "America/Panama",
    options: (optionsByRequest[r.id] ?? []).map((o) => ({
      id: o.id,
      proposed_start_at: o.proposed_start_at,
      proposed_end_at: o.proposed_end_at,
    })),
  }));

  const groupRequests: GroupRescheduleForReview[] = rawGroupRequests.map((r) => ({
    id: r.id,
    meetingTitle: r.class_meetings?.title ?? "Meeting",
    meetingStartTime: r.class_meetings?.start_time ?? "00:00:00",
    meetingEndTime: r.class_meetings?.end_time ?? "00:00:00",
    meetingTimezone: r.class_meetings?.timezone ?? "America/Panama",
    meetingProvider: r.class_meetings?.meeting_provider ?? null,
    meetingLink: r.class_meetings?.meeting_link ?? null,
    location: r.class_meetings?.location ?? null,
    thresholdCount: r.threshold_count,
    eligibleStudentCount: r.eligible_student_count,
  }));

  return (
    <div className="flex flex-col gap-6">
      <CreateMeetingForm classId={classId} />

      {(makeupRequests.length > 0 || groupRequests.length > 0) && (
        <section aria-labelledby="pending-requests-heading">
          <h2
            id="pending-requests-heading"
            className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
          >
            Pending Requests
          </h2>
          <div className="flex flex-col gap-6">
            {makeupRequests.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-3">
                  Individual Makeup Requests
                </h3>
                <ul className="flex flex-col gap-4" role="list">
                  {makeupRequests.map((r) => (
                    <li key={r.id}>
                      <IndividualMakeupRequestCard request={r} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {groupRequests.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-3">
                  Group Pending Reschedules
                </h3>
                <ul className="flex flex-col gap-4" role="list">
                  {groupRequests.map((r) => (
                    <li key={r.id}>
                      <GroupRescheduleRequestCard request={r} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

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
