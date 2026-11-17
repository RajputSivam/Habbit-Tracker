import mongoose from "mongoose";
import Completion from "../models/Completion.js";
import Habit from "../models/Habit.js";
import { ALL_WEEKDAYS, validateHabitInput } from "../utils/habitValidation.js";

function invalidHabitId(id) {
  return !mongoose.isObjectIdOrHexString(id);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findActiveHabitWithName(userId, name, excludeId) {
  const filter = {
    user: userId,
    isArchived: false,
    name: new RegExp(`^${escapeRegExp(name)}$`, "i"),
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return Habit.exists(filter);
}

function currentHabitValues(habit) {
  return {
    name: habit.name,
    category: habit.category,
    frequency: habit.frequency,
    targetDays: habit.targetDays,
    icon: habit.icon,
    color: habit.color,
    source: habit.source,
  };
}

function handleHabitError(error, res, next) {
  if (error.code === 11000) {
    return res.status(409).json({ message: "An active habit with this name already exists" });
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: "Habit data is invalid" });
  }
  return next(error);
}

export async function listHabits(req, res, next) {
  try {
    if (req.query.archived !== undefined && !["true", "false"].includes(req.query.archived)) {
      return res.status(400).json({ message: "archived must be true or false" });
    }

    const habits = await Habit.find({
      user: req.user.id,
      isArchived: req.query.archived === "true",
    }).sort({ createdAt: -1 });
    return res.json({ habits });
  } catch (error) {
    return next(error);
  }
}

export async function createHabit(req, res, next) {
  try {
    const { values, error } = validateHabitInput(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    if (await findActiveHabitWithName(req.user.id, values.name)) {
      return res.status(409).json({ message: "An active habit with this name already exists" });
    }

    const activeCount = await Habit.countDocuments({
      user: req.user.id,
      isArchived: false,
    });
    if (activeCount >= 30) {
      return res.status(409).json({ message: "You can have at most 30 active habits" });
    }

    const habit = await Habit.create({
      ...values,
      targetDays:
        values.frequency === "daily" ? [...ALL_WEEKDAYS] : values.targetDays,
      user: req.user.id,
    });
    return res.status(201).json({ habit });
  } catch (error) {
    return handleHabitError(error, res, next);
  }
}

export async function getHabit(req, res, next) {
  try {
    if (invalidHabitId(req.params.id)) {
      return res.status(400).json({ message: "Invalid habit ID" });
    }

    const habit = await Habit.findOne({ _id: req.params.id, user: req.user.id });
    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    return res.json({ habit });
  } catch (error) {
    return next(error);
  }
}

export async function updateHabit(req, res, next) {
  try {
    if (invalidHabitId(req.params.id)) {
      return res.status(400).json({ message: "Invalid habit ID" });
    }

    const existingHabit = await Habit.findOne({
      _id: req.params.id,
      user: req.user.id,
    });
    if (!existingHabit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    const partial = req.method !== "PUT";
    let input = req.body;
    if (
      !partial &&
      input &&
      typeof input === "object" &&
      !Array.isArray(input) &&
      !Object.hasOwn(input, "source")
    ) {
      input = { ...input, source: existingHabit.source || "manual" };
    }

    const { values, error } = validateHabitInput(input, {
      partial,
      currentValues: currentHabitValues(existingHabit),
    });
    if (error) {
      return res.status(400).json({ message: error });
    }

    const nextName = values.name ?? existingHabit.name;
    if (
      !existingHabit.isArchived &&
      (await findActiveHabitWithName(req.user.id, nextName, existingHabit._id))
    ) {
      return res.status(409).json({ message: "An active habit with this name already exists" });
    }

    const updateValues = {
      ...values,
      ...(values.frequency === "daily" ? { targetDays: [...ALL_WEEKDAYS] } : {}),
    };
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: updateValues },
      { new: true, runValidators: true }
    );
    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    return res.json({ habit });
  } catch (error) {
    return handleHabitError(error, res, next);
  }
}

export async function toggleHabitArchive(req, res, next) {
  try {
    if (invalidHabitId(req.params.id)) {
      return res.status(400).json({ message: "Invalid habit ID" });
    }

    const habit = await Habit.findOne({ _id: req.params.id, user: req.user.id });
    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    if (habit.isArchived) {
      const activeCount = await Habit.countDocuments({
        user: req.user.id,
        isArchived: false,
      });
      if (activeCount >= 30) {
        return res.status(409).json({ message: "You can have at most 30 active habits" });
      }

      if (await findActiveHabitWithName(req.user.id, habit.name, habit._id)) {
        return res.status(409).json({ message: "An active habit with this name already exists" });
      }
    }

    const updatedHabit = await Habit.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id, isArchived: habit.isArchived },
      { $set: { isArchived: !habit.isArchived } },
      { new: true }
    );
    if (!updatedHabit) {
      return res.status(409).json({ message: "Habit changed while being archived; please retry" });
    }

    return res.json({ habit: updatedHabit });
  } catch (error) {
    return handleHabitError(error, res, next);
  }
}

export async function deleteHabit(req, res, next) {
  try {
    if (invalidHabitId(req.params.id)) {
      return res.status(400).json({ message: "Invalid habit ID" });
    }

    const habit = await Habit.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).select("_id");
    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    await Completion.deleteMany({
      habit: habit._id,
      user: req.user.id,
    });
    const result = await Habit.deleteOne({
      _id: habit._id,
      user: req.user.id,
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Habit not found" });
    }

    return res.json({ message: "Habit deleted" });
  } catch (error) {
    return handleHabitError(error, res, next);
  }
}
