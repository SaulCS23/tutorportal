"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateNameAction } from "@/app/actions/profile";

interface AccountFormProps {
  currentFirstName: string;
  currentLastName: string;
}

export default function AccountForm({
  currentFirstName,
  currentLastName,
}: AccountFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(currentFirstName);
  const [lastName, setLastName] = useState(currentLastName);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!firstName.trim()) {
      setError("First name cannot be blank.");
      return;
    }

    const unchanged =
      firstName.trim() === currentFirstName &&
      lastName.trim() === currentLastName;

    if (unchanged) {
      setError("No changes to save.");
      return;
    }

    setLoading(true);
    const result = await updateNameAction(firstName.trim(), lastName.trim());

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
        <label
          htmlFor="firstName"
          className="text-sm font-medium text-dark-text"
        >
          First Name
        </label>
        <input
          id="firstName"
          type="text"
          autoComplete="given-name"
          required
          value={firstName}
          onChange={(e) => {
            setFirstName(e.target.value);
            setSuccess(false);
          }}
          className="w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="lastName"
          className="text-sm font-medium text-dark-text"
        >
          Last Name
        </label>
        <input
          id="lastName"
          type="text"
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => {
            setLastName(e.target.value);
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
