"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { formatInTimeZone } from "date-fns-tz";
import { Bell, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useViewerTimezone } from "@/components/timezone/TimezoneProvider";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from "./notifications";

// The relative math (minutes/hours/days) is a pure epoch diff, always
// timezone-agnostic and correct as-is. Only the fallback absolute date
// (7+ days old) needs a timezone — the viewer's own, not the browser's
// ambient one, which isn't guaranteed to match their saved preference.
function formatRelativeTime(iso: string, timeZone: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatInTimeZone(new Date(iso), timeZone, "MMM d");
}

export default function NotificationsBell() {
  const router = useRouter();
  const viewerTimezone = useViewerTimezone();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function load() {
    const supabase = createClient();
    const result = await getNotifications(supabase);
    if (!result.error) {
      setNotifications(result.data);
      setUnreadCount(result.unreadCount);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) await load();
  }

  async function handleSelect(n: Notification) {
    if (!n.read_at) {
      const supabase = createClient();
      await markNotificationRead(supabase, n.id);
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setOpen(false);
    if (n.link_path) router.push(n.link_path);
  }

  async function handleMarkAllRead() {
    const supabase = createClient();
    await markAllNotificationsRead(supabase);
    setNotifications((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          className="relative p-2 rounded-xl text-muted-text hover:bg-slate-100 hover:text-dark-text transition-colors"
        >
          <Bell size={18} aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 max-w-[90vw] bg-card-bg border border-soft-border rounded-2xl shadow-card-hover overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-soft-border">
            <p className="text-sm font-semibold text-dark-text">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck size={12} aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-sm text-muted-text text-center">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-text text-center">
                No notifications yet.
              </p>
            ) : (
              <ul role="list">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(n)}
                      className={`w-full text-left px-4 py-3 border-b border-soft-border last:border-b-0 hover:bg-slate-50 transition-colors ${
                        n.read_at ? "" : "bg-blue-50/50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read_at && (
                          <span
                            aria-hidden="true"
                            className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-dark-text">{n.title}</p>
                          {n.body && (
                            <p className="text-xs text-muted-text mt-0.5 line-clamp-2">{n.body}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            {formatRelativeTime(n.created_at, viewerTimezone)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
