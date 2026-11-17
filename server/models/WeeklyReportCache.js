import mongoose from "mongoose";
import { isValidDateKey } from "../utils/streak.js";

const weeklyReportCacheSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    weekStart: {
      type: String,
      required: true,
      validate: {
        validator: isValidDateKey,
        message: "weekStart must be a valid YYYY-MM-DD date",
      },
    },
    timezone: {
      type: String,
      required: true,
      maxlength: 100,
    },
    dataHash: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/,
    },
    report: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

weeklyReportCacheSchema.index(
  { user: 1, weekStart: 1, timezone: 1 },
  { unique: true }
);

const WeeklyReportCache = mongoose.model(
  "WeeklyReportCache",
  weeklyReportCacheSchema
);

export default WeeklyReportCache;
