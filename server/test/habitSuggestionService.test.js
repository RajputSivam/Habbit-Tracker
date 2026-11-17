import assert from "node:assert/strict";
import test from "node:test";
import {
  parseHabitSuggestionResponse,
  validateHabitSuggestionRequest,
} from "../services/habitSuggestionService.js";

function suggestion(name = "Drink water") {
  return {
    name,
    category: "Health",
    frequency: "daily",
    targetDays: [],
    icon: "💧",
    color: "#39845a",
    reason: "A small daily action supports your goal.",
  };
}

test("parses and validates a JSON array of suggestions", () => {
  const [parsed] = parseHabitSuggestionResponse(JSON.stringify([suggestion()]));

  assert.deepEqual(parsed, {
    ...suggestion(),
    targetDays: [0, 1, 2, 3, 4, 5, 6],
  });
});

test("parses JSON suggestions wrapped in a code fence", () => {
  const response = `\`\`\`json\n${JSON.stringify([suggestion()])}\n\`\`\``;

  assert.equal(parseHabitSuggestionResponse(response).length, 1);
});

test("rejects malformed or wholly invalid suggestion responses", () => {
  assert.throws(
    () => parseHabitSuggestionResponse("not json"),
    (error) => error.status === 502 && /invalid suggestions/i.test(error.message)
  );
  assert.throws(
    () => parseHabitSuggestionResponse(JSON.stringify([{ ...suggestion(), icon: "water" }])),
    (error) => error.status === 502 && /valid habit suggestions/i.test(error.message)
  );
});

test("drops existing-name duplicates and invalid suggestions", () => {
  const response = JSON.stringify([
    suggestion("drink water"),
    { ...suggestion("Invalid icon"), icon: "water" },
    suggestion("Take a walk"),
  ]);
  const parsed = parseHabitSuggestionResponse(response, ["Drink Water"]);

  assert.deepEqual(parsed.map(({ name }) => name), ["Take a walk"]);
});

test("validates and sanitizes suggestion request text and bounds", () => {
  const result = validateHabitSuggestionRequest({
    goal: "  Feel\u0000 better  ",
    productiveTime: " Morning ",
    struggles: "  Too many distractions\n lately  ",
  });

  assert.deepEqual(result, {
    values: {
      goal: "Feel better",
      productiveTime: "Morning",
      struggles: "Too many distractions lately",
    },
  });
  assert.ok(validateHabitSuggestionRequest({
    goal: "x".repeat(101),
    productiveTime: "Morning",
  }).error);
  assert.ok(validateHabitSuggestionRequest({
    goal: "Build a routine",
    productiveTime: "Morning",
    struggles: "x".repeat(301),
  }).error);
});
