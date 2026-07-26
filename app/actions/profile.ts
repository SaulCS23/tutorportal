"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateFullNameAction(
  newName: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_own_full_name", {
    new_full_name: newName.trim(),
  });
  if (error) return { error: error.message };
  revalidatePath("/account");
  return {};
}
