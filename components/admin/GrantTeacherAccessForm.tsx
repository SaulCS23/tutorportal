"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminFindUserByEmailAction,
  adminGrantTeacherRoleAction,
  type AdminUserLookup,
} from "@/app/actions/teacherAccess";

export default function GrantTeacherAccessForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [match, setMatch] = useState<AdminUserLookup | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [granted, setGranted] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGranted(false);
    setLoading(true);

    const result = await adminFindUserByEmailAction(email);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setMatch(undefined);
      return;
    }

    setMatch(result.data ?? null);
    if (!result.data) setError("No account found with that email.");
  }

  async function handleGrant() {
    if (!match) return;
    setError("");
    setLoading(true);

    const result = await adminGrantTeacherRoleAction(match.user_id, "");
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setGranted(true);
    setMatch(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-text">
        For existing accounts that should become teachers without going through
        a request. Look up by email — names aren&apos;t unique.
      </p>

      <form onSubmit={handleLookup} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setMatch(undefined);
            setGranted(false);
          }}
          placeholder="student@example.com"
          className="flex-1 px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-card-bg border border-soft-border text-dark-text text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Searching…" : "Look Up"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
          {error}
        </p>
      )}

      {granted && (
        <p role="status" className="text-sm text-success bg-green-50 border border-green-200 rounded-xl px-3.5 py-2.5">
          Teacher access granted.
        </p>
      )}

      {match && (
        <div className="flex items-center justify-between gap-4 bg-page-bg border border-soft-border rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-dark-text">{match.full_name}</p>
            <p className="text-xs text-muted-text">{match.email}</p>
            <p className="text-xs text-muted-text mt-0.5">Current role: {match.role}</p>
          </div>
          {match.role === "teacher" ? (
            <span className="text-xs font-medium text-muted-text">Already a teacher</span>
          ) : (
            <button
              type="button"
              onClick={handleGrant}
              disabled={loading}
              className="bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
            >
              Grant Teacher Access
            </button>
          )}
        </div>
      )}
    </div>
  );
}
