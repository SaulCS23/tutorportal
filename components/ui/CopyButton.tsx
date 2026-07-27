"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export default function CopyButton({ text, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied!" : `Copy ${label ?? text}`}
      className={
        className ??
        "inline-flex items-center gap-1 text-xs font-medium text-muted-text hover:text-dark-text transition-colors p-1 rounded hover:bg-slate-100"
      }
    >
      {copied ? (
        <Check size={13} aria-hidden="true" className="text-success" />
      ) : (
        <Copy size={13} aria-hidden="true" />
      )}
    </button>
  );
}
