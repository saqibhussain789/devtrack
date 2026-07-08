import type { WeeklyVelocityPoint } from "./types";

function formatWeekLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * A small single-series bar chart in plain HTML/CSS — one hue, direct value
 * labels (only six discrete weekly bars, not a dense continuous series, so
 * labeling every bar reads as a normal small chart rather than clutter), no
 * legend needed since a single series is named by the section title.
 */
export function WeeklyVelocityChart({ data }: { data: WeeklyVelocityPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.points));

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-sm font-semibold text-ink">Story points completed per week</p>
      <div className="mt-6 flex items-end gap-3" style={{ height: "140px" }}>
        {data.map((week) => (
          <div key={week.weekStart} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-xs font-medium text-ink-muted">{week.points}</span>
            <div
              className="w-full rounded-t bg-brand"
              style={{ height: `${Math.max(4, (week.points / max) * 100)}px` }}
            />
            <span className="text-[11px] text-ink-muted">{formatWeekLabel(week.weekStart)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
