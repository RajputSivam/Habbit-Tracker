import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios.js";
import HabitModal from "../components/HabitModal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { getDateKeyInTimeZone, getWeekday } from "../utils/date.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function addDays(dateKey, amount) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day + amount);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(dateKey) {
  return addDays(dateKey, -getWeekday(dateKey));
}

function formatDate(dateKey) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

export default function WeeklyGrid() {
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );
  const today = getDateKeyInTimeZone(new Date(), timeZone);
  const currentWeekStart = startOfWeek(today);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [grid, setGrid] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [habitModalOpen, setHabitModalOpen] = useState(false);

  const loadGrid = useCallback(async (signal) => {
    setIsLoading(true);
    setPageError("");
    let wasCancelled = false;

    try {
      const { data } = await api.get("/analytics/weekly-grid", {
        params: { timezone: timeZone, weekOf: weekStart },
        signal,
      });
      setGrid(data);
    } catch (error) {
      wasCancelled = error.code === "ERR_CANCELED";
      if (!wasCancelled) {
        setPageError(
          error.response?.data?.message ||
            "Could not load your weekly grid. Check your connection and try again."
        );
      }
    } finally {
      if (!wasCancelled) {
        setIsLoading(false);
      }
    }
  }, [timeZone, weekStart]);

  useEffect(() => {
    const controller = new AbortController();
    loadGrid(controller.signal);
    return () => controller.abort();
  }, [loadGrid]);

  const weekEnd = addDays(weekStart, 6);
  const isCurrentWeek = weekStart === currentWeekStart;

  return (
    <>
      <PageHeader
        eyebrow="Your rhythm"
        title="Weekly grid"
        description="See your habits across the week and spot the patterns that are working."
        actions={
          <button
            type="button"
            className="button-primary"
            onClick={() => setHabitModalOpen(true)}
          >
            + New habit
          </button>
        }
      />
      <section className="surface-card overflow-hidden p-4 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            className="button-quiet"
            aria-label="Previous week"
            onClick={() => setWeekStart((date) => addDays(date, -7))}
          >
            ←
          </button>
          <p className="text-center text-sm font-semibold text-slate-700" aria-live="polite">
            {isCurrentWeek ? "This week" : `${formatDate(weekStart)} – ${formatDate(weekEnd)}`}
          </p>
          <button
            type="button"
            className="button-quiet"
            aria-label="Next week"
            disabled={isCurrentWeek}
            onClick={() => setWeekStart((date) => addDays(date, 7))}
          >
            →
          </button>
        </div>

        {isLoading ? (
          <div className="grid min-h-48 place-items-center text-sm text-slate-500" role="status">
            Loading your weekly grid…
          </div>
        ) : pageError ? (
          <div className="rounded-2xl bg-red-50 p-5 text-center">
            <p className="text-sm text-red-700" role="alert">{pageError}</p>
            <button type="button" className="button-quiet mt-2" onClick={loadGrid}>
              Try again
            </button>
          </div>
        ) : !grid?.habits.length ? (
          <div className="grid min-h-48 place-items-center rounded-2xl bg-stone-50 px-4 text-center text-sm text-slate-500">
            No habits to display yet. Add a habit to start building your weekly rhythm.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[680px] grid-cols-8 gap-2 text-center">
              <div />
              {grid.days.map((day) => (
                <div key={day.date} className="pb-2">
                  <p className="text-xs font-semibold text-slate-500">
                    {WEEKDAYS[day.weekday]}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{Number(day.date.slice(-2))}</p>
                </div>
              ))}
              {grid.habits.map((habit) => (
                <div key={habit.id} className="contents">
                  <div className="flex min-w-0 items-center gap-2 py-2 text-left">
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold text-white"
                      style={{ backgroundColor: habit.color || "#39845a" }}
                      aria-hidden="true"
                    >
                      {habit.icon || habit.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate text-sm font-medium text-slate-700">
                      {habit.name}
                    </span>
                  </div>
                  {grid.days.map((day) => {
                    const isComplete = day.completedHabitIds.includes(habit.id);
                    return (
                      <div key={`${habit.id}-${day.date}`} className="grid place-items-center py-2">
                        <span
                          className={`grid h-8 w-8 place-items-center rounded-xl text-sm font-bold ${
                            isComplete
                              ? "text-white"
                              : "bg-stone-50 text-slate-400"
                          }`}
                          style={isComplete ? { backgroundColor: habit.color || "#39845a" } : undefined}
                          role="img"
                          aria-label={`${habit.name}, ${day.date}: ${
                            isComplete ? "completed" : "not completed"
                          }`}
                        >
                          {isComplete ? "✓" : "·"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <HabitModal
        open={habitModalOpen}
        onClose={() => setHabitModalOpen(false)}
        onSaved={loadGrid}
      />
    </>
  );
}
