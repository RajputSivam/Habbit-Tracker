import mongoose from "mongoose";
import {
  HABIT_CATEGORIES,
  HABIT_COLORS,
  HABIT_FREQUENCIES,
  HABIT_SOURCES,
  isSingleEmoji,
} from "../utils/habitValidation.js";

const habitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 60,
    },
    category: {
      type: String,
      enum: HABIT_CATEGORIES,
      default: "Other",
    },
    frequency: {
      type: String,
      enum: HABIT_FREQUENCIES,
      default: "daily",
    },
    targetDays: {
      // Weekday numbers follow JavaScript's convention: Sunday is 0 and Saturday is 6.
      type: [Number],
      default: [],
      validate: {
        validator(days) {
          const validDays =
            Array.isArray(days) &&
            days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
            new Set(days).size === days.length;
          return validDays && (this.frequency === "daily" || days.length > 0);
        },
        message: "specific_days habits need unique targetDays from 0 to 6",
      },
    },
    icon: {
      type: String,
      trim: true,
      default: "✨",
      maxlength: 32,
      validate: {
        validator: isSingleEmoji,
        message: "icon must be a single emoji",
      },
    },
    color: {
      type: String,
      lowercase: true,
      enum: HABIT_COLORS,
      default: HABIT_COLORS[0],
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      enum: HABIT_SOURCES,
      default: "manual",
    },
  },
  { timestamps: true }
);

const Habit = mongoose.model("Habit", habitSchema);

export default Habit;
