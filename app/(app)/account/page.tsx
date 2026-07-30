import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/helpers";
import { getInitials } from "@/lib/utils";
import { resolveTimeZone } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";
import { getOwnAttendanceHistory } from "@/lib/attendanceStats";
import TopBar from "@/components/nav/TopBar";
import AccountForm from "@/components/account/AccountForm";
import TimezoneForm from "@/components/account/TimezoneForm";
import AttendanceHistoryList from "@/components/schedule/AttendanceHistoryList";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  if (!user) redirect("/login");

  const timezone = resolveTimeZone(profile?.timezone);
  const isStudent = profile?.role === "student";
  let attendance: Awaited<ReturnType<typeof getOwnAttendanceHistory>> | null = null;
  if (isStudent) {
    const supabase = await createClient();
    attendance = await getOwnAttendanceHistory(supabase);
  }

  // Resolve display values: profile row → auth user_metadata → empty string.
  // This ensures the page always shows something even when the RLS query fails.
  const meta = user.user_metadata as Record<string, string | undefined> ?? {};

  const firstName: string =
    profile?.first_name || meta.first_name || "";

  const lastName: string =
    profile?.last_name || meta.last_name || "";

  const displayFullName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "—";

  const roleLabel = profile?.role === "teacher" ? "Teacher" : "Student";
  const memberSince = profile
    ? formatInTimeZone(new Date(profile.created_at), timezone, "MMMM yyyy")
    : null;

  return (
    <div>
      <TopBar
        title="Account"
        initials={getInitials(firstName || null, lastName || null)}
      />

      <div className="max-w-lg flex flex-col gap-6">
        {/* Account info */}
        <section aria-labelledby="account-info-heading">
          <h2
            id="account-info-heading"
            className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
          >
            Account Info
          </h2>
          <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card divide-y divide-soft-border">
            <dl>
              <Row label="Email" value={user.email ?? "—"} />
              <Row label="Full Name" value={displayFullName} />
              <Row
                label="Account Type"
                value={
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-primary border border-blue-100">
                    {roleLabel}
                  </span>
                }
              />
              {memberSince && <Row label="Member Since" value={memberSince} />}
              <Row label="Timezone" value={timezone} />
            </dl>
          </div>
        </section>

        {/* Update name */}
        <section aria-labelledby="update-name-heading">
          <h2
            id="update-name-heading"
            className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
          >
            Update Name
          </h2>
          <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6">
            <AccountForm
              currentFirstName={firstName}
              currentLastName={lastName}
            />
          </div>
        </section>

        {/* Change timezone */}
        <section aria-labelledby="timezone-heading">
          <h2
            id="timezone-heading"
            className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
          >
            Timezone
          </h2>
          <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6">
            <TimezoneForm currentTimezone={timezone} />
          </div>
        </section>

        {/* Attendance history — students only, read-only */}
        {isStudent && attendance && (
          <section aria-labelledby="attendance-heading">
            <h2
              id="attendance-heading"
              className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
            >
              Attendance History
            </h2>
            <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6 flex flex-col gap-4">
              {attendance.tally.total === 0 ? (
                <p className="text-sm text-muted-text text-center py-2">
                  No concluded meetings yet.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-green-600">{attendance.tally.present}</p>
                      <p className="text-xs text-muted-text">Present</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-orange-500">{attendance.tally.late}</p>
                      <p className="text-xs text-muted-text">Late</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-500">{attendance.tally.absent}</p>
                      <p className="text-xs text-muted-text">Absent</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-dark-text">{attendance.tally.rate}%</p>
                      <p className="text-xs text-muted-text">Rate</p>
                    </div>
                  </div>
                  <AttendanceHistoryList entries={attendance.history} isTeacher={false} showClassName />
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5 first:rounded-t-2xl last:rounded-b-2xl">
      <dt className="text-sm text-muted-text shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-dark-text text-right">{value}</dd>
    </div>
  );
}
