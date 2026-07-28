"use client";

import { DayPicker } from "react-day-picker";
import type { DayButtonProps } from "react-day-picker";

function DayButton({ day, modifiers, className, ...rest }: DayButtonProps) {
  // day/className required in the destructure to keep them out of ...rest
  // (day isn't a valid <button> DOM attribute); neither is used directly.
  void day;
  void className;

  const circleClasses = [
    "w-full aspect-square rounded-full text-sm transition-colors flex items-center justify-center relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
    modifiers.selected
      ? "bg-primary text-white font-semibold"
      : modifiers.today
        ? "text-primary font-bold hover:bg-primary/10"
        : modifiers.outside
          ? "text-muted-text/40 hover:bg-slate-100"
          : "text-dark-text hover:bg-slate-100",
    modifiers.disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : "",
  ].join(" ");

  return (
    <button {...rest} className={circleClasses}>
      {rest.children}
      {modifiers.hasActivity && (
        <span
          className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
            modifiers.selected ? "bg-white" : "bg-primary"
          }`}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export default function ScheduleCalendar({
  displayedMonth,
  selectedDate,
  onSelectDate,
  onMonthChange,
  hasActivity,
}: {
  displayedMonth: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onMonthChange: (month: Date) => void;
  hasActivity: (date: Date) => boolean;
}) {
  return (
    <DayPicker
      mode="single"
      weekStartsOn={1}
      showOutsideDays
      month={displayedMonth}
      onMonthChange={onMonthChange}
      selected={selectedDate}
      onSelect={(date) => {
        if (date) {
          onSelectDate(date);
          onMonthChange(date);
        }
      }}
      modifiers={{ hasActivity }}
      components={{ DayButton, Nav: () => <></> }}
      classNames={{
        months: "flex flex-col",
        month: "flex flex-col gap-2",
        month_caption: "flex items-center h-9",
        caption_label: "text-lg font-bold text-dark-text",
        month_grid: "border-collapse w-full mt-1",
        weekdays: "flex",
        weekday:
          "flex-1 text-muted-text text-xs font-medium h-9 flex items-center justify-center",
        week: "flex w-full",
        day: "flex-1 p-0.5",
      }}
    />
  );
}
