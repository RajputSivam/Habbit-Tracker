import assert from "node:assert/strict";
import test from "node:test";
import { generateJsonResponse } from "../services/geminiService.js";

test("reports missing Gemini configuration without attempting a request", async () => {
  const savedApiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    await assert.rejects(
      generateJsonResponse({
        task: "Test missing configuration",
        responseSchema: '{"message": string}',
        userHabitData: {},
      }),
      (error) => error.status === 503 && error.message === "AI features are not configured"
    );
  } finally {
    if (savedApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = savedApiKey;
    }
  }
});
