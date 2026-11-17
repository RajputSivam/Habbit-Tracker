const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function isValidDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12) {
    return false;
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];

  return day >= 1 && day <= daysInMonth;
}

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone.trim() || timeZone.length > 100) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch (error) {
    if (error instanceof RangeError) {
      return false;
    }
    throw error;
  }
}

export function getDateKeyInTimeZone(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("now must be a valid date");
  }

  if (!isValidTimeZone(timeZone)) {
    throw new RangeError("timeZone must be a valid IANA timezone");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const partValues = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${partValues.year.padStart(4, "0")}-${partValues.month}-${partValues.day}`;
}

function dayNumber(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime() / DAY_IN_MILLISECONDS;
}

export function calculateStreaks(completionDates, timeZone, now = new Date()) {
  if (!Array.isArray(completionDates)) {
    throw new TypeError("completionDates must be an array of YYYY-MM-DD date keys");
  }

  const todayKey = getDateKeyInTimeZone(now, timeZone);
  const today = dayNumber(todayKey);
  const completedDays = new Set(
    completionDates.map((dateKey) => {
      if (!isValidDateKey(dateKey)) {
        throw new TypeError("completion dates must be valid YYYY-MM-DD date keys");
      }
      return dayNumber(dateKey);
    })
  );
  const pastAndCurrentDays = [...completedDays]
    .filter((day) => day <= today)
    .sort((a, b) => a - b);

  let longestStreak = 0;
  let runLength = 0;
  let previousDay;
  for (const day of pastAndCurrentDays) {
    runLength = day === previousDay + 1 ? runLength + 1 : 1;
    longestStreak = Math.max(longestStreak, runLength);
    previousDay = day;
  }

  const yesterday = today - 1;
  let currentStreak = 0;
  let currentDay = completedDays.has(today)
    ? today
    : completedDays.has(yesterday)
      ? yesterday
      : null;

  while (currentDay !== null && completedDays.has(currentDay)) {
    currentStreak += 1;
    currentDay -= 1;
  }

  return { currentStreak, longestStreak };
}

export function getMostRecentBrokenStreak(completionDates, timeZone, now = new Date()) {
  if (!Array.isArray(completionDates)) {
    throw new TypeError("completionDates must be an array of YYYY-MM-DD date keys");
  }

  const todayKey = getDateKeyInTimeZone(now, timeZone);
  const today = dayNumber(todayKey);
  const completedDays = new Set(
    completionDates.map((dateKey) => {
      if (!isValidDateKey(dateKey)) {
        throw new TypeError("completion dates must be valid YYYY-MM-DD date keys");
      }
      return dayNumber(dateKey);
    })
  );
  let lastCompletedDay = Number.NEGATIVE_INFINITY;
  for (const day of completedDays) {
    if (day <= today && day > lastCompletedDay) {
      lastCompletedDay = day;
    }
  }

  if (!Number.isFinite(lastCompletedDay) || lastCompletedDay >= today - 1) {
    return null;
  }

  let length = 0;
  let day = lastCompletedDay;
  while (completedDays.has(day)) {
    length += 1;
    day -= 1;
  }

  return {
    length,
    lastCompletedDate: new Date(lastCompletedDay * DAY_IN_MILLISECONDS)
      .toISOString()
      .slice(0, 10),
  };
}
