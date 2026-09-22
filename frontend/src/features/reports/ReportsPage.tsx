import { Download } from "lucide-react";
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
import { cardClass, inputClass, tableHeadClass, tableWrapperClass } from "../../lib/formStyles";

const CHART_COLORS = ["#8189d6", "#92e0e2", "#a0c5d4", "#abb9f2", "#7c87c9", "#98a1ef"];
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
    <div className="animate-fade-in-up">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Reports</h1>
        <a
          href="/api/bookings/export.csv"
          className="transition-default flex items-center gap-1.5 rounded-lg border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm font-medium text-slate-200 hover:border-surface-500 hover:bg-surface-700"
        >
          <Download className="h-4 w-4" />
          Export bookings CSV
        </a>
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <label htmlFor="year-from">From year</label>
        <input
          id="year-from"
          type="number"
          className={`${inputClass} w-24 py-1`}
          value={yearFrom}
          onChange={(e) => setYearFrom(Number(e.target.value))}
        />
        <label htmlFor="year-to">To year</label>
        <input
          id="year-to"
          type="number"
          className={`${inputClass} w-24 py-1`}
          value={yearTo}
          onChange={(e) => setYearTo(Number(e.target.value))}
        />
      </div>

      {isPending && <LoadingState label="Loading report…" />}
      {isError && <ErrorState error={error} />}

      {rows && rows.length > 0 && (
        <>
          <div className={`${cardClass} mb-6 h-80 p-4`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dde1f0" />
                <XAxis dataKey="berth" tick={{ fontSize: 12, fill: "#5b6b82" }} stroke="#c7cce3" />
                <YAxis
                  tick={{ fontSize: 12, fill: "#5b6b82" }}
                  stroke="#c7cce3"
                  label={{
                    value: "Days booked",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#5b6b82",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid #dde1f0",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  labelStyle={{ color: "#111827" }}
                  cursor={{ fill: "rgba(129,137,214,0.08)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#5b6b82" }} />
                {years.map((year, i) => (
                  <Bar
                    key={year}
                    dataKey={String(year)}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className={`${tableWrapperClass} border-separate border-spacing-0 text-sm`}>
            <thead>
              <tr className={tableHeadClass}>
                <th className="px-3 py-2">Berth</th>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Days booked</th>
                <th className="px-3 py-2">Tentative days</th>
                <th className="px-3 py-2">% occupied</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.berth_id}-${row.year}`} className="border-t border-surface-700/60">
                  <td className="px-3 py-2 font-medium text-slate-200">{row.berth_name}</td>
                  <td className="px-3 py-2 text-slate-300">{row.year}</td>
                  <td className="px-3 py-2 text-slate-300">{row.days_booked}</td>
                  <td className="px-3 py-2 text-slate-500">{row.tentative_days}</td>
                  <td className="px-3 py-2 text-slate-300">{row.percent_occupied}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
