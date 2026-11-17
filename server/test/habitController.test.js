import assert from "node:assert/strict";
import test from "node:test";
import Completion from "../models/Completion.js";
import Habit from "../models/Habit.js";
import {
  createHabit,
  deleteHabit,
  listHabits,
  toggleHabitArchive,
  updateHabit,
} from "../controllers/habitController.js";
import { validateHabitInput } from "../utils/habitValidation.js";

const userId = "507f1f77bcf86cd799439011";
const habitId = "507f191e810c19729de860ea";

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function callController(controller, request) {
  const response = createResponse();
  let forwardedError;
  await controller(request, response, (error) => {
    forwardedError = error;
  });
  if (forwardedError) throw forwardedError;
  return response;
}

function request({ method = "POST", body = {}, id, query = {} } = {}) {
  return {
    method,
    body,
    params: id ? { id } : {},
    query,
    user: { id: userId },
  };
}

test("validates habit defaults and daily schedules", () => {
  const result = validateHabitInput({ name: "  Read  " });

  assert.deepEqual(result.values, {
    name: "Read",
    category: "Other",
    frequency: "daily",
    targetDays: [0, 1, 2, 3, 4, 5, 6],
    icon: "✨",
    color: "#39845a",
    source: "manual",
  });
});

test("Habit model applies schema defaults and rejects unsupported values", () => {
  const defaultHabit = new Habit({ user: userId, name: "Read" });
  assert.equal(defaultHabit.category, "Other");
  assert.equal(defaultHabit.frequency, "daily");
  assert.equal(defaultHabit.validateSync(), undefined);

  const invalidHabit = new Habit({
    user: userId,
    name: "Walk",
    category: "Leisure",
    frequency: "specific_days",
    targetDays: [],
    icon: "ab",
    color: "#ffffff",
  });
  const validationError = invalidHabit.validateSync();
  assert.ok(validationError.errors.category);
  assert.ok(validationError.errors.targetDays);
  assert.ok(validationError.errors.icon);
  assert.ok(validationError.errors.color);
});

test("requires valid target days for specific-day habits", () => {
  assert.match(
    validateHabitInput({ name: "Walk", frequency: "specific_days", targetDays: [] }).error,
    /at least one/
  );
  assert.match(
    validateHabitInput({
      name: "Walk",
      frequency: "specific_days",
      targetDays: [1, 1],
    }).error,
    /unique weekday/
  );
  assert.deepEqual(
    validateHabitInput({
      name: "Walk",
      frequency: "specific_days",
      targetDays: [1, 3, 5],
    }).values.targetDays,
    [1, 3, 5]
  );
});

test("rejects names over 60 characters, invalid categories, colors, and icons", () => {
  assert.match(validateHabitInput({ name: "a".repeat(61) }).error, /60 characters/);
  assert.match(validateHabitInput({ name: "Walk", category: "Leisure" }).error, /category/);
  assert.match(validateHabitInput({ name: "Walk", color: "#ffffff" }).error, /color/);
  assert.match(validateHabitInput({ name: "Walk", icon: "ab" }).error, /single emoji/);
});

test("creates a habit with the authenticated user and daily weekdays", async (t) => {
  let created;
  t.mock.method(Habit, "exists", async () => null);
  t.mock.method(Habit, "countDocuments", async () => 0);
  t.mock.method(Habit, "create", async (values) => {
    created = values;
    return { _id: habitId, ...values };
  });

  const response = await callController(
    createHabit,
    request({ body: { name: "Read" } })
  );

  assert.equal(response.statusCode, 201);
  assert.equal(created.user, userId);
  assert.deepEqual(created.targetDays, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(created.source, "manual");
  assert.equal(response.body.habit.name, "Read");
});

test("rejects a client-supplied user ID instead of trusting it", async (t) => {
  let created;
  t.mock.method(Habit, "create", async (values) => { created = values; });
  const response = await callController(
    createHabit,
    request({ body: { name: "Read", icon: "📚", user: userId } })
  );

  assert.equal(response.statusCode, 400);
  assert.equal(created, undefined);
});

test("rejects a case-insensitive duplicate active habit with 409", async (t) => {
  let countChecked = false;
  t.mock.method(Habit, "exists", async (filter) => {
    assert.equal(filter.user, userId);
    assert.equal(filter.isArchived, false);
    assert.ok(filter.name.test("morning run"));
    return { _id: habitId };
  });
  t.mock.method(Habit, "countDocuments", async () => {
    countChecked = true;
    return 0;
  });

  const response = await callController(
    createHabit,
    request({ body: { name: "Morning Run" } })
  );

  assert.equal(response.statusCode, 409);
  assert.match(response.body.message, /already exists/);
  assert.equal(countChecked, false);
});

test("rejects creation when the user already has 30 active habits", async (t) => {
  t.mock.method(Habit, "exists", async () => null);
  t.mock.method(Habit, "countDocuments", async () => 30);

  const response = await callController(createHabit, request({ body: { name: "Read" } }));

  assert.equal(response.statusCode, 409);
  assert.match(response.body.message, /30 active habits/);
});

test("returns 404 when an update targets a habit not owned by the user", async (t) => {
  t.mock.method(Habit, "findOne", async (filter) => {
    assert.deepEqual(filter, { _id: habitId, user: userId });
    return null;
  });

  const response = await callController(
    updateHabit,
    request({ method: "PUT", id: habitId, body: { name: "Updated" } })
  );

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { message: "Habit not found" });
});

test("updates an owned habit with user-scoped queries", async (t) => {
  const existingHabit = {
    _id: habitId,
    name: "Read",
    category: "Study",
    frequency: "daily",
    targetDays: [0, 1, 2, 3, 4, 5, 6],
    icon: "📚",
    color: "#39845a",
    source: "manual",
    isArchived: false,
  };
  let updateFilter;
  t.mock.method(Habit, "findOne", async () => existingHabit);
  t.mock.method(Habit, "exists", async () => null);
  t.mock.method(Habit, "findOneAndUpdate", async (filter, update) => {
    updateFilter = filter;
    return { ...existingHabit, ...update.$set };
  });

  const response = await callController(
    updateHabit,
    request({
      method: "PUT",
      id: habitId,
      body: {
        name: "Morning reading",
        category: "Study",
        frequency: "specific_days",
        targetDays: [1, 3, 5],
        icon: "📖",
        color: "#7d9de8",
      },
    })
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(updateFilter, { _id: habitId, user: userId });
  assert.equal(response.body.habit.name, "Morning reading");
  assert.deepEqual(response.body.habit.targetDays, [1, 3, 5]);
});

test("returns 404 for another user's habit without deleting its completions", async (t) => {
  let completionDeletionAttempted = false;
  t.mock.method(Habit, "findOne", () => ({
    select: async () => null,
  }));
  t.mock.method(Completion, "deleteMany", async () => {
    completionDeletionAttempted = true;
  });

  const response = await callController(
    deleteHabit,
    request({ method: "DELETE", id: habitId })
  );

  assert.equal(response.statusCode, 404);
  assert.equal(completionDeletionAttempted, false);
});

test("blocks unarchiving when the active-habit limit has been reached", async (t) => {
  const archivedHabit = {
    _id: habitId,
    name: "Read",
    isArchived: true,
    save: async () => {
      throw new Error("Archived habit should not be saved");
    },
  };
  t.mock.method(Habit, "findOne", async () => archivedHabit);
  t.mock.method(Habit, "countDocuments", async (filter) => {
    assert.deepEqual(filter, { user: userId, isArchived: false });
    return 30;
  });

  const response = await callController(
    toggleHabitArchive,
    request({ method: "PATCH", id: habitId })
  );

  assert.equal(response.statusCode, 409);
  assert.match(response.body.message, /30 active habits/);
});

test("archives an owned habit using a scoped update", async (t) => {
  const activeHabit = {
    _id: habitId,
    name: "Read",
    isArchived: false,
  };
  let updateFilter;
  t.mock.method(Habit, "findOne", async () => activeHabit);
  t.mock.method(Habit, "findOneAndUpdate", async (filter, update) => {
    updateFilter = filter;
    return { ...activeHabit, ...update.$set };
  });

  const response = await callController(
    toggleHabitArchive,
    request({ method: "PATCH", id: habitId })
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(updateFilter, {
    _id: habitId,
    user: userId,
    isArchived: false,
  });
  assert.equal(response.body.habit.isArchived, true);
});

test("filters habit lists by the authenticated user and archived status", async (t) => {
  let queriedFilter;
  t.mock.method(Habit, "find", (filter) => {
    queriedFilter = filter;
    return { sort: async () => [] };
  });

  const response = await callController(
    listHabits,
    request({ method: "GET", query: { archived: "true" } })
  );

  assert.deepEqual(queriedFilter, { user: userId, isArchived: true });
  assert.deepEqual(response.body, { habits: [] });
});

test("deletes only an owned habit and its scoped completions", async (t) => {
  const filters = [];
  t.mock.method(Habit, "findOne", () => ({
    select: async () => ({ _id: habitId }),
  }));
  t.mock.method(Completion, "deleteMany", async (filter) => {
    filters.push({ model: "completion", filter });
  });
  t.mock.method(Habit, "deleteOne", async (filter) => {
    filters.push({ model: "habit", filter });
    return { deletedCount: 1 };
  });

  const response = await callController(
    deleteHabit,
    request({ method: "DELETE", id: habitId })
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(filters, [
    { model: "completion", filter: { habit: habitId, user: userId } },
    { model: "habit", filter: { _id: habitId, user: userId } },
  ]);
});
