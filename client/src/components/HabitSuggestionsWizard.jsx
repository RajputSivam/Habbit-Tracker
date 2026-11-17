import { useEffect, useRef, useState } from "react";
import api from "../api/axios.js";
import { useToast } from "../context/ToastContext.jsx";
import HabitModal from "./HabitModal.jsx";
import Modal from "./Modal.jsx";

const GOALS = ["Health", "Study", "Career", "Mindfulness", "Fitness", "Custom"];
const PRODUCTIVE_TIMES = ["Morning", "Afternoon", "Evening", "Night"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getSuggestionKey(suggestion) {
  return suggestion.name.trim().toLocaleLowerCase();
}

function formatWait(seconds) {
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function getRequestError(error) {
  const status = error.response?.status;
  const response = error.response?.data;
  if (/not configured correctly/i.test(response?.message || "")) {
    return "AI configuration is invalid. Ask the administrator to check GEMINI_API_KEY on the server.";
  }
  if (status === 503 || /not configured/i.test(response?.message || "")) {
    return "AI is not configured. Ask the administrator to add GEMINI_API_KEY on the server.";
  }
  if (status === 429) {
    const retrySeconds =
      Number(response?.retryAfterSeconds) ||
      Number(error.response?.headers?.["retry-after"]) ||
      0;
    return retrySeconds
      ? `You've reached the AI request limit. Try again in about ${formatWait(retrySeconds)}.`
      : response?.message || "The AI service is busy. Please try again later.";
  }
  return response?.message || "We couldn't get suggestions right now. Please try again.";
}

function SuggestionSkeletons() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading habit suggestions">
      {[0, 1, 2].map((item) => (
        <div key={item} className="animate-pulse rounded-2xl border border-stone-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-stone-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-stone-200" />
              <div className="h-3 w-1/3 rounded bg-stone-100" />
            </div>
          </div>
          <div className="mt-4 h-3 w-full rounded bg-stone-100" />
          <div className="mt-2 h-3 w-4/5 rounded bg-stone-100" />
        </div>
      ))}
      <span className="sr-only">Generating ideas based on your answers...</span>
    </div>
  );
}

export default function HabitSuggestionsWizard({ open, onClose, onHabitAdded }) {
  const { success, error: showError } = useToast();
  const [step, setStep] = useState(1);
  const [goalOption, setGoalOption] = useState("");
  const [customGoal, setCustomGoal] = useState("");
  const [productiveTime, setProductiveTime] = useState("");
  const [struggles, setStruggles] = useState("");
  const [screen, setScreen] = useState("steps");
  const [suggestions, setSuggestions] = useState([]);
  const [addedKeys, setAddedKeys] = useState(() => new Set());
  const [pendingKeys, setPendingKeys] = useState(() => new Set());
  const [isAddingAll, setIsAddingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [customizingSuggestion, setCustomizingSuggestion] = useState(null);
  const requestController = useRef(null);
  const addedKeysRef = useRef(new Set());
  const addingKeysRef = useRef(new Set());
  const addAllLock = useRef(false);

  useEffect(() => {
    if (!open) {
      requestController.current?.abort();
      return;
    }

    setStep(1);
    setGoalOption("");
    setCustomGoal("");
    setProductiveTime("");
    setStruggles("");
    setScreen("steps");
    setSuggestions([]);
    setAddedKeys(new Set());
    setPendingKeys(new Set());
    setIsAddingAll(false);
    setErrorMessage("");
    setCustomizingSuggestion(null);
    addedKeysRef.current = new Set();
    addingKeysRef.current = new Set();
    addAllLock.current = false;
  }, [open]);

  const goal = goalOption === "Custom" ? customGoal.trim() : goalOption;

  async function getSuggestions(strugglesAnswer = struggles) {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setScreen("loading");
    setErrorMessage("");

    try {
      const { data } = await api.post(
        "/ai/suggest-habits",
        {
          goal,
          productiveTime,
          struggles: strugglesAnswer.trim(),
        },
        { signal: controller.signal }
      );
      if (!Array.isArray(data.suggestions) || data.suggestions.length === 0) {
        throw new Error("The AI service did not return any valid suggestions.");
      }
      setSuggestions(data.suggestions);
      setScreen("results");
      success("Habit suggestions ready");
    } catch (requestError) {
      if (requestError.code === "ERR_CANCELED") return;
      const message = getRequestError(requestError);
      setErrorMessage(message);
      setScreen("error");
      showError(message);
    } finally {
      if (requestController.current === controller) requestController.current = null;
    }
  }

  function closeWizard() {
    requestController.current?.abort();
    setCustomizingSuggestion(null);
    onClose?.();
  }

  function markAdded(key) {
    addedKeysRef.current = new Set([...addedKeysRef.current, key]);
    setAddedKeys(new Set(addedKeysRef.current));
  }

  async function addSuggestion(suggestion, { refresh = true } = {}) {
    const key = getSuggestionKey(suggestion);
    if (addedKeysRef.current.has(key) || addingKeysRef.current.has(key)) return false;

    addingKeysRef.current.add(key);
    setPendingKeys(new Set(addingKeysRef.current));
    let added = false;
    try {
      await api.post(
        "/habits",
        {
          name: suggestion.name,
          category: suggestion.category,
          frequency: suggestion.frequency,
          targetDays: suggestion.targetDays,
          icon: suggestion.icon,
          color: suggestion.color,
          source: "ai",
        }
      );
      markAdded(key);
      success(`Added "${suggestion.name}"`);
      added = true;
    } catch (requestError) {
      showError(
        requestError.response?.data?.message ||
          `Could not add "${suggestion.name}". Please try again.`
      );
    } finally {
      addingKeysRef.current.delete(key);
      setPendingKeys(new Set(addingKeysRef.current));
    }
    if (added && refresh) await onHabitAdded?.();
    return added;
  }

  async function addAllSuggestions() {
    if (addAllLock.current) return;
    addAllLock.current = true;
    setIsAddingAll(true);
    try {
      let addedAny = false;
      for (const suggestion of suggestions) {
        if (!addedKeysRef.current.has(getSuggestionKey(suggestion))) {
          addedAny = (await addSuggestion(suggestion, { refresh: false })) || addedAny;
        }
      }
      if (addedAny) await onHabitAdded?.();
    } finally {
      addAllLock.current = false;
      setIsAddingAll(false);
    }
  }

  async function handleCustomizeSaved() {
    if (customizingSuggestion) {
      markAdded(getSuggestionKey(customizingSuggestion));
    }
    await onHabitAdded?.();
    setCustomizingSuggestion(null);
  }

  const currentTitle =
    screen === "results" ? "Habit ideas for you" : "Find habits that fit your life";
  const unaddedCount = suggestions.filter(
    (suggestion) => !addedKeys.has(getSuggestionKey(suggestion))
  ).length;

  return (
    <>
      <Modal
        open={open && !customizingSuggestion}
        onClose={closeWizard}
        title={currentTitle}
      >
        {screen === "steps" && (
          <div>
            <div
              className="mb-6"
              role="progressbar"
              aria-label={`Step ${step} of 3`}
              aria-valuemin={1}
              aria-valuemax={3}
              aria-valuenow={step}
            >
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Step {step} of 3</span>
                <span>{Math.round((step / 3) * 100)}% complete</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-grove-600 transition-all"
                  style={{ width: `${(step / 3) * 100}%` }}
                />
              </div>
            </div>

            {step === 1 && (
              <section aria-labelledby="suggestion-goal-title">
                <h3 id="suggestion-goal-title" className="text-lg font-bold text-slate-900">
                  What is your main goal?
                </h3>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
                  {GOALS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={goalOption === option}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                        goalOption === option
                          ? "border-grove-500 bg-grove-50 text-grove-700"
                          : "border-stone-200 text-slate-600 hover:bg-stone-50"
                      }`}
                      onClick={() => setGoalOption(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {goalOption === "Custom" && (
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Describe your goal
                    </span>
                    <input
                      data-autofocus
                      className="input-field"
                      value={customGoal}
                      maxLength={100}
                      onChange={(event) => setCustomGoal(event.target.value)}
                      placeholder="e.g. Spend more time outdoors"
                    />
                    <span className="mt-1 block text-right text-xs text-slate-500">
                      {customGoal.length}/100
                    </span>
                  </label>
                )}
              </section>
            )}

            {step === 2 && (
              <section aria-labelledby="suggestion-time-title">
                <h3 id="suggestion-time-title" className="text-lg font-bold text-slate-900">
                  When are you most productive?
                </h3>
                <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup">
                  {PRODUCTIVE_TIMES.map((time) => (
                    <button
                      key={time}
                      type="button"
                      role="radio"
                      aria-checked={productiveTime === time}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        productiveTime === time
                          ? "border-grove-500 bg-grove-50 text-grove-700"
                          : "border-stone-200 text-slate-600 hover:bg-stone-50"
                      }`}
                      onClick={() => setProductiveTime(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === 3 && (
              <section aria-labelledby="suggestion-struggle-title">
                <h3 id="suggestion-struggle-title" className="text-lg font-bold text-slate-900">
                  What has made it hard to stick to habits before?
                </h3>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm text-slate-600">Optional</span>
                  <textarea
                    data-autofocus
                    className="input-field min-h-28 resize-y"
                    value={struggles}
                    maxLength={300}
                    onChange={(event) => setStruggles(event.target.value)}
                    placeholder="For example, a busy schedule or forgetting..."
                  />
                  <span className="mt-1 block text-right text-xs text-slate-500">
                    {struggles.length}/300
                  </span>
                </label>
              </section>
            )}

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              {step > 1 ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setStep((current) => current - 1)}
                >
                  Back
                </button>
              ) : (
                <span />
              )}
              {step < 3 ? (
                <button
                  type="button"
                  className="button-primary"
                  disabled={step === 1 ? !goal : !productiveTime}
                  onClick={() => setStep((current) => current + 1)}
                >
                  Next
                </button>
              ) : (
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setStruggles("");
                      getSuggestions("");
                    }}
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => getSuggestions()}
                  >
                    Get suggestions
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {screen === "loading" && <SuggestionSkeletons />}

        {screen === "error" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
            <p className="font-semibold text-red-800">{errorMessage}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="button-primary"
                onClick={() => getSuggestions()}
              >
                Try again
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setScreen("steps")}
              >
                Back to answers
              </button>
            </div>
          </div>
        )}

        {screen === "results" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Choose the ideas that feel right for you.
              </p>
              <button
                type="button"
                className="button-primary"
                disabled={unaddedCount === 0 || isAddingAll}
                onClick={addAllSuggestions}
              >
                {isAddingAll ? "Adding..." : "Add all"}
              </button>
            </div>

            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {suggestions.map((suggestion) => {
                const key = getSuggestionKey(suggestion);
                const added = addedKeys.has(key);
                const pending = pendingKeys.has(key);
                const schedule =
                  suggestion.frequency === "daily"
                    ? "Every day"
                    : `Specific days · ${(suggestion.targetDays || [])
                        .map((day) => WEEKDAYS[day])
                        .join(", ")}`;

                return (
                  <article
                    key={key}
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl text-white"
                        style={{ backgroundColor: suggestion.color }}
                        aria-hidden="true"
                      >
                        {suggestion.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-slate-900">{suggestion.name}</h3>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          {suggestion.category} <span aria-hidden="true">·</span> {schedule}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {suggestion.reason}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="button-primary"
                        disabled={added || pending || isAddingAll}
                        onClick={() => addSuggestion(suggestion)}
                      >
                        {added ? "Added" : pending ? "Adding..." : "Add"}
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        disabled={added || pending || isAddingAll}
                        onClick={() => setCustomizingSuggestion(suggestion)}
                      >
                        Customize
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="button-secondary"
                disabled={isAddingAll || pendingKeys.size > 0}
                onClick={() => getSuggestions()}
              >
                Regenerate
              </button>
            </div>
          </div>
        )}
      </Modal>

      <HabitModal
        open={Boolean(customizingSuggestion)}
        onClose={() => setCustomizingSuggestion(null)}
        initialValues={customizingSuggestion}
        onSaved={handleCustomizeSaved}
      />
    </>
  );
}
