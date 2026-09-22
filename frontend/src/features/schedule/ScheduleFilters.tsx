import { Search } from "lucide-react";

import type { BookingKind, BookingStatus } from "../../api/bookings";
import { inputClass } from "../../lib/formStyles";
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

const selectClass = `${inputClass} w-auto py-1.5`;

export function ScheduleFilters({ value, onChange }: ScheduleFiltersProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <select
        className={selectClass}
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
        className={selectClass}
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
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          placeholder={"Search vessel…"}
          className={`${inputClass} w-48 py-1.5 pl-8`}
          value={value.vesselQuery}
          onChange={(e) => onChange({ ...value, vesselQuery: e.target.value })}
          aria-label="Search vessel"
        />
      </div>
    </div>
  );
}
