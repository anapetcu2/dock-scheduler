import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "../../components/Button";
import type { ViewRange } from "../../lib/dates";
import { formatMonthLabel } from "../../lib/dates";

const VIEW_LABELS: Record<ViewRange, string> = {
  "2w": "2 weeks",
  month: "Month",
};

interface ScheduleToolbarProps {
  view: ViewRange;
  anchor: string;
  onViewChange: (view: ViewRange) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onJump: (date: string) => void;
}

export function ScheduleToolbar({
  view,
  anchor,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onJump,
}: ScheduleToolbarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onPrevious} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="secondary" onClick={onToday}>
          Today
        </Button>
        <Button variant="secondary" onClick={onNext} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-2 flex items-center gap-1.5 text-sm font-medium text-slate-200">
          <CalendarClock className="h-4 w-4 text-brand-400" />
          {formatMonthLabel(anchor)}
        </span>
        <input
          type="date"
          value={anchor}
          onChange={(e) => e.target.value && onJump(e.target.value)}
          className="transition-default ml-2 rounded-lg border border-surface-600 bg-surface-800 px-2 py-1 text-sm text-slate-100 hover:border-surface-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          aria-label="Jump to date"
        />
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-surface-600 bg-surface-800 p-0.5">
        {(Object.keys(VIEW_LABELS) as ViewRange[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            aria-pressed={view === v}
            className={`transition-default rounded-md px-2.5 py-1 text-sm ${
              view === v
                ? "bg-brand-gradient text-white shadow-glow"
                : "text-slate-400 hover:bg-surface-700 hover:text-slate-900"
            }`}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>
    </div>
  );
}
