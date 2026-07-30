"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTimezoneAction } from "@/app/actions/profile";
import { TIMEZONE_OPTIONS, isValidTimeZone } from "@/lib/timezone";

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";

export default function TimezoneForm({ currentTimezone }: { currentTimezone: string }) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(currentTimezone);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // The saved value might not be one of the curated options (e.g. an
  // auto-detected zone like "Asia/Tokyo") — add it as an extra option so
  // it's still correctly shown as selected, never silently misrepresented.
  const options = TIMEZONE_OPTIONS.some((o) => o.value === currentTimezone)
    ? TIMEZONE_OPTIONS
    : [{ value: currentTimezone, label: currentTimezone }, ...TIMEZONE_OPTIONS];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!isValidTimeZone(timezone)) {
      setError("Not a recognized timezone.");
      return;
    }
    if (timezone === currentTimezone) {
      setError("No changes to save.");
      return;
    }

    setLoading(true);
    const result = await updateTimezoneAction(timezone);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="timezone" className="text-sm font-medium text-dark-text">
          Timezone
        </label>
        <select
          id="timezone"
          value={timezone}
          onChange={(e) => {
            setTimezone(e.target.value);
            setSuccess(false);
          }}
          className={inputCls}
        >
          {options.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-text">
          All dates and times you see across TutorPortal are shown in this timezone.
        </p>
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
          Timezone updated successfully.
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
