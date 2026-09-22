import type { ViewRange } from "../../lib/dates";
import { formatMonthLabel } from "../../lib/dates";
import { Button } from "../../components/Button";

const VIEW_LABELS: Record<ViewRange, string> = {
  "2w": "2 weeks",
  month: "Month",
  "3m": "3 months",
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
          {"←"}
        </Button>
        <Button variant="secondary" onClick={onToday}>
          Today
        </Button>
        <Button variant="secondary" onClick={onNext} aria-label="Next">
          {"→"}
        </Button>
        <span className="ml-2 text-sm font-medium text-slate-700">{formatMonthLabel(anchor)}</span>
        <input
          type="date"
          value={anchor}
          onChange={(e) => e.target.value && onJump(e.target.value)}
          className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm"
          aria-label="Jump to date"
        />
      </div>
      <div className="flex items-center gap-1 rounded-md border border-slate-300 bg-white p-0.5">
        {(Object.keys(VIEW_LABELS) as ViewRange[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            aria-pressed={view === v}
            className={`rounded px-2.5 py-1 text-sm ${
              view === v ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>
    </div>
  );
}
