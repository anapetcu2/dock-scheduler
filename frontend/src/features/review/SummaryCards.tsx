import type { ReviewSummary } from "../../api/review";

const CARDS: { key: keyof ReviewSummary; label: string }[] = [
  { key: "historical_double_bookings", label: "Historical double-bookings" },
  { key: "vessels_too_long", label: "Vessels on too-short berths" },
  { key: "vessels_unknown_length", label: "Vessels with unknown length" },
  { key: "berths_unknown_length", label: "Berths with unknown length" },
  { key: "unresolved_import_issues", label: "Unresolved parse issues" },
];

export function SummaryCards({ summary }: { summary: ReviewSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map(({ key, label }) => (
        <div key={key} className="rounded-md border border-slate-200 bg-white p-3">
          <div className={`text-2xl font-semibold ${summary[key] > 0 ? "text-amber-700" : "text-slate-900"}`}>
            {summary[key]}
          </div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      ))}
    </div>
  );
}
