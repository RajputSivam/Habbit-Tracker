import Completion from "../models/Completion.js";
import Habit from "../models/Habit.js";
import {
  addDays,
  buildHabitPerformance,
  buildHeatmap,
  buildMonthlyCounts,
  buildWeeklyGrid,
  buildWeekOverWeekComparison,
  startOfWeek,
} from "../utils/analytics.js";
import {
  getDateKeyInTimeZone,
  isValidDateKey,
  isValidTimeZone,
} from "../utils/streak.js";

function readTimezone(req, res) {
  const { timezone } = req.query;
  if (!isValidTimeZone(timezone)) {
    res.status(400).json({ message: "Provide a valid IANA timezone query parameter" });
    return null;
  }
  return timezone;
}

function dateRange(from, to) {
  return { $gte: from, $lte: to };
}

export async function getHeatmap(req, res, next) {
  try {
    const timezone = readTimezone(req, res);
    if (!timezone) return;

    const today = getDateKeyInTimeZone(new Date(), timezone);
    const from = addDays(today, -89);
    const completionDates = await Completion.find({
      user: req.user.id,
      date: dateRange(from, today),
    })
      .select("date -_id")
      .lean();

    return res.json({ timezone, ...buildHeatmap(completionDates, today) });
  } catch (error) {
    return next(error);
  }
}

export async function getWeeklyGrid(req, res, next) {
  try {
    const timezone = readTimezone(req, res);
    if (!timezone) return;

    const today = getDateKeyInTimeZone(new Date(), timezone);
    const weekOf = req.query.weekOf || today;
    if (!isValidDateKey(weekOf)) {
      return res.status(400).json({ message: "weekOf must be a valid YYYY-MM-DD date" });
    }

    const weekStart = startOfWeek(weekOf);
    const weekEnd = addDays(weekStart, 6);
    const [habits, completions] = await Promise.all([
      Habit.find({ user: req.user.id })
        .select("_id name icon color isArchived")
        .lean(),
      Completion.find({
        user: req.user.id,
        date: dateRange(weekStart, weekEnd),
      })
        .select("habit date -_id")
        .lean(),
    ]);

    return res.json({
      timezone,
      ...buildWeeklyGrid(habits, completions, weekStart),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getWeekOverWeek(req, res, next) {
  try {
    const timezone = readTimezone(req, res);
    if (!timezone) return;

    const today = getDateKeyInTimeZone(new Date(), timezone);
    const currentWeekStart = startOfWeek(today);
    const previousWeekStart = addDays(currentWeekStart, -7);
    const completionDates = await Completion.find({
      user: req.user.id,
      date: dateRange(previousWeekStart, today),
    })
      .select("date -_id")
      .lean();

    return res.json({
      timezone,
      ...buildWeekOverWeekComparison(completionDates, today),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getMonthlyCounts(req, res, next) {
  try {
    const timezone = readTimezone(req, res);
    if (!timezone) return;

    const today = getDateKeyInTimeZone(new Date(), timezone);
    const currentMonth = `${today.slice(0, 7)}-01`;
    const firstMonthDate = new Date(`${currentMonth}T00:00:00.000Z`);
    firstMonthDate.setUTCMonth(firstMonthDate.getUTCMonth() - 11);
    const firstMonth = firstMonthDate.toISOString().slice(0, 10);
    const completionDates = await Completion.find({
      user: req.user.id,
      date: dateRange(firstMonth, today),
    })
      .select("date -_id")
      .lean();

    return res.json({
      timezone,
      ...buildMonthlyCounts(completionDates, today),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getHabitPerformance(req, res, next) {
  try {
    const timezone = readTimezone(req, res);
    if (!timezone) return;

    const now = new Date();
    const today = getDateKeyInTimeZone(now, timezone);
    const from = addDays(today, -29);
    const [habits, completions] = await Promise.all([
      Habit.find({ user: req.user.id })
        .select("_id name category frequency targetDays isArchived createdAt")
        .lean(),
      Completion.find({
        user: req.user.id,
      })
        .select("habit date -_id")
        .lean(),
    ]);

    return res.json({
      timezone,
      ...buildHabitPerformance(habits, completions, from, today, timezone, now),
    });
  } catch (error) {
    return next(error);
  }
}
