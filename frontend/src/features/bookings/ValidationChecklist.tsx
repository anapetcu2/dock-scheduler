import type { ValidationIssue, ValidationResult } from "../../api/client";

const OVERLAP_CODES = new Set(["OVERLAP"]);
const FIT_CODES = new Set(["VESSEL_TOO_LONG", "VESSEL_LENGTH_UNKNOWN", "BERTH_LENGTH_UNKNOWN"]);

function CheckRow({ ok, label, issues }: { ok: boolean; label: string; issues: ValidationIssue[] }) {
  return (
    <li className={`flex items-start gap-2 text-sm ${ok ? "text-emerald-700" : "text-red-700"}`}>
      <span aria-hidden>{ok ? "✓" : "✗"}</span>
      <div>
        <div>{label}</div>
        {!ok &&
          issues.map((issue, i) => (
            <div key={i} className="text-xs text-red-600">
              {issue.message}
            </div>
          ))}
      </div>
    </li>
  );
}

interface ValidationChecklistProps {
  result: ValidationResult | undefined;
  isVessel: boolean;
  checking: boolean;
  onOpenConflict: (bookingId: number) => void;
}

export function ValidationChecklist({ result, isVessel, checking, onOpenConflict }: ValidationChecklistProps) {
  if (checking && !result) {
    return <p className="text-sm text-slate-500">Checking…</p>;
  }
  if (!result) return null;

  const overlapIssues = result.errors.filter((e) => OVERLAP_CODES.has(e.code));
  const fitIssues = result.errors.filter((e) => FIT_CODES.has(e.code));
  const otherErrors = result.errors.filter(
    (e) => !OVERLAP_CODES.has(e.code) && !FIT_CODES.has(e.code),
  );

  return (
    <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <ul className="space-y-2">
        <CheckRow ok={overlapIssues.length === 0} label="Berth free for these dates" issues={overlapIssues} />
        {isVessel && (
          <CheckRow ok={fitIssues.length === 0} label="Vessel fits the berth" issues={fitIssues} />
        )}
      </ul>

      {overlapIssues.some((i) => i.related_booking_id != null) && (
        <div className="text-xs">
          {overlapIssues
            .filter((i) => i.related_booking_id != null)
            .map((i) => (
              <button
                key={i.related_booking_id}
                type="button"
                className="text-blue-600 underline hover:text-blue-800"
                onClick={() => onOpenConflict(i.related_booking_id as number)}
              >
                View conflicting booking #{i.related_booking_id}
              </button>
            ))}
        </div>
      )}

      {otherErrors.length > 0 && (
        <ul className="space-y-1 border-t border-slate-200 pt-2">
          {otherErrors.map((issue, i) => (
            <li key={i} className="text-xs text-red-600">
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      {result.warnings.length > 0 && (
        <ul className="space-y-1 border-t border-slate-200 pt-2">
          {result.warnings.map((issue, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
              <span aria-hidden>{"⚠"}</span>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
