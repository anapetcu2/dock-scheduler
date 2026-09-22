import {
  formatDayNumber,
  formatWeekdayShort,
  isMonthStartISO,
  isTodayISO,
  isWeekendISO,
} from "../../lib/dates";

export function ScheduleHeader({ days }: { days: string[] }) {
  return (
    <div
      className="grid border-b border-surface-700 bg-surface-800/60 text-center text-xs"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(28px, 1fr))` }}
    >
      {days.map((day) => (
        <div
          key={day}
          className={`border-l border-surface-700/60 py-1 ${
            isWeekendISO(day) ? "bg-surface-900/40" : ""
          } ${isTodayISO(day) ? "bg-brand-600/20 font-semibold" : ""} ${
            isMonthStartISO(day) ? "border-l-2 border-l-brand-500/50" : ""
          }`}
        >
          <div className="text-slate-500">{formatWeekdayShort(day)}</div>
          <div className={isTodayISO(day) ? "text-brand-300" : "text-slate-300"}>
            {formatDayNumber(day)}
          </div>
        </div>
      ))}
    </div>
  );
}
