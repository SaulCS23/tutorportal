import type { SupabaseClient } from "@supabase/supabase-js";

export type MeetingCancellationEligibility = {
  eligible: boolean;
  cutoff_at: string;
  meeting_starts_at: string;
};

export type MakeupOption = {
  id: string;
  proposed_start_at: string;
  proposed_end_at: string;
};

export type MakeupRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "resolved"
  | "superseded_by_group_reschedule";

export type MakeupRequest = {
  id: string;
  meeting_id: string;
  student_id: string;
  status: MakeupRequestStatus;
  reason: string | null;
  selected_option_id: string | null;
  teacher_note: string | null;
  created_at: string;
  updated_at: string;
};

export type GroupRescheduleStatus = "pending" | "resolved" | "rejected";

export type GroupRescheduleRequest = {
  id: string;
  meeting_id: string;
  class_id: string;
  threshold_count: number;
  eligible_student_count: number;
  status: GroupRescheduleStatus;
  teacher_note: string | null;
  replacement_meeting_id: string | null;
  created_at: string;
  updated_at: string;
};

const MAKEUP_REQUEST_SELECT =
  "id, meeting_id, student_id, status, reason, selected_option_id, teacher_note, created_at, updated_at";
const MAKEUP_OPTION_SELECT = "id, proposed_start_at, proposed_end_at";

export async function getMeetingCancellationEligibility(
  supabase: SupabaseClient,
  meetingId: string
): Promise<{ data: MeetingCancellationEligibility | null; error: string | null }> {
  const { data, error } = await supabase.rpc("meeting_cancellation_eligibility", {
    p_meeting_id: meetingId,
  });
  if (error) return { data: null, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { data: (row as MeetingCancellationEligibility) ?? null, error: null };
}

/** The student's own most recent makeup request for this meeting, if any. */
export async function getOwnMakeupRequest(
  supabase: SupabaseClient,
  meetingId: string
): Promise<{ request: MakeupRequest | null; options: MakeupOption[]; error: string | null }> {
  const { data: request, error } = await supabase
    .from("individual_makeup_requests")
    .select(MAKEUP_REQUEST_SELECT)
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { request: null, options: [], error: error.message };
  if (!request) return { request: null, options: [], error: null };

  const { data: options, error: optionsError } = await supabase
    .from("individual_makeup_options")
    .select(MAKEUP_OPTION_SELECT)
    .eq("request_id", request.id)
    .order("proposed_start_at", { ascending: true });

  if (optionsError) return { request: request as MakeupRequest, options: [], error: optionsError.message };

  return { request: request as MakeupRequest, options: (options as MakeupOption[]) ?? [], error: null };
}

export async function submitMakeupRequest(
  supabase: SupabaseClient,
  params: {
    meetingId: string;
    reason: string | null;
    option1: { start: string; end: string };
    option2: { start: string; end: string };
    option3: { start: string; end: string };
  }
): Promise<{ requestId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("request_individual_makeup", {
    p_meeting_id: params.meetingId,
    p_reason: params.reason,
    p_opt1_start: params.option1.start,
    p_opt1_end: params.option1.end,
    p_opt2_start: params.option2.start,
    p_opt2_end: params.option2.end,
    p_opt3_start: params.option3.start,
    p_opt3_end: params.option3.end,
  });
  return { requestId: (data as string) ?? null, error: error?.message ?? null };
}

export async function approveMakeupOption(
  supabase: SupabaseClient,
  requestId: string,
  optionId: string,
  teacherNote: string | null
): Promise<{ newMeetingId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("approve_makeup_option", {
    p_request_id: requestId,
    p_option_id: optionId,
    p_teacher_note: teacherNote,
  });
  return { newMeetingId: (data as string) ?? null, error: error?.message ?? null };
}

export async function rejectMakeupRequest(
  supabase: SupabaseClient,
  requestId: string,
  teacherNote: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("reject_makeup_request", {
    p_request_id: requestId,
    p_teacher_note: teacherNote,
  });
  return { error: error?.message ?? null };
}

export async function rejectGroupReschedule(
  supabase: SupabaseClient,
  groupRequestId: string,
  teacherNote: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("reject_group_reschedule", {
    p_group_request_id: groupRequestId,
    p_teacher_note: teacherNote,
  });
  return { error: error?.message ?? null };
}

export async function resolveGroupReschedule(
  supabase: SupabaseClient,
  params: {
    groupRequestId: string;
    meetingDate: string;
    startTime: string;
    endTime: string;
    timezone: string | null;
    meetingProvider: string | null;
    meetingLink: string | null;
    location: string | null;
    teacherNote: string | null;
  }
): Promise<{ newMeetingId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("resolve_group_reschedule", {
    p_group_request_id: params.groupRequestId,
    p_meeting_date: params.meetingDate,
    p_start_time: params.startTime,
    p_end_time: params.endTime,
    p_timezone: params.timezone,
    p_meeting_provider: params.meetingProvider,
    p_meeting_link: params.meetingLink,
    p_location: params.location,
    p_teacher_note: params.teacherNote,
  });
  return { newMeetingId: (data as string) ?? null, error: error?.message ?? null };
}
