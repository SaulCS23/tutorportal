"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark transition-colors px-2.5 py-1 rounded-lg border border-primary/30 hover:border-primary/60 bg-blue-50 hover:bg-blue-100"
      aria-label={copied ? "Copied!" : "Copy join code"}
    >
      {copied ? (
        <>
          <Check size={13} aria-hidden="true" />
          Copied!
        </>
      ) : (
        <>
          <Copy size={13} aria-hidden="true" />
          Copy Code
        </>
      )}
    </button>
  );
}
