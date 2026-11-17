import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api/axios.js";
import Heatmap90Day from "../components/Heatmap90Day.jsx";
import PageHeader from "../components/PageHeader.jsx";

function getErrorMessage(error) {
  return (
    error.response?.data?.message ||
    "Could not load your insights. Check your connection and try again."
  );
}

export default function Insights() {
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );
  const [heatmap, setHeatmap] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInsights = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [heatmapResponse, comparisonResponse] = await Promise.all([
        api.get("/analytics/heatmap", { params: { timezone: timeZone } }),
        api.get("/analytics/week-over-week", { params: { timezone: timeZone } }),
      ]);
      setHeatmap(heatmapResponse.data);
      setComparison(comparisonResponse.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [timeZone]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const comparisonData = comparison
    ? [
        {
          week: "Last week",
          completions: comparison.previousWeek.completionCount,
        },
        {
          week: "This week",
          completions: comparison.currentWeek.completionCount,
        },
      ]
    : [];
  const percentageChange = comparison?.percentageChange;
  const changeText =
    percentageChange === null || percentageChange === undefined
      ? "No previous activity to compare"
      : `${percentageChange > 0 ? "+" : ""}${percentageChange}% vs last week`;

  return (
    <>
      <PageHeader
        eyebrow="Patterns over time"
        title="Insights"
        description="Explore your consistency and see how your check-ins are changing."
      />

      {error && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="form-error" role="alert">{error}</p>
          <button type="button" className="button-secondary shrink-0" onClick={loadInsights}>
            Try again
          </button>
        </div>
      )}

      <section className="surface-card p-5 sm:p-7">
        <div className="mb-5">
          <h2 className="font-bold text-slate-900">Your last 90 days</h2>
          <p className="mt-1 text-sm text-slate-500">
            Each square represents a local calendar day. Darker squares mean more check-ins.
          </p>
        </div>
        {isLoading ? (
          <div className="grid min-h-36 place-items-center text-sm text-slate-500" role="status">
            Loading your activity...
          </div>
        ) : (
          <Heatmap90Day data={heatmap} />
        )}
      </section>

      <section className="surface-card mt-6 p-5 sm:p-7">
        <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-bold text-slate-900">Week over week</h2>
            <p className="mt-1 text-sm text-slate-500">
              This week so far compared with the same days last week.
            </p>
          </div>
          {comparison && (
            <p
              className={`text-sm font-semibold ${
                comparison.change > 0
                  ? "text-grove-700"
                  : comparison.change < 0
                    ? "text-amber-700"
                    : "text-slate-500"
              }`}
            >
              {changeText}
            </p>
          )}
        </div>
        {isLoading ? (
          <div className="grid h-64 place-items-center text-sm text-slate-500" role="status">
            Loading comparison...
          </div>
        ) : comparisonData.length ? (
          <div className="h-64 w-full" role="img" aria-label="Weekly completion comparison chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
                <CartesianGrid stroke="#e8ece8" vertical={false} />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: "#f0f7f2" }}
                  formatter={(value) => [`${value} check-ins`, "Completions"]}
                />
                <Bar dataKey="completions" fill="#39845a" radius={[8, 8, 0, 0]} maxBarSize={72} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="grid h-64 place-items-center text-sm text-slate-500">
            Weekly comparison is not available yet.
          </div>
        )}
      </section>
    </>
  );
}
