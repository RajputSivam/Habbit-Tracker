import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHabitPerformance,
  buildHeatmap,
  buildMonthlyCounts,
  buildWeeklyGrid,
  buildWeekOverWeekComparison,
} from "../utils/analytics.js";

test("builds a 90-day heatmap including zero-count days and today", () => {
  const heatmap = buildHeatmap(["2024-02-29", "2024-02-29"], "2024-03-01");

  assert.equal(heatmap.days.length, 90);
  assert.equal(heatmap.days[0].date, heatmap.from);
  assert.equal(heatmap.days.at(-1).date, "2024-03-01");
  assert.equal(heatmap.days.find((day) => day.date === "2024-02-29").count, 2);
  assert.equal(heatmap.days.find((day) => day.date === "2024-02-28").count, 0);
});

test("builds Sunday-to-Saturday weekly grid and groups check-ins by habit", () => {
  const grid = buildWeeklyGrid(
    [{ _id: "habit-1", name: "Read", isArchived: false }],
    [{ habit: "habit-1", date: "2024-05-08" }],
    "2024-05-05"
  );

  assert.equal(grid.days.length, 7);
  assert.equal(grid.days[0].weekday, 0);
  assert.deepEqual(grid.days[3].completedHabitIds, ["habit-1"]);
  assert.deepEqual(grid.days[2].completedHabitIds, []);
});

test("compares the current week-to-date with the same weekdays last week", () => {
  const comparison = buildWeekOverWeekComparison(
    [
      "2024-04-28",
      "2024-04-30",
      "2024-05-01",
      "2024-05-05",
      "2024-05-08",
      "2024-05-10",
    ],
    "2024-05-08"
  );

  assert.deepEqual(comparison.currentWeek, {
    from: "2024-05-05",
    to: "2024-05-08",
    completionCount: 2,
  });
  assert.deepEqual(comparison.previousWeek, {
    from: "2024-04-28",
    to: "2024-05-01",
    completionCount: 3,
  });
  assert.equal(comparison.change, -1);
  assert.equal(comparison.percentageChange, -33.33);
});

test("returns twelve monthly buckets including zero-count months", () => {
  const result = buildMonthlyCounts(
    ["2023-06-12", "2024-05-01", "2024-05-15"],
    "2024-05-14"
  );

  assert.equal(result.months.length, 12);
  assert.equal(result.months[0].month, "2023-06");
  assert.equal(result.months[0].completionCount, 1);
  assert.equal(result.months.at(-1).month, "2024-05");
  assert.equal(result.months.at(-1).completionCount, 1);
});

test("calculates habit performance against scheduled days after creation", () => {
  const result = buildHabitPerformance(
    [
      {
        _id: "habit-1",
        name: "Exercise",
        category: "Health",
        frequency: "custom",
        targetDays: [1, 5],
        isArchived: false,
        createdAt: new Date("2024-05-02T10:00:00Z"),
      },
    ],
    [
      { habit: "habit-1", date: "2024-05-03" },
      { habit: "habit-1", date: "2024-05-04" },
      { habit: "habit-1", date: "2024-05-06" },
      { habit: "habit-1", date: "2024-03-20" },
      { habit: "habit-1", date: "2024-03-21" },
      { habit: "habit-1", date: "2024-03-22" },
    ],
    "2024-05-01",
    "2024-05-07",
    "UTC",
    new Date("2024-05-07T12:00:00Z")
  );

  assert.deepEqual(result.habits[0], {
    id: "habit-1",
    name: "Exercise",
    category: "Health",
    frequency: "custom",
    isArchived: false,
    completionCount: 3,
    scheduledDays: 2,
    scheduledCompletions: 2,
    completionRate: 100,
    currentStreak: 1,
    longestStreak: 3,
  });
});
