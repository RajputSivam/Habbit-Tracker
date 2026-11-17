import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios.js";
import HabitModal from "../components/HabitModal.jsx";
import HabitSuggestionsWizard from "../components/HabitSuggestionsWizard.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { getDateKeyInTimeZone, getWeekday } from "../utils/date.js";

const CONFETTI_COLORS = ["#39845a", "#f0a94c", "#e98674", "#7d9de8", "#bd88d1"];

function ProgressRing({ completed, total }) {
  const radius = 47;
  const circumference = 2 * Math.PI * radius;
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  const progressLength = (percentage / 100) * circumference;

  return (
    <div
      className="relative grid h-32 w-32 shrink-0 place-items-center"
      role="img"
      aria-label={`${completed} of ${total} habits completed today`}
    >
      <svg
        className="h-full w-full -rotate-90"
        viewBox="0 0 112 112"
        role="presentation"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="56" cy="56" r={radius} fill="none" stroke="#e8eee9" strokeWidth="8" />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="#39845a"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progressLength} ${circumference}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-bold text-slate-900">{percentage}%</p>
        <p className="text-xs text-slate-500">
          {completed}/{total} done
        </p>
      </div>
    </div>
  );
}

function ConfettiBurst({ onDone }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1200);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  const pieces = Array.from({ length: 20 }, (_, index) => {
    const angle = (2 * Math.PI * index) / 20;
    const distance = 42 + (index % 4) * 12;

    return {
      id: index,
      style: {
        "--x": `${Math.cos(angle) * distance}px`,
        "--y": `${Math.sin(angle) * distance - 18}px`,
        "--delay": `${(index % 5) * 18}ms`,
        "--color": CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        "--rotation": `${(index * 71) % 360}deg`,
      },
    };
  });

  return (
    <div className="confetti-burst" aria-hidden="true">
      {pieces.map((piece) => (
        <span key={piece.id} className="confetti-piece" style={piece.style} />
      ))}
    </div>
  );
}

function HabitCard({
  habit,
  checked,
  streak,
  pending,
  onToggle,
  celebration,
  onCelebrationEnd,
  menuOpen,
  onMenuToggle,
  onEdit,
  onArchive,
  onDelete,
}) {
  return (
    <article
      className={`relative flex flex-col gap-4 overflow-visible rounded-2xl border p-4 transition sm:flex-row sm:items-center sm:justify-between ${
        checked ? "border-grove-100 bg-grove-50/70" : "border-stone-200 bg-white"
      }`}
    >
      {celebration && (
        <ConfettiBurst key={celebration} onDone={onCelebrationEnd} />
      )}
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-bold text-white"
          style={{ backgroundColor: habit.color || "#39845a" }}
          aria-hidden="true"
        >
          {habit.icon || habit.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">{habit.name}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {streak?.currentStreak || 0} day current streak
            <span className="mx-1.5 text-stone-300">·</span>
            {streak?.longestStreak || 0} day best
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 sm:shrink-0">
        <button
          type="button"
          className={`inline-flex min-w-32 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
            checked
              ? "bg-grove-100 text-grove-700 hover:bg-grove-200"
              : "bg-grove-600 text-white hover:bg-grove-700"
          }`}
          onClick={() => onToggle(habit)}
          disabled={pending}
          aria-pressed={checked}
        >
          {pending ? "Saving..." : checked ? "Completed" : "Check off"}
        </button>
        <div className="relative">
          <button
            type="button"
            className="button-quiet grid h-10 w-10 place-items-center p-0 text-xl"
            aria-label={`Actions for ${habit.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => onMenuToggle(habit._id)}
          >
            <span aria-hidden="true">⋯</span>
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full z-30 mt-2 w-40 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-soft"
              role="menu"
              aria-label={`${habit.name} actions`}
              onKeyDown={(event) => {
                if (event.key === "Escape") onMenuToggle(null);
              }}
            >
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"
                role="menuitem"
                onClick={() => onEdit(habit)}
              >
                Edit
              </button>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"
                role="menuitem"
                onClick={() => onArchive(habit)}
              >
                Archive
              </button>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                role="menuitem"
                onClick={() => onDelete(habit)}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Dashboard() {
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );
  const today = getDateKeyInTimeZone(new Date(), timeZone);
  const todayWeekday = getWeekday(today);
  const [habits, setHabits] = useState([]);
  const [checkedHabitIds, setCheckedHabitIds] = useState(() => new Set());
  const [streaks, setStreaks] = useState({});
  const [pendingHabitIds, setPendingHabitIds] = useState(() => new Set());
  const [celebration, setCelebration] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [actionError, setActionError] = useState("");
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const { success, error: showError } = useToast();

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setPageError("");

    try {
      const [habitsResponse, weeklyResponse, performanceResponse] = await Promise.all([
        api.get("/habits"),
        api.get("/analytics/weekly-grid", {
          params: { timezone: timeZone, weekOf: today },
        }),
        api.get("/analytics/habit-performance", {
          params: { timezone: timeZone },
        }),
      ]);

      const todayGrid = weeklyResponse.data.days.find((day) => day.date === today);
      setHabits(habitsResponse.data.habits);
      setCheckedHabitIds(new Set(todayGrid?.completedHabitIds || []));
      setStreaks(
        Object.fromEntries(
          performanceResponse.data.habits.map((habit) => [habit.id, habit])
        )
      );
    } catch (error) {
      setPageError(
        error.response?.data?.message ||
          "Could not load your dashboard. Check your connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [timeZone, today]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const activeHabits = habits.filter((habit) => !habit.isArchived);
  const todaysHabits = activeHabits.filter((habit) =>
    habit.targetDays?.includes(todayWeekday)
  );
  const completedCount = todaysHabits.filter((habit) =>
    checkedHabitIds.has(String(habit._id))
  ).length;
  const currentStreak = Math.max(
    0,
    ...activeHabits.map((habit) => streaks[String(habit._id)]?.currentStreak || 0)
  );
  const longestStreak = Math.max(
    0,
    ...activeHabits.map((habit) => streaks[String(habit._id)]?.longestStreak || 0)
  );

  const handleToggle = useCallback(
    async (habit) => {
      const habitId = String(habit._id);
      setPendingHabitIds((previous) => new Set(previous).add(habitId));
      setActionError("");

      try {
        const { data } = await api.post(`/habits/${habitId}/check-in`, {
          date: today,
          timezone: timeZone,
        });

        setCheckedHabitIds((previous) => {
          const next = new Set(previous);
          if (data.checkedIn) next.add(habitId);
          else next.delete(habitId);
          return next;
        });
        setStreaks((previous) => ({
          ...previous,
          [habitId]: {
            ...previous[habitId],
            ...data.streaks,
          },
        }));

        if (data.checkedIn) {
          setCelebration({ habitId, key: `${habitId}-${Date.now()}` });
        } else {
          setCelebration(null);
        }
      } catch (error) {
        setActionError(
          error.response?.data?.message ||
            "Could not update this check-in. Please try again."
        );
      } finally {
        setPendingHabitIds((previous) => {
          const next = new Set(previous);
          next.delete(habitId);
          return next;
        });
      }
    },
    [timeZone, today]
  );

  const clearCelebration = useCallback(() => setCelebration(null), []);

  function openCreateModal() {
    setEditingHabit(null);
    setHabitModalOpen(true);
  }

  function openEditModal(habit) {
    setOpenMenuId(null);
    setEditingHabit(habit);
    setHabitModalOpen(true);
  }

  async function handleArchive(habit) {
    setOpenMenuId(null);
    try {
      const { data } = await api.patch(`/habits/${habit._id}/archive`);
      success(data.habit.isArchived ? "Habit archived" : "Habit restored");
      await loadDashboard();
    } catch (error) {
      showError(
        error.response?.data?.message || "Could not update this habit. Please try again."
      );
    }
  }

  async function handleDelete(habit) {
    setOpenMenuId(null);
    const confirmed = window.confirm(
      `Delete "${habit.name}" and all of its check-ins? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/habits/${habit._id}`);
      success("Habit deleted");
      await loadDashboard();
    } catch (error) {
      showError(error.response?.data?.message || "Could not delete this habit. Please try again.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Your overview"
        title="Dashboard"
        description="A calm place to see today's progress and keep your routines moving."
        actions={
          <>
            <button type="button" className="button-primary" onClick={openCreateModal}>
              + New habit
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setSuggestionsOpen(true)}
            >
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
                <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
              </svg>
              Suggest a habit
            </button>
          </>
        }
      />

      <section className="surface-card mb-6 flex flex-col items-center gap-5 p-5 sm:flex-row sm:justify-between sm:p-7">
        <div className="text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-grove-600">
            Today's progress
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">
            {completedCount === todaysHabits.length && todaysHabits.length > 0
              ? "A lovely bit of progress."
              : "Every small step counts."}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {todaysHabits.length
              ? `${completedCount} of ${todaysHabits.length} planned habits complete`
              : "No habits are scheduled for today."}
          </p>
        </div>
        <ProgressRing completed={completedCount} total={todaysHabits.length} />
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <article className="surface-card p-5">
          <p className="text-sm font-medium text-slate-500">Best current streak</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{currentStreak} days</p>
          <p className="mt-1 text-xs text-slate-500">Across your active habits</p>
        </article>
        <article className="surface-card p-5">
          <p className="text-sm font-medium text-slate-500">Longest streak</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{longestStreak} days</p>
          <p className="mt-1 text-xs text-slate-500">Your best run so far</p>
        </article>
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Today's habits</h2>
            <p className="mt-1 text-sm text-slate-500">
              {new Intl.DateTimeFormat(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                timeZone,
              }).format(new Date())}
            </p>
          </div>
          <Link to="/weekly" className="text-sm font-semibold text-grove-700 hover:text-grove-900">
            Weekly grid
          </Link>
        </div>

        {actionError && (
          <p className="form-error mb-4" role="alert">
            {actionError}
          </p>
        )}

        {isLoading ? (
          <div className="surface-card p-6 text-sm text-slate-500" role="status">
            Loading your habits...
          </div>
        ) : pageError ? (
          <div className="surface-card flex flex-col items-start gap-4 p-6">
            <p className="form-error w-full" role="alert">{pageError}</p>
            <button type="button" className="button-secondary" onClick={loadDashboard}>
              Try again
            </button>
          </div>
        ) : todaysHabits.length === 0 ? (
          <div className="surface-card p-7 text-center">
            <p className="font-semibold text-slate-800">
              {activeHabits.length ? "A lighter day on your schedule." : "Your habits will grow here."}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {activeHabits.length
                ? "You don't have any habits planned for today. Check the weekly grid to see what's coming up."
                : "Create your first habit to start building a routine."}
            </p>
            {activeHabits.length === 0 ? (
              <>
                <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                  <button type="button" className="button-primary" onClick={openCreateModal}>
                    Create your first habit
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setSuggestionsOpen(true)}
                  >
                    Get AI suggestions
                  </button>
                </div>
                <Link
                  to="/weekly"
                  className="mt-4 inline-block text-sm font-semibold text-grove-700 hover:text-grove-900"
                >
                  View weekly grid
                </Link>
              </>
            ) : (
              <Link
                to="/weekly"
                className="mt-4 inline-block text-sm font-semibold text-grove-700 hover:text-grove-900"
              >
                View weekly grid
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {todaysHabits.map((habit) => {
              const habitId = String(habit._id);
              return (
                <HabitCard
                  key={habitId}
                  habit={habit}
                  checked={checkedHabitIds.has(habitId)}
                  streak={streaks[habitId]}
                  pending={pendingHabitIds.has(habitId)}
                  onToggle={handleToggle}
                  celebration={celebration?.habitId === habitId ? celebration.key : null}
                  onCelebrationEnd={clearCelebration}
                  menuOpen={openMenuId === habitId}
                  onMenuToggle={(id) => setOpenMenuId(id === openMenuId ? null : id)}
                  onEdit={openEditModal}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                />
              );
            })}
          </div>
        )}
      </section>
      <HabitModal
        open={habitModalOpen}
        onClose={() => setHabitModalOpen(false)}
        habit={editingHabit}
        onSaved={loadDashboard}
      />
      <HabitSuggestionsWizard
        open={suggestionsOpen}
        onClose={() => setSuggestionsOpen(false)}
        onHabitAdded={loadDashboard}
      />
    </>
  );
}
