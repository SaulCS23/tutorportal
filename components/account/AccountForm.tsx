"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFullNameAction } from "@/app/actions/profile";

export default function AccountForm({ currentFullName }: { currentFullName: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(currentFullName);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!fullName.trim()) {
      setError("Name cannot be blank.");
      return;
    }

    if (fullName.trim() === currentFullName) {
      setError("No changes to save.");
      return;
    }

    setLoading(true);
    const result = await updateFullNameAction(fullName.trim());

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="text-sm font-medium text-dark-text">
          Full Name
        </label>
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            setSuccess(false);
          }}
          className="w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          className="text-sm text-success bg-green-50 border border-green-200 rounded-xl px-3.5 py-2.5"
        >
          Name updated successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
