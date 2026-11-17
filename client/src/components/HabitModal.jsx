import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axios.js";
import { useToast } from "../context/ToastContext.jsx";
import Modal from "./Modal.jsx";

const CATEGORIES = ["Health", "Study", "Fitness", "Mindfulness", "Productivity", "Other"];
const WEEKDAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];
const ICONS = [
  "✨", "📚", "💧", "🏃", "🧘", "🌱", "💪", "🧠",
  "🎯", "📝", "🚶", "🥗", "😴", "🧹", "💻", "🎨",
  "🙏", "☀️", "🌙", "🎵", "💊", "🏋️", "🐕", "📖",
];
const COLORS = [
  "#39845a",
  "#f0a94c",
  "#e98674",
  "#7d9de8",
  "#bd88d1",
  "#2d9b8f",
  "#e76f51",
  "#64748b",
];
const ALL_DAYS = WEEKDAYS.map(({ value }) => value);

function makeInitialValues(habit, initialValues) {
  const source = habit || initialValues || {};
  const frequency =
    source.frequency === "specific_days" || source.frequency === "weekly" || source.frequency === "custom"
      ? "specific_days"
      : "daily";

  return {
    name: source.name || "",
    category: CATEGORIES.includes(source.category) ? source.category : "Other",
    frequency,
    targetDays: Array.isArray(source.targetDays) ? [...source.targetDays] : [...ALL_DAYS],
    icon: ICONS.includes(source.icon) ? source.icon : "✨",
    color: COLORS.includes(source.color?.toLowerCase()) ? source.color.toLowerCase() : COLORS[0],
    source: source.source === "ai" ? "ai" : "manual",
  };
}

function validateForm(form) {
  const errors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Enter a habit name.";
  else if (name.length > 60) errors.name = "Use 60 characters or fewer.";
  if (form.frequency === "specific_days" && form.targetDays.length === 0) {
    errors.targetDays = "Select at least one day.";
  }
  return errors;
}

export default function HabitModal({
  open,
  onClose,
  onSaved,
  habit = null,
  initialValues = null,
}) {
  const { success, error: showError } = useToast();
  const [form, setForm] = useState(() => makeInitialValues(habit, initialValues));
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverNameError, setServerNameError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);
  const validationErrors = useMemo(() => validateForm(form), [form]);
  const showFieldError = (field) => touched[field] || submitAttempted;

  useEffect(() => {
    if (!open) return;
    setForm(makeInitialValues(habit, initialValues));
    setTouched({});
    setSubmitAttempted(false);
    setServerNameError("");
    setIsSubmitting(false);
    submitLock.current = false;
  }, [open, habit, initialValues]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "name") setServerNameError("");
    if (field === "frequency" && value === "specific_days") {
      setTouched((current) => ({ ...current, targetDays: true }));
    }
  }

  function toggleTargetDay(day) {
    setTouched((current) => ({ ...current, targetDays: true }));
    setForm((current) => {
      const selected = new Set(current.targetDays);
      if (selected.has(day)) selected.delete(day);
      else selected.add(day);
      return { ...current, targetDays: [...selected] };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitAttempted(true);
    if (submitLock.current || Object.keys(validationErrors).length > 0) return;

    submitLock.current = true;
    setIsSubmitting(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      frequency: form.frequency,
      targetDays: form.frequency === "daily" ? [...ALL_DAYS] : form.targetDays,
      icon: form.icon,
      color: form.color,
      source: form.source,
    };

    try {
      const response = habit
        ? await api.put(`/habits/${habit._id}`, payload)
        : await api.post("/habits", payload);
      await onSaved?.(response.data.habit);
      success(habit ? "Habit updated" : "Habit created");
      onClose();
    } catch (requestError) {
      const message =
        requestError.response?.data?.message ||
        "Could not save this habit. Please try again.";
      if (requestError.response?.status === 409 && /name|exists|duplicate/i.test(message)) {
        setServerNameError(message);
      }
      showError(message);
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  const title = habit ? "Edit habit" : "Create a habit";
  const nameError = serverNameError || validationErrors.name;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      disableClose={isSubmitting}
    >
      <div
        className="mb-5 flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4"
        aria-label="Habit preview"
      >
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl text-white"
          style={{ backgroundColor: form.color }}
          aria-hidden="true"
        >
          {form.icon}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">
            {form.name.trim() || "Your new habit"}
          </p>
          <p className="mt-1 text-xs text-slate-500">{form.category}</p>
        </div>
      </div>

      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700">
            <span>Habit name</span>
            <span className="text-xs text-slate-500">{form.name.length}/60</span>
          </span>
          <input
            data-autofocus
            className="input-field"
            type="text"
            value={form.name}
            maxLength={60}
            aria-invalid={Boolean(showFieldError("name") && nameError)}
            aria-describedby={showFieldError("name") && nameError ? "habit-name-error" : undefined}
            onChange={(event) => updateField("name", event.target.value)}
            onBlur={() => setTouched((current) => ({ ...current, name: true }))}
            placeholder="e.g. Read for 10 minutes"
          />
          {showFieldError("name") && nameError && (
            <span id="habit-name-error" className="mt-1 block text-sm text-red-700" role="alert">
              {nameError}
            </span>
          )}
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Category</span>
          <select
            className="input-field"
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Frequency</legend>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Habit frequency">
            {[
              { value: "daily", label: "Every day" },
              { value: "specific_days", label: "Specific days" },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  form.frequency === value
                    ? "border-grove-500 bg-grove-50 text-grove-700"
                    : "border-stone-200 text-slate-600 hover:bg-stone-50"
                }`}
                aria-pressed={form.frequency === value}
                onClick={() => updateField("frequency", value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {form.frequency === "specific_days" && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">Target days</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(({ label, value }) => {
                const selected = form.targetDays.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    className={`min-w-12 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      selected
                        ? "border-grove-500 bg-grove-50 text-grove-700"
                        : "border-stone-200 text-slate-600 hover:bg-stone-50"
                    }`}
                    aria-pressed={selected}
                    onClick={() => toggleTargetDay(value)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {showFieldError("targetDays") && validationErrors.targetDays && (
              <p className="mt-1 text-sm text-red-700" role="alert">
                {validationErrors.targetDays}
              </p>
            )}
          </fieldset>
        )}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Choose an icon</legend>
          <div className="grid grid-cols-8 gap-2 sm:grid-cols-12">
            {ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`grid aspect-square place-items-center rounded-xl border text-xl transition ${
                  form.icon === icon
                    ? "border-grove-500 bg-grove-50"
                    : "border-stone-200 hover:bg-stone-50"
                }`}
                aria-label={`Use ${icon} icon`}
                aria-pressed={form.icon === icon}
                onClick={() => updateField("icon", icon)}
              >
                {icon}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Choose a color</legend>
          <div className="flex flex-wrap gap-3">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`h-9 w-9 rounded-full border-2 transition ${
                  form.color === color ? "border-slate-900 ring-2 ring-grove-100" : "border-white"
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Use color ${color}`}
                aria-pressed={form.color === color}
                onClick={() => updateField("color", color)}
              />
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col-reverse gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:justify-end">
          <button type="button" className="button-quiet" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="submit"
            className="button-primary"
            disabled={isSubmitting || Object.keys(validationErrors).length > 0}
          >
            {isSubmitting ? "Saving..." : habit ? "Save changes" : "Create habit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
