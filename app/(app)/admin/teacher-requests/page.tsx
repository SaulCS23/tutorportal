import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/helpers";
import { resolveTimeZone } from "@/lib/timezone";
import { getInitials } from "@/lib/utils";
import TopBar from "@/components/nav/TopBar";
import StatusBadge from "@/components/ui/StatusBadge";
import TeacherRequestActions from "@/components/admin/TeacherRequestActions";
import GrantTeacherAccessForm from "@/components/admin/GrantTeacherAccessForm";

export const metadata: Metadata = { title: "Teacher Requests" };

type TeacherAccessRequestRow = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewer_note: string | null;
};

export default async function TeacherRequestsPage() {
  const supabase = await createClient();

  // Authorization is enforced by is_admin() below, which checks the
  // caller's real auth.users.email server-side — this redirect is a UX
  // convenience for non-admins, not the security boundary.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/dashboard");

  const profile = await getCurrentProfile();
  const timezone = resolveTimeZone(profile?.timezone);

  const { data, error } = await supabase.rpc("list_teacher_access_requests");
  const requests = (data as TeacherAccessRequestRow[] | null) ?? [];

  const pending = requests.filter((r) => r.status === "pending");
  const reviewed = requests.filter((r) => r.status !== "pending");

  return (
    <div>
      <TopBar
        title="Teacher Requests"
        initials={getInitials(profile?.first_name ?? null, profile?.last_name ?? null)}
      />

      <div className="max-w-2xl flex flex-col gap-6">
        <section aria-labelledby="grant-heading">
          <h2
            id="grant-heading"
            className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
          >
            Grant Teacher Access Directly
          </h2>
          <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6">
            <GrantTeacherAccessForm />
          </div>
        </section>

        <section aria-labelledby="pending-heading">
          <h2
            id="pending-heading"
            className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
          >
            Pending Requests
          </h2>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {error.message}
            </p>
          )}
          {!error && pending.length === 0 ? (
            <p className="text-sm text-muted-text bg-card-bg border border-soft-border rounded-2xl shadow-card p-6 text-center">
              No pending requests.
            </p>
          ) : (
            <ul role="list" className="flex flex-col gap-3">
              {pending.map((r) => (
                <li
                  key={r.id}
                  className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-dark-text">{r.full_name}</p>
                      <p className="text-xs text-muted-text">{r.email}</p>
                      <p className="text-xs text-muted-text mt-1">
                        Requested {formatInTimeZone(new Date(r.created_at), timezone, "MMM d, yyyy 'at' h:mm a")}
                      </p>
                      {r.message && (
                        <p className="text-sm text-dark-text mt-2 bg-page-bg border border-soft-border rounded-xl px-3 py-2">
                          {r.message}
                        </p>
                      )}
                    </div>
                    <StatusBadge status="pending" />
                  </div>
                  <TeacherRequestActions requestId={r.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {reviewed.length > 0 && (
          <section aria-labelledby="history-heading">
            <h2
              id="history-heading"
              className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3"
            >
              History
            </h2>
            <ul role="list" className="flex flex-col gap-3">
              {reviewed.map((r) => (
                <li
                  key={r.id}
                  className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-dark-text">{r.full_name}</p>
                      <p className="text-xs text-muted-text">{r.email}</p>
                      <p className="text-xs text-muted-text mt-1">
                        {r.reviewed_at &&
                          `Reviewed ${formatInTimeZone(new Date(r.reviewed_at), timezone, "MMM d, yyyy")}`}
                        {r.reviewer_name && ` by ${r.reviewer_name}`}
                      </p>
                      {r.reviewer_note && (
                        <p className="text-sm text-dark-text mt-2 bg-page-bg border border-soft-border rounded-xl px-3 py-2">
                          {r.reviewer_note}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
