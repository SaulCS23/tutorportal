import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/helpers";
import TopBar from "@/components/nav/TopBar";
import AccountForm from "@/components/account/AccountForm";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()]);

  if (!user) redirect("/login");
  // profile may be null for accounts whose profiles row was not yet created

  const roleLabel = profile?.role === "teacher" ? "Teacher" : "Student";
  const memberSince = profile
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div>
      <TopBar title="Account" />

      <div className="max-w-lg flex flex-col gap-6">
        {/* Account info */}
        <section aria-labelledby="account-info-heading">
          <h2 id="account-info-heading" className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">
            Account Info
          </h2>
          <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card divide-y divide-soft-border">
            <dl>
              <Row label="Email" value={user.email ?? "—"} />
              <Row label="Full Name" value={profile?.full_name ?? "—"} />
              <Row
                label="Account Type"
                value={
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-primary border border-blue-100">
                    {roleLabel}
                  </span>
                }
              />
              {memberSince && <Row label="Member Since" value={memberSince} />}
            </dl>
          </div>
        </section>

        {/* Update name — always shown so users without a profile row can set their name */}
        <section aria-labelledby="update-name-heading">
          <h2 id="update-name-heading" className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">
            Update Name
          </h2>
          <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6">
            <AccountForm currentFullName={profile?.full_name ?? ""} />
          </div>
        </section>
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
