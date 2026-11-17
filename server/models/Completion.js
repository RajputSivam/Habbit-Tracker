import mongoose from "mongoose";
import { isValidDateKey } from "../utils/streak.js";

const completionSchema = new mongoose.Schema(
  {
    habit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Habit",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      validate: {
        validator: isValidDateKey,
        message: "date must be a valid YYYY-MM-DD calendar date",
      },
    },
  },
  { timestamps: true }
);

completionSchema.index({ user: 1, habit: 1, date: 1 }, { unique: true });
completionSchema.index({ user: 1, date: 1 });

const Completion = mongoose.model("Completion", completionSchema);

export default Completion;
