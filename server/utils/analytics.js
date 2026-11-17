import { calculateStreaks, getDateKeyInTimeZone } from "./streak.js";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateKey, amount) {
  const [year, month, day] = dateKey.split("-").map(Number);
  // Date keys are calendar labels; UTC arithmetic avoids host timezone and DST shifts.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day + amount);
  return formatDateKey(date);
}

function dayNumber(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime() / DAY_IN_MILLISECONDS;
}

export function getWeekday(dateKey) {
  return new Date(dayNumber(dateKey) * DAY_IN_MILLISECONDS).getUTCDay();
}

export function startOfWeek(dateKey) {
  return addDays(dateKey, -getWeekday(dateKey));
}

function dateKeysBetween(startDate, endDate) {
  const dates = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function completionDate(record) {
  return typeof record === "string" ? record : record.date;
}

function habitId(habit) {
  return String(habit._id ?? habit.id);
}

function countInRange(dates, startDate, endDate) {
  return dates.filter((date) => date >= startDate && date <= endDate).length;
}

export function buildHeatmap(completionDates, today) {
  const from = addDays(today, -89);
  const counts = new Map();
  for (const record of completionDates) {
    const date = completionDate(record);
    counts.set(date, (counts.get(date) || 0) + 1);
  }

  return {
    from,
    to: today,
    days: dateKeysBetween(from, today).map((date) => ({
      date,
      count: counts.get(date) || 0,
    })),
  };
}

export function buildWeeklyGrid(habits, completions, weekStart) {
  const weekEnd = addDays(weekStart, 6);
  const completedByDate = new Map();
  for (const completion of completions) {
    const ids = completedByDate.get(completion.date) || new Set();
    ids.add(String(completion.habit));
    completedByDate.set(completion.date, ids);
  }

  return {
    weekStart,
    weekEnd,
    habits: habits.map((habit) => ({
      id: habitId(habit),
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      isArchived: habit.isArchived,
    })),
    days: dateKeysBetween(weekStart, weekEnd).map((date) => ({
      date,
      weekday: getWeekday(date),
      completedHabitIds: [...(completedByDate.get(date) || [])],
    })),
  };
}

export function buildWeekOverWeekComparison(completionDates, today) {
  const currentStart = startOfWeek(today);
  const currentEnd = today;
  const previousStart = addDays(currentStart, -7);
  const previousEnd = addDays(currentEnd, -7);
  const dates = completionDates.map(completionDate);
  const currentCount = countInRange(dates, currentStart, currentEnd);
  const previousCount = countInRange(dates, previousStart, previousEnd);

  return {
    currentWeek: {
      from: currentStart,
      to: currentEnd,
      completionCount: currentCount,
    },
    previousWeek: {
      from: previousStart,
      to: previousEnd,
      completionCount: previousCount,
    },
    change: currentCount - previousCount,
    percentageChange:
      previousCount === 0
        ? currentCount === 0
          ? 0
          : null
        : Math.round(((currentCount - previousCount) / previousCount) * 10000) / 100,
  };
}

function shiftMonth(dateKey, amount) {
  const [year, month] = dateKey.split("-").map(Number);
  const monthIndex = year * 12 + month - 1 + amount;
  const shiftedYear = Math.floor(monthIndex / 12);
  const shiftedMonth = (monthIndex % 12) + 1;
  return `${String(shiftedYear).padStart(4, "0")}-${String(shiftedMonth).padStart(2, "0")}-01`;
}

export function buildMonthlyCounts(completionDates, today) {
  const currentMonth = `${today.slice(0, 7)}-01`;
  const firstMonth = shiftMonth(currentMonth, -11);
  const counts = new Map();

  for (let offset = 0; offset < 12; offset += 1) {
    const month = shiftMonth(firstMonth, offset).slice(0, 7);
    counts.set(month, 0);
  }
  for (const date of completionDates) {
    const completionDay = completionDate(date);
    const month = completionDay.slice(0, 7);
    if (counts.has(month) && completionDay <= today) {
      counts.set(month, counts.get(month) + 1);
    }
  }

  return {
    from: firstMonth,
    to: today,
    months: [...counts].map(([month, completionCount]) => ({
      month,
      completionCount,
    })),
  };
}

export function buildHabitPerformance(
  habits,
  completions,
  from,
  to,
  timeZone,
  now = new Date()
) {
  const completionsByHabit = new Map();
  const streakDatesByHabit = new Map();
  for (const completion of completions) {
    const id = String(completion.habit);
    const dates = completionsByHabit.get(id) || [];
    if (completion.date >= from && completion.date <= to) {
      dates.push(completion.date);
    }
    completionsByHabit.set(id, dates);

    const streakDates = streakDatesByHabit.get(id) || [];
    streakDates.push(completion.date);
    streakDatesByHabit.set(id, streakDates);
  }

  const results = habits.map((habit) => {
    const id = habitId(habit);
    const dates = completionsByHabit.get(id) || [];
    const streaks = calculateStreaks(
      streakDatesByHabit.get(id) || [],
      timeZone,
      now
    );
    const createdDate = habit.createdAt
      ? getDateKeyInTimeZone(habit.createdAt, timeZone)
      : from;
    const activeFrom = createdDate > from ? createdDate : from;
    const targetDays = new Set(habit.targetDays || []);
    let scheduledDays = 0;
    let scheduledCompletions = 0;

    if (activeFrom <= to) {
      for (const date of dateKeysBetween(activeFrom, to)) {
        if (targetDays.has(getWeekday(date))) {
          scheduledDays += 1;
          if (dates.includes(date)) {
            scheduledCompletions += 1;
          }
        }
      }
    }

    return {
      id,
      name: habit.name,
      category: habit.category,
      frequency: habit.frequency,
      isArchived: habit.isArchived,
      completionCount: dates.length,
      scheduledDays,
      scheduledCompletions,
      completionRate:
        scheduledDays === 0
          ? 0
          : Math.round((scheduledCompletions / scheduledDays) * 10000) / 100,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
    };
  });

  return { from, to, habits: results };
}
