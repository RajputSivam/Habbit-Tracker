import mongoose from "mongoose";
import Completion from "../models/Completion.js";
import Habit from "../models/Habit.js";
import {
  calculateStreaks,
  getDateKeyInTimeZone,
  isValidDateKey,
  isValidTimeZone,
} from "../utils/streak.js";

export async function toggleCheckIn(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.habitId)) {
      return res.status(400).json({ message: "Invalid habit ID" });
    }

    const body = req.body || {};
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => !["date", "timezone"].includes(key)) ||
      !isValidDateKey(body.date) ||
      !isValidTimeZone(body.timezone)
    ) {
      return res.status(400).json({
        message: "Provide a valid YYYY-MM-DD date and IANA timezone",
      });
    }

    const today = getDateKeyInTimeZone(new Date(), body.timezone);
    if (body.date > today) {
      return res.status(400).json({ message: "Check-in date cannot be in the future" });
    }

    const habit = await Habit.exists({
      _id: req.params.habitId,
      user: req.user.id,
    });
    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    const filter = {
      habit: req.params.habitId,
      user: req.user.id,
      date: body.date,
    };
    const existing = await Completion.findOneAndDelete(filter);
    let checkedIn;
    let completion = null;

    if (existing) {
      checkedIn = false;
    } else {
      completion = await Completion.create(filter);
      checkedIn = true;
    }

    const completionDates = await Completion.distinct("date", {
      habit: req.params.habitId,
      user: req.user.id,
    });

    return res.json({
      checkedIn,
      completion,
      streaks: calculateStreaks(completionDates, body.timezone),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Check-in changed concurrently; please retry" });
    }
    return next(error);
  }
}
