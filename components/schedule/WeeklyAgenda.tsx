"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { toLocalISODate } from "@/lib/utils";
import ScheduleItemCard from "./ScheduleItemCard";
import type { ScheduleItem } from "./scheduleItems";

function formatWeekRange(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString("en-US", { month: "long" });
  const endMonth = end.toLocaleDateString("en-US", { month: "long" });
  const year = end.getFullYear();

  if (startMonth === endMonth) {
    return `Week of ${startMonth} ${start.getDate()} – ${end.getDate()}, ${year}`;
  }
  return `Week of ${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${year}`;
}

export type AgendaDay = { date: Date; items: ScheduleItem[] };

export default function WeeklyAgenda({
  weekStart,
  weekEnd,
  days,
  isTeacher,
  teacherMap,
  studentsByClass = {},
  viewerTeacherId = null,
  onPrevWeek,
  onNextWeek,
  onOpenMeeting,
}: {
  weekStart: Date;
  weekEnd: Date;
  days: AgendaDay[];
  isTeacher: boolean;
  teacherMap: Record<string, string>;
  studentsByClass?: Record<string, string[]>;
  viewerTeacherId?: string | null;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onOpenMeeting?: (item: ScheduleItem) => void;
}) {
  return (
    <div className="bg-card-bg border border-soft-border rounded-2xl shadow-card p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-base md:text-lg font-bold text-dark-text">
          {formatWeekRange(weekStart, weekEnd)}
        </h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onPrevWeek}
            aria-label="Previous week"
            className="w-9 h-9 flex items-center justify-center rounded-full border border-soft-border text-muted-text hover:text-dark-text hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onNextWeek}
            aria-label="Next week"
            className="w-9 h-9 flex items-center justify-center rounded-full border border-soft-border text-muted-text hover:text-dark-text hover:bg-slate-100 transition-colors"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-soft-border" role="list">
        {days.map(({ date, items }) => (
          <li key={toLocalISODate(date)} className="py-3 flex gap-4">
            <div className="w-12 shrink-0 text-center pt-0.5">
              <p className="text-xs font-medium text-muted-text uppercase tracking-wide">
                {date.toLocaleDateString("en-US", { weekday: "short" })}
              </p>
              <p className="text-lg font-bold text-dark-text">{date.getDate()}</p>
            </div>
            <div className="flex-1 min-w-0">
              {items.length === 0 ? (
                <p className="text-sm text-muted-text py-2">No classes</p>
              ) : (
                <ul className="flex flex-col gap-2" role="list">
                  {items.map((item) => (
                    <ScheduleItemCard
                      key={item.id}
                      item={item}
                      isTeacher={isTeacher}
                      teacherName={item.teacherId ? teacherMap[item.teacherId] : null}
                      studentNames={studentsByClass[item.classId] ?? []}
                      viewerTeacherId={viewerTeacherId}
                      onOpenMeeting={onOpenMeeting}
                    />
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
