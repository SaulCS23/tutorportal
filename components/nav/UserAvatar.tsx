import { getCurrentProfile } from "@/lib/supabase/helpers";

function getInitials(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  const first = parts[0][0].toUpperCase();
  const last = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : "";
  return first + last;
}

export default async function UserAvatar() {
  const profile = await getCurrentProfile();
  const initials = getInitials(profile?.full_name);

  return (
    <div
      role="img"
      aria-label={profile?.full_name ? `User: ${profile.full_name}` : "User"}
      className="w-8 h-8 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center select-none"
    >
      {initials}
    </div>
  );
}
