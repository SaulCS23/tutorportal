"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateNameAction(
  firstName: string,
  lastName: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const first = firstName.trim();
  const last = lastName.trim();
  const fullName = [first, last].filter(Boolean).join(" ");

  // 1. Update public.profiles via the secured RPC.
  const { error: rpcError } = await supabase.rpc("update_own_name", {
    p_first_name: first,
    p_last_name: last || null,
  });
  if (rpcError) return { error: rpcError.message };

  // 2. Mirror the values into auth user metadata so the Account page can
  //    resolve names even when the RLS query fails.
  const admin = createAdminClient();
  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      first_name: first,
      last_name: last || null,
      full_name: fullName,
    },
  });
  if (metaError) {
    // Non-fatal: the profile row was already saved. Log and continue.
    console.error("[updateNameAction] metadata update error:", metaError.message);
  }

  revalidatePath("/account");
  return {};
}

export async function updateTimezoneAction(
  timezone: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { error: rpcError } = await supabase.rpc("update_own_timezone", {
    p_timezone: timezone,
  });
  if (rpcError) return { error: rpcError.message };

  revalidatePath("/account");
  return {};
}
