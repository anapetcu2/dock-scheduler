import type { BookingKind, BookingStatus } from "../../api/bookings";
import { KIND_STYLE, STATUS_LABEL } from "../../lib/bookingDisplay";

export interface ScheduleFilterState {
  kind: BookingKind | "";
  status: BookingStatus | "";
  vesselQuery: string;
}

interface ScheduleFiltersProps {
  value: ScheduleFilterState;
  onChange: (value: ScheduleFilterState) => void;
}

export function ScheduleFilters({ value, onChange }: ScheduleFiltersProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
      <select
        className="rounded-md border border-slate-300 px-2 py-1"
        value={value.kind}
        onChange={(e) => onChange({ ...value, kind: e.target.value as BookingKind | "" })}
        aria-label="Filter by kind"
      >
        <option value="">All kinds</option>
        {(Object.keys(KIND_STYLE) as BookingKind[]).map((k) => (
          <option key={k} value={k}>
            {KIND_STYLE[k].label}
          </option>
        ))}
      </select>
      <select
        className="rounded-md border border-slate-300 px-2 py-1"
        value={value.status}
        onChange={(e) => onChange({ ...value, status: e.target.value as BookingStatus | "" })}
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <input
        type="search"
        placeholder={"Search vessel…"}
        className="rounded-md border border-slate-300 px-2 py-1"
        value={value.vesselQuery}
        onChange={(e) => onChange({ ...value, vesselQuery: e.target.value })}
        aria-label="Search vessel"
      />
    </div>
  );
}
