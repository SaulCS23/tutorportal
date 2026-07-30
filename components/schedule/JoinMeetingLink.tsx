"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * The one place a student's "Join Meeting" click is observed and timed —
 * every attendance-tracking meeting-detail surface renders this instead
 * of a plain <a>, so record_meeting_join() always fires the instant the
 * link is used. The link opens in a new tab (target="_blank"), so this
 * component — and anything showing attendance next to it — never
 * unmounts; `onJoined` is how a still-mounted attendance view finds out
 * the write actually happened, so it can refetch and stop showing
 * whatever it loaded before the click. A rejected/no-op RPC call (e.g. a
 * teacher's own click, or a non-enrolled caller) is expected and simply
 * doesn't fire `onJoined` — attendance is student-only by construction
 * (see record_meeting_join, 20240118).
 */
export default function JoinMeetingLink({
  meetingId,
  href,
  className,
  children,
  onClick,
  onJoined,
}: {
  meetingId: string;
  href: string;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Called after record_meeting_join has actually succeeded — not on
   *  click, and not if the call errored or was rejected. */
  onJoined?: () => void;
}) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    const supabase = createClient();
    supabase
      .rpc("record_meeting_join", { p_meeting_id: meetingId })
      .then(({ error }) => {
        if (error) {
          // Was previously a fire-and-forget `void` call, which silently
          // discarded this — surfacing it here so a real failure (vs. an
          // expected non-student rejection) is at least visible in the
          // console instead of only ever showing up as "attendance never
          // recorded" with no clue why.
          console.error("record_meeting_join failed:", error.message);
          return;
        }
        onJoined?.();
      });
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
