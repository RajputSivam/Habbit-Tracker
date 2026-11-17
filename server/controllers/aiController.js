import { createHash } from "node:crypto";
import mongoose from "mongoose";
import Completion from "../models/Completion.js";
import Habit from "../models/Habit.js";
import WeeklyReportCache from "../models/WeeklyReportCache.js";
import {
  createHabitSuggestions,
  validateHabitSuggestionRequest,
} from "../services/habitSuggestionService.js";
import { generateJsonResponse } from "../services/geminiService.js";
import { addDays, getWeekday, startOfWeek } from "../utils/analytics.js";
import {
  calculateStreaks,
  getDateKeyInTimeZone,
  getMostRecentBrokenStreak,
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

function validateBody(req, res, allowedFields) {
  const body = req.body || {};
  if (
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !allowedFields.includes(key))
  ) {
    res.status(400).json({ message: "Request body contains invalid fields" });
    return null;
  }
  return body;
}

function userError(res, message) {
  return res.status(400).json({ message });
}

async function loadUserHabitData(userId, timeZone, now) {
  const today = getDateKeyInTimeZone(now, timeZone);
  const from = addDays(today, -89);
  const [habits, completions] = await Promise.all([
    Habit.find({ user: userId })
      .select("_id name category frequency targetDays isArchived createdAt")
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
    Completion.find({ user: userId })
      .select("habit date -_id")
      .sort({ date: 1, habit: 1 })
      .lean(),
  ]);
  const datesByHabit = new Map();
  for (const completion of completions) {
    const id = String(completion.habit);
    const dates = datesByHabit.get(id) || [];
    dates.push(completion.date);
    datesByHabit.set(id, dates);
  }

  return {
    asOf: today,
    timezone: timeZone,
    period: { from, to: today },
    habits: habits.map((habit) => {
      const id = String(habit._id);
      const dates = datesByHabit.get(id) || [];
      const streaks = calculateStreaks(dates, timeZone, now);

      return {
        name: habit.name,
        category: habit.category,
        frequency: habit.frequency,
        targetDays: habit.targetDays,
        isArchived: habit.isArchived,
        createdDate: habit.createdAt
          ? getDateKeyInTimeZone(habit.createdAt, timeZone)
          : null,
        recentCompletionDates: dates.filter((date) => date >= from && date <= today),
        currentStreak: streaks.currentStreak,
        longestStreak: streaks.longestStreak,
      };
    }),
  };
}

export async function getWeeklyReport(req, res, next) {
  try {
    const timezone = readTimezone(req, res);
    if (!timezone) return;

    const now = new Date();
    const snapshot = await loadUserHabitData(req.user.id, timezone, now);
    const weekStart = startOfWeek(snapshot.asOf);
    const reportData = {
      timezone,
      week: { start: weekStart },
      habits: snapshot.habits.map((habit) => ({
        ...habit,
        weekCompletionDates: habit.recentCompletionDates.filter(
          (date) => date >= weekStart
        ),
      })),
    };
    const dataHash = createHash("sha256")
      .update(JSON.stringify(reportData))
      .digest("hex");
    const cacheKey = {
      user: req.user.id,
      weekStart,
      timezone,
    };
    const cachedReport = await WeeklyReportCache.findOne(cacheKey).lean();

    if (cachedReport?.dataHash === dataHash) {
      return res.json({
        weekStart,
        report: cachedReport.report,
        cached: true,
      });
    }

    const report = await generateJsonResponse({
      task: "Write a concise weekly habit report. Identify real wins and one or two practical next-week adjustments.",
      responseSchema:
        '{"headline": string, "summary": string, "highlights": string[], "nextWeekFocus": string[]}',
      userHabitData: reportData,
    });

    try {
      await WeeklyReportCache.findOneAndUpdate(
        cacheKey,
        {
          $set: { dataHash, report, generatedAt: new Date() },
        },
        { new: true, upsert: true, runValidators: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      const concurrentCache = await WeeklyReportCache.findOne(cacheKey).lean();
      if (concurrentCache?.dataHash !== dataHash) throw error;
      return res.json({
        weekStart,
        report: concurrentCache.report,
        cached: true,
      });
    }

    return res.json({ weekStart, report, cached: false });
  } catch (error) {
    return next(error);
  }
}

export async function suggestHabits(req, res, next) {
  try {
    const timezone = readTimezone(req, res);
    if (!timezone) return;
    const body = validateBody(req, res, ["goal", "category", "availableDays"]);
    if (!body) return;

    if (
      body.goal !== undefined &&
      (typeof body.goal !== "string" || body.goal.length > 500)
    ) {
      return userError(res, "goal must be a string of at most 500 characters");
    }
    if (
      body.category !== undefined &&
      (typeof body.category !== "string" || body.category.length > 60)
    ) {
      return userError(res, "category must be a string of at most 60 characters");
    }
    if (
      body.availableDays !== undefined &&
      (!Array.isArray(body.availableDays) ||
        body.availableDays.some(
          (day) => !Number.isInteger(day) || day < 0 || day > 6
        ) ||
        new Set(body.availableDays).size !== body.availableDays.length)
    ) {
      return userError(res, "availableDays must contain unique weekday numbers from 0 to 6");
    }

    const userHabitData = await loadUserHabitData(req.user.id, timezone, new Date());
    const suggestions = await generateJsonResponse({
      task: "Suggest up to five specific, realistic habits that complement the user's existing routines. Do not repeat habits they already have.",
      responseSchema:
        '{"suggestions": [{"name": string, "category": string, "frequency": "daily" | "weekly" | "custom", "targetDays": number[], "reason": string}]}',
      userHabitData,
      requestContext: {
        goal: body.goal?.trim() || "",
        category: body.category?.trim() || "",
        availableDays: body.availableDays || [],
      },
    });

    return res.json(suggestions);
  } catch (error) {
    return next(error);
  }
}

export async function suggestHabitIdeas(req, res, next) {
  try {
    const { values, error } = validateHabitSuggestionRequest(req.body || {});
    if (error) return userError(res, error);

    const existingHabits = await Habit.find({ user: req.user.id })
      .select("name -_id")
      .lean();
    const suggestions = await createHabitSuggestions({
      ...values,
      existingHabitNames: existingHabits.map((habit) => habit.name),
    });

    return res.json({ suggestions });
  } catch (error) {
    return next(error);
  }
}

export async function getStreakRecoveryPlan(req, res, next) {
  try {
    const timezone = readTimezone(req, res);
    if (!timezone) return;
    const body = validateBody(req, res, ["habitId"]);
    if (!body) return;

    if (!mongoose.isValidObjectId(body.habitId)) {
      return userError(res, "habitId must be a valid ID");
    }

    const habit = await Habit.findOne({
      _id: body.habitId,
      user: req.user.id,
    })
      .select("_id name category frequency targetDays isArchived createdAt")
      .lean();
    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    const now = new Date();
    const today = getDateKeyInTimeZone(now, timezone);
    const completionDates = await Completion.distinct("date", {
      user: req.user.id,
      habit: habit._id,
    });
    const brokenStreak = getMostRecentBrokenStreak(
      completionDates,
      timezone,
      now
    );

    if (!brokenStreak || brokenStreak.length < 7) {
      return res.status(409).json({
        message: "A recovery plan is available after a broken streak of at least 7 days",
      });
    }

    const plan = await generateJsonResponse({
      task: "Create a compassionate, practical streak recovery plan. Do not pressure the user to compensate for missed days; suggest a gentle restart.",
      responseSchema:
        '{"encouragement": string, "smallSteps": string[], "restartPlan": [{"day": string, "action": string}]}',
      userHabitData: {
        timezone,
        asOf: today,
        habit: {
          name: habit.name,
          category: habit.category,
          frequency: habit.frequency,
          targetDays: habit.targetDays,
          isArchived: habit.isArchived,
        },
        brokenStreak,
        recentCompletionDates: completionDates.filter(
          (date) => date >= addDays(today, -89) && date <= today
        ),
      },
    });

    return res.json({ plan, brokenStreak });
  } catch (error) {
    return next(error);
  }
}

export async function chatAboutHabits(req, res, next) {
  try {
    const timezone = readTimezone(req, res);
    if (!timezone) return;
    const body = validateBody(req, res, ["message", "history"]);
    if (!body) return;

    if (
      typeof body.message !== "string" ||
      !body.message.trim() ||
      body.message.length > 2000
    ) {
      return userError(res, "message must be a non-empty string of at most 2000 characters");
    }

    const history = body.history || [];
    if (
      !Array.isArray(history) ||
      history.length > 12 ||
      history.some(
        (message) =>
          !message ||
          !["user", "assistant"].includes(message.role) ||
          typeof message.content !== "string" ||
          !message.content.trim() ||
          message.content.length > 1000
      )
    ) {
      return userError(res, "history must contain up to 12 user or assistant messages");
    }

    const userHabitData = await loadUserHabitData(req.user.id, timezone, new Date());
    const response = await generateJsonResponse({
      task: "Answer the user's habit-related question using their actual data. Be concise, supportive, and clear when information is insufficient.",
      responseSchema: '{"reply": string, "followUpQuestions": string[]}',
      userHabitData,
      requestContext: {
        history: history.map(({ role, content }) => ({
          role,
          content: content.trim(),
        })),
        message: body.message.trim(),
      },
    });

    return res.json(response);
  } catch (error) {
    return next(error);
  }
}

export async function getMorningMotivation(req, res, next) {
  try {
    const timezone = readTimezone(req, res);
    if (!timezone) return;

    const now = new Date();
    const userHabitData = await loadUserHabitData(req.user.id, timezone, now);
    const todayWeekday = getWeekday(userHabitData.asOf);
    const todayHabits = userHabitData.habits
      .filter(
        (habit) =>
          !habit.isArchived && (habit.targetDays || []).includes(todayWeekday)
      )
      .map((habit) => ({
        name: habit.name,
        category: habit.category,
        currentStreak: habit.currentStreak,
        completedToday: habit.recentCompletionDates.includes(userHabitData.asOf),
      }));
    const motivation = await generateJsonResponse({
      task: "Write one warm, specific morning motivation message based on today's habits. Keep it brief and avoid guilt or pressure.",
      responseSchema: '{"message": string}',
      userHabitData: {
        date: userHabitData.asOf,
        timezone,
        habits: todayHabits,
      },
    });

    return res.json(motivation);
  } catch (error) {
    return next(error);
  }
}
