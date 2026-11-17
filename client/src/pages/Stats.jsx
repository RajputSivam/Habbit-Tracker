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
import MetricCard from "../components/MetricCard.jsx";
import PageHeader from "../components/PageHeader.jsx";

function monthLabel(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}-01T00:00:00.000Z`));
}

function getErrorMessage(error) {
  return (
    error.response?.data?.message ||
    "Could not load your stats. Check your connection and try again."
  );
}

export default function Stats() {
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );
  const [monthly, setMonthly] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [monthlyResponse, performanceResponse, heatmapResponse] = await Promise.all([
        api.get("/analytics/monthly", { params: { timezone: timeZone } }),
        api.get("/analytics/habit-performance", { params: { timezone: timeZone } }),
        api.get("/analytics/heatmap", { params: { timezone: timeZone } }),
      ]);
      setMonthly(monthlyResponse.data);
      setPerformance(performanceResponse.data);
      setHeatmap(heatmapResponse.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [timeZone]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const activeHabits = (performance?.habits || []).filter((habit) => !habit.isArchived);
  const months = monthly?.months || [];
  const totalCheckIns = months.reduce((total, month) => total + month.completionCount, 0);
  const rateHabits = activeHabits.filter((habit) => habit.scheduledDays > 0);
  const averageRate = rateHabits.length
    ? Math.round(rateHabits.reduce((total, habit) => total + habit.completionRate, 0) / rateHabits.length)
    : 0;
  const mostConsistent = [...rateHabits].sort(
    (first, second) => second.completionRate - first.completionRate
  )[0];
  const activeDays = heatmap?.days.filter((day) => day.count > 0).length || 0;

  return (
    <>
      <PageHeader
        eyebrow="Your progress"
        title="Stats"
        description="A closer look at your completion history and habit performance."
      />

      {error && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="form-error" role="alert">{error}</p>
          <button type="button" className="button-secondary shrink-0" onClick={loadStats}>
            Try again
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total check-ins"
          value={isLoading ? "…" : totalCheckIns}
          caption="Trailing 12 calendar months"
        />
        <MetricCard
          label="Average completion"
          value={isLoading ? "…" : `${averageRate}%`}
          caption="Scheduled days over the last 30 days"
        />
        <MetricCard
          label="Most consistent"
          value={isLoading ? "…" : mostConsistent?.name || "--"}
          caption={mostConsistent ? `${mostConsistent.completionRate}% in the last 30 days` : "No scheduled days yet"}
        />
        <MetricCard
          label="90-day activity"
          value={isLoading ? "…" : `${activeDays} days`}
          caption="Days with at least one check-in"
        />
      </div>

      <section className="surface-card mt-6 p-5 sm:p-7">
        <div className="mb-5">
          <h2 className="font-bold text-slate-900">Monthly check-ins</h2>
          <p className="mt-1 text-sm text-slate-500">Completion totals across all your habits.</p>
        </div>
        {isLoading ? (
          <div className="grid h-72 place-items-center text-sm text-slate-500" role="status">
            Loading monthly stats...
          </div>
        ) : months.length ? (
          <div className="h-72 w-full" role="img" aria-label="Monthly check-in totals chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
                <CartesianGrid stroke="#e8ece8" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={monthLabel}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  interval={0}
                />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(label) => new Date(`${label}-01T00:00:00.000Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
                  formatter={(value) => [`${value} check-ins`, "Completions"]}
                />
                <Bar dataKey="completionCount" fill="#39845a" radius={[6, 6, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="grid h-72 place-items-center text-sm text-slate-500">
            No monthly completion data is available yet.
          </div>
        )}
      </section>

      <section className="surface-card mt-6 p-5 sm:p-7">
        <div className="mb-5">
          <h2 className="font-bold text-slate-900">Habit performance</h2>
          <p className="mt-1 text-sm text-slate-500">
            Completion rates are measured against each habit's scheduled days over the last 30 days.
          </p>
        </div>
        {isLoading ? (
          <div className="grid h-72 place-items-center text-sm text-slate-500" role="status">
            Loading habit performance...
          </div>
        ) : activeHabits.length ? (
          <div className="h-72 w-full" role="img" aria-label="Habit completion rates chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeHabits}
                layout="vertical"
                margin={{ top: 8, right: 24, bottom: 4, left: 12 }}
              >
                <CartesianGrid stroke="#e8ece8" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  unit="%"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                />
                <Tooltip formatter={(value) => [`${value}%`, "Completion rate"]} />
                <Bar dataKey="completionRate" fill="#6ba77b" radius={[0, 6, 6, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="grid h-72 place-items-center text-sm text-slate-500">
            Create a habit to see its performance here.
          </div>
        )}
      </section>
    </>
  );
}
