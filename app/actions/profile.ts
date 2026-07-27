"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateNameAction(
  firstName: string,
  lastName: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_own_name", {
    p_first_name: firstName.trim(),
    p_last_name: lastName.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/account");
  return {};
}
