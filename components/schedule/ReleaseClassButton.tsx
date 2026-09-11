"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { releaseClassAction } from "@/app/actions/schedule";

export default function ReleaseClassButton({
  classId,
  className = "",
}: {
  classId: string;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError("");
    setLoading(true);

    const result = await releaseClassAction(classId);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-xs font-semibold text-muted-text hover:text-red-600 hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? "Releasing…" : "Release Class"}
      </button>
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}
