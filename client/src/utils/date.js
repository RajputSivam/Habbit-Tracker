export function getDateKeyInTimeZone(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year.padStart(4, "0")}-${values.month}-${values.day}`;
}

export function getWeekday(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}
