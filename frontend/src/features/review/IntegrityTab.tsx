import { Link } from "react-router-dom";

import { useIntegrityIssues } from "../../api/review";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";

export function IntegrityTab({ onOpenBooking }: { onOpenBooking: (bookingId: number) => void }) {
  const { data: issues, isPending, isError, error } = useIntegrityIssues();

  if (isPending) return <LoadingState label="Checking data integrity…" />;
  if (isError) return <ErrorState error={error} />;
  if (issues.length === 0) return <EmptyState>No integrity issues found.</EmptyState>;

  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white text-sm">
      {issues.map((issue, i) => (
        <li key={i} className="flex items-start justify-between gap-4 px-4 py-3">
          <div>
            <span
              className={`mr-2 rounded px-1.5 py-0.5 text-xs font-medium ${
                issue.severity === "error" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {issue.code}
            </span>
            {issue.message}
          </div>
          <div className="flex shrink-0 gap-3 text-xs">
            {issue.booking_id != null && (
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => onOpenBooking(issue.booking_id as number)}
              >
                Open booking
              </button>
            )}
            {issue.related_booking_id != null && (
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => onOpenBooking(issue.related_booking_id as number)}
              >
                Open conflict
              </button>
            )}
            {issue.vessel_id != null && (
              <Link to={`/vessels/${issue.vessel_id}`} className="text-blue-600 hover:underline">
                Open vessel
              </Link>
            )}
            {issue.berth_id != null && (
              <Link to="/berths" className="text-blue-600 hover:underline">
                Open berth
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
