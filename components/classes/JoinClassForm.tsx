"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinClassForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setJoined(false);

    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError("Enter a class code.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("join_class_by_code", {
      input_code: normalized,
    });

    if (rpcError) {
      const msg = rpcError.message ?? "";
      if (msg.includes("Invalid class code")) {
        setError("That code doesn't match any class. Check the code and try again.");
      } else if (msg.includes("Already enrolled")) {
        setError("You're already enrolled in that class.");
      } else if (msg.includes("Only students")) {
        setError("Only students can join classes.");
      } else {
        setError(msg || "Something went wrong. Please try again.");
      }
      setLoading(false);
      return;
    }

    setCode("");
    setJoined(true);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-6 mb-6">
      <h2 className="text-base font-semibold text-dark-text mb-1">Join a Class</h2>
      <p className="text-sm text-muted-text mb-4">
        Ask your teacher for a 6-character class code.
      </p>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        <div className="flex gap-3">
          <input
            type="text"
            aria-label="Class code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setJoined(false);
              setError("");
            }}
            placeholder="e.g. ABC123"
            spellCheck={false}
            className="flex-1 px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="px-5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Joining…" : "Join"}
          </button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}

        {joined && (
          <p role="status" className="text-sm text-success bg-green-50 border border-green-200 rounded-xl px-3.5 py-2.5">
            You&apos;ve joined the class! It should appear in your list below.
          </p>
        )}
      </form>
    </div>
  );
}
