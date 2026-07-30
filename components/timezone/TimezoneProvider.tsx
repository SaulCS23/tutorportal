"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { detectBrowserTimeZone, resolveTimeZone } from "@/lib/timezone";

const TimezoneContext = createContext<string | null>(null);

/**
 * Provides the current viewer's saved timezone to every client component
 * beneath it — seeded server-side from the profile row (see
 * app/(app)/layout.tsx), so there's no flash of the wrong zone on first
 * paint. When the server found no saved timezone yet (profile.timezone
 * is null), detects the browser's own zone once and asks the database to
 * save it — but only if still unset by the time the call reaches the
 * server (set_own_timezone_if_unset, 20240119), so a concurrent manual
 * choice made from the Account page is never clobbered.
 */
export default function TimezoneProvider({
  initialTimezone,
  children,
}: {
  initialTimezone: string | null;
  children: React.ReactNode;
}) {
  const [timezone, setTimezone] = useState(resolveTimeZone(initialTimezone));

  useEffect(() => {
    if (initialTimezone) return; // already saved — never auto-detect again
    const detected = detectBrowserTimeZone();
    setTimezone(detected);
    const supabase = createClient();
    void supabase.rpc("set_own_timezone_if_unset", { p_timezone: detected });
    // initialTimezone intentionally omitted from deps — this must only
    // ever run once, the instant a session finds no saved timezone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <TimezoneContext.Provider value={timezone}>{children}</TimezoneContext.Provider>;
}

/** The current viewer's saved (or just-detected) IANA timezone — always
 *  a valid zone name, never null/empty. */
export function useViewerTimezone(): string {
  const tz = useContext(TimezoneContext);
  return resolveTimeZone(tz);
}
