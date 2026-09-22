import { AlertOctagon, FileWarning, Ruler, ShieldAlert, Sailboat } from "lucide-react";
import type { ComponentType } from "react";

import type { ReviewSummary } from "../../api/review";

const CARDS: { key: keyof ReviewSummary; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "historical_double_bookings", label: "Historical double-bookings", icon: AlertOctagon },
  { key: "vessels_too_long", label: "Vessels on too-short berths", icon: ShieldAlert },
  { key: "vessels_unknown_length", label: "Vessels with unknown length", icon: Sailboat },
  { key: "berths_unknown_length", label: "Berths with unknown length", icon: Ruler },
  { key: "unresolved_import_issues", label: "Unresolved parse issues", icon: FileWarning },
];

export function SummaryCards({ summary }: { summary: ReviewSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map(({ key, label, icon: Icon }) => {
        const hasIssues = summary[key] > 0;
        return (
          <div
            key={key}
            className={`transition-default rounded-xl border p-3 ${
              hasIssues
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-surface-700 bg-surface-850"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <Icon className={`h-4 w-4 ${hasIssues ? "text-amber-400" : "text-slate-600"}`} />
              <div className={`text-2xl font-semibold ${hasIssues ? "text-amber-300" : "text-slate-100"}`}>
                {summary[key]}
              </div>
            </div>
            <div className="text-xs text-slate-400">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
