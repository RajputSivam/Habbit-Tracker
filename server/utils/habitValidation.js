export const HABIT_CATEGORIES = Object.freeze([
  "Health",
  "Study",
  "Fitness",
  "Mindfulness",
  "Productivity",
  "Other",
]);

export const HABIT_FREQUENCIES = Object.freeze(["daily", "specific_days"]);

export const HABIT_COLORS = Object.freeze([
  "#39845a",
  "#f0a94c",
  "#e98674",
  "#7d9de8",
  "#bd88d1",
  "#2d9b8f",
  "#e76f51",
  "#64748b",
]);

export const HABIT_SOURCES = Object.freeze(["manual", "ai"]);
export const ALL_WEEKDAYS = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

const allowedFields = new Set([
  "name",
  "category",
  "frequency",
  "targetDays",
  "icon",
  "color",
  "source",
]);

const emojiPattern = /\p{Extended_Pictographic}/u;

export function isSingleEmoji(value) {
  if (typeof value !== "string" || !value.trim()) return false;

  const icon = value.trim();
  const segments = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(icon)];
  return (
    segments.length === 1 &&
    (emojiPattern.test(icon) ||
      /^\p{Regional_Indicator}{2}$/u.test(icon) ||
      /^[#*0-9]\uFE0F?\u20E3$/u.test(icon))
  );
}

function isValidTargetDays(days, allowEmpty) {
  return (
    Array.isArray(days) &&
    (allowEmpty || days.length > 0) &&
    days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
    new Set(days).size === days.length
  );
}

function existingFrequency(frequency) {
  if (frequency === "daily") return "daily";
  if (frequency === "specific_days") return "specific_days";
  if (frequency === "weekly" || frequency === "custom") return "specific_days";
  return undefined;
}

export function validateHabitInput(input, { partial = false, currentValues = {} } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Request body must be an object" };
  }

  const keys = Object.keys(input);
  if (keys.some((key) => !allowedFields.has(key))) {
    return { error: "Request contains an unsupported field" };
  }
  if (partial && keys.length === 0) {
    return { error: "Provide at least one field to update" };
  }

  const values = {};
  if (Object.hasOwn(input, "name")) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 60) {
      return { error: "name must be a non-empty string of at most 60 characters" };
    }
    values.name = input.name.trim();
  } else if (!partial) {
    return { error: "name is required" };
  }

  if (Object.hasOwn(input, "category")) {
    if (typeof input.category !== "string" || !HABIT_CATEGORIES.includes(input.category.trim())) {
      return { error: `category must be one of: ${HABIT_CATEGORIES.join(", ")}` };
    }
    values.category = input.category.trim();
  } else if (!partial) {
    values.category = "Other";
  }

  if (Object.hasOwn(input, "frequency")) {
    if (typeof input.frequency !== "string" || !HABIT_FREQUENCIES.includes(input.frequency)) {
      return { error: "frequency must be daily or specific_days" };
    }
    values.frequency = input.frequency;
  } else if (!partial) {
    values.frequency = "daily";
  }

  if (Object.hasOwn(input, "targetDays")) {
    const allowEmpty = (values.frequency || existingFrequency(currentValues.frequency)) === "daily";
    if (!isValidTargetDays(input.targetDays, allowEmpty)) {
      return {
        error: allowEmpty
          ? "targetDays must contain unique weekday numbers from 0 to 6"
          : "targetDays must contain at least one unique weekday number from 0 to 6",
      };
    }
    values.targetDays = input.targetDays;
  }

  const effectiveFrequency =
    values.frequency || existingFrequency(currentValues.frequency) || "daily";
  const effectiveTargetDays = values.targetDays ?? currentValues.targetDays ?? [];
  if (effectiveFrequency === "specific_days" && !isValidTargetDays(effectiveTargetDays, false)) {
    return { error: "targetDays must contain at least one unique weekday number from 0 to 6" };
  }
  if (
    partial &&
    !Object.hasOwn(input, "frequency") &&
    ["weekly", "custom"].includes(currentValues.frequency)
  ) {
    values.frequency = "specific_days";
  }
  if (effectiveFrequency === "daily") {
    values.targetDays = [...ALL_WEEKDAYS];
  }

  if (Object.hasOwn(input, "icon")) {
    if (!isSingleEmoji(input.icon)) {
      return { error: "icon must be a single emoji" };
    }
    values.icon = input.icon.trim();
  } else if (!partial) {
    values.icon = "✨";
  }

  if (Object.hasOwn(input, "color")) {
    if (typeof input.color !== "string" || !HABIT_COLORS.includes(input.color.toLowerCase())) {
      return { error: `color must be one of: ${HABIT_COLORS.join(", ")}` };
    }
    values.color = input.color.toLowerCase();
  } else if (!partial) {
    values.color = HABIT_COLORS[0];
  }

  if (Object.hasOwn(input, "source")) {
    if (typeof input.source !== "string" || !HABIT_SOURCES.includes(input.source)) {
      return { error: "source must be manual or ai" };
    }
    values.source = input.source;
  } else if (!partial) {
    values.source = "manual";
  }

  return { values };
}
