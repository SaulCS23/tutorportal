import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationType =
  | "makeup_requested"
  | "group_pending_reschedule"
  | "makeup_approved"
  | "makeup_rejected"
  | "group_rescheduled";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
};

const NOTIFICATION_SELECT = "id, type, title, body, link_path, read_at, created_at";

/** Most recent notifications for the signed-in user, newest first. */
export async function getNotifications(
  supabase: SupabaseClient,
  limit: number = 20
): Promise<{ data: Notification[]; unreadCount: number; error: string | null }> {
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from("notifications")
      .select(NOTIFICATION_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
  ]);

  if (error) return { data: [], unreadCount: 0, error: error.message };
  if (countError) return { data: (data as Notification[]) ?? [], unreadCount: 0, error: countError.message };

  return { data: (data as Notification[]) ?? [], unreadCount: count ?? 0, error: null };
}

export async function markNotificationRead(
  supabase: SupabaseClient,
  notificationId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  return { error: error?.message ?? null };
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("mark_all_notifications_read");
  return { error: error?.message ?? null };
}
