import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";

import type { ValidationIssue, ValidationResult } from "../../api/client";

const OVERLAP_CODES = new Set(["OVERLAP"]);
const FIT_CODES = new Set(["VESSEL_TOO_LONG", "VESSEL_LENGTH_UNKNOWN", "BERTH_LENGTH_UNKNOWN"]);
const DOUBLE_BOOKED_CODES = new Set(["VESSEL_DOUBLE_BOOKED"]);
// Every code that gets its own CheckRow, so leftover errors (MISSING_VESSEL,
// INVALID_DATES, BERTH_INACTIVE, ...) still fall through to the generic list.
const HANDLED_CODES = new Set([...OVERLAP_CODES, ...FIT_CODES, ...DOUBLE_BOOKED_CODES]);

function CheckRow({ ok, label, issues }: { ok: boolean; label: string; issues: ValidationIssue[] }) {
  return (
    <li className={`flex items-start gap-2 text-sm ${ok ? "text-emerald-400" : "text-rose-400"}`}>
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div>
        <div>{label}</div>
        {!ok &&
          issues.map((issue, i) => (
            <div key={i} className="text-xs text-rose-400/80">
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
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {"Checking…"}
      </p>
    );
  }
  if (!result) return null;

  const overlapIssues = result.errors.filter((e) => OVERLAP_CODES.has(e.code));
  const fitIssues = result.errors.filter((e) => FIT_CODES.has(e.code));
  const doubleBookedIssues = result.errors.filter((e) => DOUBLE_BOOKED_CODES.has(e.code));
  const otherErrors = result.errors.filter((e) => !HANDLED_CODES.has(e.code));
  const conflictIssues = [...overlapIssues, ...doubleBookedIssues].filter(
    (i) => i.related_booking_id != null,
  );

  return (
    <div className="animate-fade-in space-y-2 rounded-lg border border-surface-600 bg-surface-800/70 p-3">
      <ul className="space-y-2">
        <CheckRow ok={overlapIssues.length === 0} label="Berth free for these dates" issues={overlapIssues} />
        {isVessel && (
          <>
            <CheckRow ok={fitIssues.length === 0} label="Vessel fits the berth" issues={fitIssues} />
            <CheckRow
              ok={doubleBookedIssues.length === 0}
              label="Vessel not already booked elsewhere"
              issues={doubleBookedIssues}
            />
          </>
        )}
      </ul>

      {conflictIssues.length > 0 && (
        <div className="flex flex-col items-start gap-1 text-xs">
          {conflictIssues.map((i) => (
            <button
              key={i.related_booking_id}
              type="button"
              className="text-brand-400 underline hover:text-brand-300"
              onClick={() => onOpenConflict(i.related_booking_id as number)}
            >
              View conflicting booking #{i.related_booking_id}
            </button>
          ))}
        </div>
      )}

      {otherErrors.length > 0 && (
        <ul className="space-y-1 border-t border-surface-700 pt-2">
          {otherErrors.map((issue, i) => (
            <li key={i} className="text-xs text-rose-400">
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      {result.warnings.length > 0 && (
        <ul className="space-y-1 border-t border-surface-700 pt-2">
          {result.warnings.map((issue, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
