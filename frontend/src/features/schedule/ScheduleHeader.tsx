import { formatDayNumber, formatWeekdayShort, isMonthStartISO, isTodayISO, isWeekendISO } from "../../lib/dates";

export function ScheduleHeader({ days }: { days: string[] }) {
  return (
    <div
      className="grid border-b border-slate-200 bg-slate-50 text-center text-xs"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(28px, 1fr))` }}
    >
      {days.map((day) => (
        <div
          key={day}
          className={`border-l border-slate-100 py-1 ${
            isWeekendISO(day) ? "bg-slate-100" : ""
          } ${isTodayISO(day) ? "bg-amber-100 font-semibold" : ""} ${
            isMonthStartISO(day) ? "border-l-2 border-l-slate-400" : ""
          }`}
        >
          <div className="text-slate-400">{formatWeekdayShort(day)}</div>
          <div className="text-slate-700">{formatDayNumber(day)}</div>
        </div>
      ))}
    </div>
  );
}
