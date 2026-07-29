"use client";

import { useMemo, useState } from "react";
import { CalendarDays, List, ChevronLeft, ChevronRight } from "lucide-react";
import { parseLocalISODate } from "@/lib/utils";
import ScheduleCalendar from "./ScheduleCalendar";
import WeeklyAgenda from "./WeeklyAgenda";
import UpcomingMeetings from "./UpcomingMeetings";
import MeetingDetailModal from "./MeetingDetailModal";
import { getItemsForDate, hasActivityOnDate, getUpcomingMeetings } from "./scheduleItems";
import type { RawClassSchedule, RawClassMeeting, ScheduleItem } from "./scheduleItems";

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

/** Monday of the week containing `date` (date.getDay() is 0=Sun…6=Sat). */
function startOfWeekMonday(date: Date): Date {
  const daysSinceMonday = (date.getDay() + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

export default function ScheduleView({
  schedules,
  meetings,
  teacherMap,
  isTeacher,
  todayISO,
}: {
  schedules: RawClassSchedule[];
  meetings: RawClassMeeting[];
  teacherMap: Record<string, string>;
  isTeacher: boolean;
  todayISO: string;
}) {
  // Computed server-side and passed down as a plain string so the very
  // first client render agrees with the server-rendered HTML — no
  // hydration mismatch from re-deriving "today" independently in the browser.
  const today = useMemo(() => parseLocalISODate(todayISO) ?? new Date(), [todayISO]);

  const [selectedDate, setSelectedDate] = useState(today);
  const [displayedMonth, setDisplayedMonth] = useState(today);
  const [openMeetingItem, setOpenMeetingItem] = useState<ScheduleItem | null>(null);

  const weekStart = useMemo(() => startOfWeekMonday(selectedDate), [selectedDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const agendaDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        return { date, items: getItemsForDate(date, schedules, meetings) };
      }),
    [weekStart, schedules, meetings]
  );

  const upcoming = useMemo(
    () => getUpcomingMeetings(meetings, todayISO, 5),
    [meetings, todayISO]
  );

  function goToday() {
    setSelectedDate(today);
    setDisplayedMonth(today);
  }

  function goPrevMonth() {
    setDisplayedMonth((m) => addMonths(m, -1));
  }

  function goNextMonth() {
    setDisplayedMonth((m) => addMonths(m, 1));
  }

  function goPrevWeek() {
    const next = addDays(selectedDate, -7);
    setSelectedDate(next);
    setDisplayedMonth(next);
  }

  function goNextWeek() {
    const next = addDays(selectedDate, 7);
    setSelectedDate(next);
    setDisplayedMonth(next);
  }

  const navButtonCls =
    "w-9 h-9 flex items-center justify-center rounded-full border border-soft-border text-muted-text hover:text-dark-text hover:bg-slate-100 transition-colors";

  return (
    <div>
      {/* Calendar/Weekly section tabs + Today/month nav — the page title
          itself comes from the shared <TopBar>, not repeated here. */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-5 border-b border-soft-border">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary pb-2.5 -mb-px border-b-2 border-primary">
            <CalendarDays size={15} aria-hidden="true" />
            Calendar
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-text pb-2.5">
            <List size={15} aria-hidden="true" />
            Weekly
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="px-4 py-2 text-sm font-medium text-dark-text border border-soft-border rounded-xl hover:bg-slate-100 transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goPrevMonth}
            aria-label="Previous month"
            className={navButtonCls}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={goNextMonth}
            aria-label="Next month"
            className={navButtonCls}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Calendar (top-left) / Weekly agenda (right, full height) / Upcoming (bottom-left) —
          reordered per breakpoint via named grid areas so mobile stacks
          Calendar -> Weekly -> Upcoming while desktop keeps Weekly beside both. */}
      <div
        className="grid grid-cols-1 gap-6 lg:grid-cols-2
          [grid-template-areas:'calendar'_'agenda'_'upcoming']
          lg:[grid-template-areas:'calendar_agenda'_'upcoming_agenda']"
      >
        <div
          className="[grid-area:calendar] bg-card-bg border border-soft-border rounded-2xl shadow-card p-5 md:p-6"
        >
          <ScheduleCalendar
            displayedMonth={displayedMonth}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onMonthChange={setDisplayedMonth}
            hasActivity={(date) => hasActivityOnDate(date, schedules, meetings)}
          />
          <p className="flex items-center gap-2 text-xs text-muted-text mt-4 pt-4 border-t border-soft-border">
            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
            Days with classes
          </p>
        </div>

        <div className="[grid-area:agenda]">
          <WeeklyAgenda
            weekStart={weekStart}
            weekEnd={weekEnd}
            days={agendaDays}
            isTeacher={isTeacher}
            teacherMap={teacherMap}
            onPrevWeek={goPrevWeek}
            onNextWeek={goNextWeek}
            onOpenMeeting={isTeacher ? undefined : setOpenMeetingItem}
          />
        </div>

        <div className="[grid-area:upcoming]">
          <UpcomingMeetings
            items={upcoming}
            isTeacher={isTeacher}
            teacherMap={teacherMap}
            onOpenMeeting={isTeacher ? undefined : setOpenMeetingItem}
          />
        </div>
      </div>

      {openMeetingItem && (
        <MeetingDetailModal
          item={openMeetingItem}
          teacherName={
            openMeetingItem.teacherId ? teacherMap[openMeetingItem.teacherId] : null
          }
          onClose={() => setOpenMeetingItem(null)}
        />
      )}
    </div>
  );
}
