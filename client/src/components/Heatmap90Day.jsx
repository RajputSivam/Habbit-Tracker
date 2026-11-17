import { getWeekday } from "../utils/date.js";

const WEEKDAY_LABELS = ["Sun", "", "Tue", "", "Thu", "", "Sat"];
const COLORS = ["#edf2ee", "#d4e9d8", "#a9d3b2", "#69b47b", "#347d49"];

function getColor(count) {
  if (count === 0) return COLORS[0];
  if (count === 1) return COLORS[1];
  if (count === 2) return COLORS[2];
  if (count <= 4) return COLORS[3];
  return COLORS[4];
}

function getMonthLabel(dateKey) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateKey.slice(0, 7)}-01T00:00:00.000Z`));
}

export default function Heatmap90Day({ data }) {
  const days = data?.days || [];
  if (!days.length) {
    return (
      <div className="grid min-h-36 place-items-center rounded-2xl bg-stone-50 text-sm text-slate-500">
        No heatmap data is available yet.
      </div>
    );
  }

  const leadingCells = Array.from({ length: getWeekday(days[0].date) }, () => null);
  const cells = [...leadingCells, ...days];
  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="w-max" role="img" aria-label={`Daily check-ins from ${data.from} to ${data.to}`}>
          <div
            className="mb-2 ml-9 grid gap-1 text-[10px] font-medium text-slate-500"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}
            aria-hidden="true"
          >
            {weeks.map((week, index) => {
              const firstOfMonth = week.find((day) => day?.date.endsWith("-01"));
              const firstDay = week.find(Boolean);
              const previousFirstDay = weeks[index - 1]?.find(Boolean);
              const changedMonth =
                firstDay &&
                (!previousFirstDay ||
                  firstDay.date.slice(0, 7) !== previousFirstDay.date.slice(0, 7));
              const labelDay = firstOfMonth || (index === 0 || changedMonth ? firstDay : null);

              return (
                <span key={index} className="whitespace-nowrap">
                  {labelDay ? getMonthLabel(labelDay.date) : ""}
                </span>
              );
            })}
          </div>

          <div className="flex gap-2">
            <div
              className="grid w-7 shrink-0 grid-rows-7 gap-1 text-[9px] leading-3 text-slate-400"
              aria-hidden="true"
            >
              {WEEKDAY_LABELS.map((label, index) => (
                <span key={index}>{label}</span>
              ))}
            </div>
            <div
              className="grid grid-flow-col gap-1"
              style={{
                gridTemplateRows: "repeat(7, 12px)",
                gridAutoColumns: "12px",
              }}
            >
              {cells.map((day, index) =>
                day ? (
                  <span
                    key={day.date}
                    className="rounded-[3px] ring-1 ring-black/[0.03]"
                    style={{ backgroundColor: getColor(day.count) }}
                    title={`${day.date}: ${day.count} completion${day.count === 1 ? "" : "s"}`}
                    aria-label={`${day.date}: ${day.count} completions`}
                  />
                ) : (
                  <span key={`empty-${index}`} aria-hidden="true" />
                )
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 text-[11px] text-slate-500">
        <span>Less</span>
        {COLORS.map((color) => (
          <span
            key={color}
            className="h-3 w-3 rounded-[3px] ring-1 ring-black/[0.03]"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
