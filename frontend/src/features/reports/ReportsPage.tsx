import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useUtilization } from "../../api/reports";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";

const CHART_COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
const CURRENT_YEAR = new Date().getFullYear();

export function ReportsPage() {
  const [yearFrom, setYearFrom] = useState(CURRENT_YEAR - 4);
  const [yearTo, setYearTo] = useState(CURRENT_YEAR);
  const { data: rows, isPending, isError, error } = useUtilization(yearFrom, yearTo);

  const berthNames = rows ? Array.from(new Set(rows.map((r) => r.berth_name))) : [];
  const years = rows ? Array.from(new Set(rows.map((r) => r.year))).sort() : [];

  const chartData = berthNames.map((berthName) => {
    const point: Record<string, number | string> = { berth: berthName };
    for (const year of years) {
      const row = rows?.find((r) => r.berth_name === berthName && r.year === year);
      point[String(year)] = row?.days_booked ?? 0;
    }
    return point;
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        <a
          href="/api/bookings/export.csv"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Export bookings CSV
        </a>
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm">
        <label htmlFor="year-from">From year</label>
        <input
          id="year-from"
          type="number"
          className="w-24 rounded-md border border-slate-300 px-2 py-1"
          value={yearFrom}
          onChange={(e) => setYearFrom(Number(e.target.value))}
        />
        <label htmlFor="year-to">To year</label>
        <input
          id="year-to"
          type="number"
          className="w-24 rounded-md border border-slate-300 px-2 py-1"
          value={yearTo}
          onChange={(e) => setYearTo(Number(e.target.value))}
        />
      </div>

      {isPending && <LoadingState label="Loading report…" />}
      {isError && <ErrorState error={error} />}

      {rows && rows.length > 0 && (
        <>
          <div className="mb-6 h-80 rounded-md border border-slate-200 bg-white p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="berth" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} label={{ value: "Days booked", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Legend />
                {years.map((year, i) => (
                  <Bar key={year} dataKey={String(year)} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Berth</th>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Days booked</th>
                <th className="px-3 py-2">Tentative days</th>
                <th className="px-3 py-2">% occupied</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.berth_id}-${row.year}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{row.berth_name}</td>
                  <td className="px-3 py-2">{row.year}</td>
                  <td className="px-3 py-2">{row.days_booked}</td>
                  <td className="px-3 py-2 text-slate-500">{row.tentative_days}</td>
                  <td className="px-3 py-2">{row.percent_occupied}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
