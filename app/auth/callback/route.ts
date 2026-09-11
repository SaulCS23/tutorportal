import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";

  // Reject any next value that doesn't start with "/" to prevent open redirects
  const next = nextParam.startsWith("/") ? nextParam : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // No-op for every flow except a freshly-verified Flow A signup (see
      // supabase/migrations/20240121000000_preapproved_students.sql) —
      // safe to call unconditionally on every callback, including
      // password-reset confirmations.
      const { error: claimError } = await supabase.rpc(
        "claim_preapproved_student_from_own_metadata"
      );
      if (claimError) {
        console.error("[auth/callback] claim_preapproved_student error:", claimError.message);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
