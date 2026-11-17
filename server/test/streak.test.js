import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateStreaks,
  getMostRecentBrokenStreak,
  getDateKeyInTimeZone,
  isValidDateKey,
} from "../utils/streak.js";

test("returns zero streaks when there are no completions", () => {
  assert.deepEqual(
    calculateStreaks([], "UTC", new Date("2024-05-10T12:00:00Z")),
    { currentStreak: 0, longestStreak: 0 }
  );
});

test("counts contiguous dates, ignoring duplicates and input order", () => {
  assert.deepEqual(
    calculateStreaks(
      ["2024-05-08", "2024-05-06", "2024-05-07", "2024-05-07"],
      "UTC",
      new Date("2024-05-08T12:00:00Z")
    ),
    { currentStreak: 3, longestStreak: 3 }
  );
});

test("keeps yesterday's streak active through today but breaks after a missed day", () => {
  const now = new Date("2024-05-10T12:00:00Z");

  assert.deepEqual(
    calculateStreaks(["2024-05-08", "2024-05-09"], "UTC", now),
    { currentStreak: 2, longestStreak: 2 }
  );
  assert.deepEqual(
    calculateStreaks(["2024-05-07", "2024-05-08"], "UTC", now),
    { currentStreak: 0, longestStreak: 2 }
  );
});

test("uses the supplied timezone to determine today near midnight", () => {
  const now = new Date("2024-01-01T00:30:00Z");
  const dates = ["2023-12-30", "2023-12-31", "2024-01-01"];

  assert.deepEqual(calculateStreaks(dates, "America/Los_Angeles", now), {
    currentStreak: 2,
    longestStreak: 2,
  });
  assert.deepEqual(calculateStreaks(dates, "UTC", now), {
    currentStreak: 3,
    longestStreak: 3,
  });
});

test("calculates local dates across daylight-saving transitions", () => {
  const now = new Date("2024-03-11T12:00:00Z");

  assert.equal(getDateKeyInTimeZone(now, "America/New_York"), "2024-03-11");
  assert.deepEqual(
    calculateStreaks(
      ["2024-03-09", "2024-03-10", "2024-03-11"],
      "America/New_York",
      now
    ),
    { currentStreak: 3, longestStreak: 3 }
  );
});

test("validates calendar dates and rejects invalid timezones or completion dates", () => {
  assert.equal(isValidDateKey("2024-02-29"), true);
  assert.equal(isValidDateKey("2023-02-29"), false);
  assert.throws(
    () => calculateStreaks(["not-a-date"], "UTC", new Date("2024-01-01T00:00:00Z")),
    /valid YYYY-MM-DD/
  );
  assert.throws(
    () => calculateStreaks([], "Not/A-Timezone", new Date("2024-01-01T00:00:00Z")),
    /valid IANA timezone/
  );
});

test("identifies the most recent broken streak and leaves active streaks alone", () => {
  assert.deepEqual(
    getMostRecentBrokenStreak(
      [
        "2024-06-01",
        "2024-06-02",
        "2024-06-03",
        "2024-06-04",
        "2024-06-05",
        "2024-06-06",
        "2024-06-07",
      ],
      "UTC",
      new Date("2024-06-10T12:00:00Z")
    ),
    { length: 7, lastCompletedDate: "2024-06-07" }
  );
  assert.deepEqual(
    getMostRecentBrokenStreak(
      ["2024-06-01", "2024-06-02", "2024-06-03", "2024-06-04", "2024-06-05", "2024-06-06"],
      "UTC",
      new Date("2024-06-10T12:00:00Z")
    ),
    { length: 6, lastCompletedDate: "2024-06-06" }
  );
  assert.equal(
    getMostRecentBrokenStreak(
      ["2024-06-09"],
      "UTC",
      new Date("2024-06-10T12:00:00Z")
    ),
    null
  );
});
