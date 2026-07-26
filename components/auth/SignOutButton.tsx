"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-muted-text hover:bg-red-50 hover:text-red-600 transition-colors"
    >
      <LogOut size={18} aria-hidden="true" />
      Sign Out
    </button>
  );
}
