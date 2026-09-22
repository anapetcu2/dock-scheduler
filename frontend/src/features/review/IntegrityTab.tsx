import { Link } from "react-router-dom";

import { useIntegrityIssues } from "../../api/review";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { cardClass } from "../../lib/formStyles";

export function IntegrityTab({ onOpenBooking }: { onOpenBooking: (bookingId: number) => void }) {
  const { data: issues, isPending, isError, error } = useIntegrityIssues();

  if (isPending) return <LoadingState label="Checking data integrity…" />;
  if (isError) return <ErrorState error={error} />;
  if (issues.length === 0) return <EmptyState>No integrity issues found.</EmptyState>;

  return (
    <ul className={`${cardClass} divide-y divide-surface-700/60 text-sm`}>
      {issues.map((issue, i) => (
        <li key={i} className="flex items-start justify-between gap-4 px-4 py-3">
          <div>
            <span
              className={`mr-2 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                issue.severity === "error"
                  ? "bg-rose-500/15 text-rose-400"
                  : "bg-amber-500/15 text-amber-400"
              }`}
            >
              {issue.code}
            </span>
            <span className="text-slate-300">{issue.message}</span>
          </div>
          <div className="flex shrink-0 gap-3 text-xs">
            {issue.booking_id != null && (
              <button
                type="button"
                className="text-brand-400 hover:text-brand-300 hover:underline"
                onClick={() => onOpenBooking(issue.booking_id as number)}
              >
                Open booking
              </button>
            )}
            {issue.related_booking_id != null && (
              <button
                type="button"
                className="text-brand-400 hover:text-brand-300 hover:underline"
                onClick={() => onOpenBooking(issue.related_booking_id as number)}
              >
                Open conflict
              </button>
            )}
            {issue.vessel_id != null && (
              <Link
                to={`/vessels/${issue.vessel_id}`}
                className="text-brand-400 hover:text-brand-300 hover:underline"
              >
                Open vessel
              </Link>
            )}
            {issue.berth_id != null && (
              <Link to="/berths" className="text-brand-400 hover:text-brand-300 hover:underline">
                Open berth
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
