"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import type { ChevronProps, DayButtonProps } from "react-day-picker";
import * as Popover from "@radix-ui/react-popover";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

function parseLocalDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const triggerCls =
  "w-full px-3.5 py-2.5 text-sm bg-page-bg border border-soft-border rounded-xl text-dark-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition flex items-center justify-between gap-2 text-left";

function DayButton({ day, modifiers, className, ...rest }: DayButtonProps) {
  // day/className required in the destructure to keep them out of ...rest
  // (day isn't a valid <button> DOM attribute); neither is used directly.
  void day;
  void className;
  const classes = [
    "w-9 h-9 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary",
    modifiers.selected
      ? "bg-primary text-white hover:bg-primary-dark"
      : modifiers.today
        ? "font-bold text-primary hover:bg-slate-100"
        : modifiers.outside
          ? "text-muted-text/50 hover:bg-slate-100"
          : "text-dark-text hover:bg-slate-100",
    modifiers.disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : "",
  ].join(" ");
  return <button {...rest} className={classes} />;
}

function Chevron({ orientation }: ChevronProps) {
  return orientation === "left" ? (
    <ChevronLeft size={16} aria-hidden="true" />
  ) : (
    <ChevronRight size={16} aria-hidden="true" />
  );
}

/**
 * A date input styled to match the app's text inputs, backed by a
 * react-day-picker calendar in a Radix popover instead of the native
 * <input type="date">, whose per-segment auto-advance (day/month/year)
 * makes typing a date confusing on Chrome/macOS.
 *
 * value/onChange are always a plain "YYYY-MM-DD" string — the same shape
 * a native date input produces — so callers don't need to change anything
 * else about how the date is stored or submitted.
 */
export default function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseLocalDate(value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={triggerCls}>
          <span className={selected ? "" : "text-muted-text"}>
            {selected ? formatDisplay(selected) : "Select a date"}
          </span>
          <Calendar size={15} className="text-muted-text shrink-0" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 bg-card-bg border border-soft-border rounded-2xl shadow-card p-3"
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (date) {
                onChange(toISODate(date));
                setOpen(false);
              }
            }}
            components={{ DayButton, Chevron }}
            classNames={{
              months: "flex flex-col",
              month: "flex flex-col gap-3",
              month_caption: "flex items-center justify-center h-9 relative",
              caption_label: "text-sm font-semibold text-dark-text",
              nav: "flex items-center justify-between absolute inset-x-0 top-0 h-9 px-1",
              button_previous:
                "p-1.5 text-muted-text hover:text-dark-text hover:bg-slate-100 rounded-lg transition-colors",
              button_next:
                "p-1.5 text-muted-text hover:text-dark-text hover:bg-slate-100 rounded-lg transition-colors",
              month_grid: "border-collapse mt-1",
              weekdays: "flex",
              weekday:
                "text-muted-text text-xs font-medium w-9 h-9 flex items-center justify-center",
              week: "flex w-full",
              day: "p-0",
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
