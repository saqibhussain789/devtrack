import { StatusDot } from "../status-dot";

// Deliberately follows the app's own status language (blue = in flight, green
// = landed, red = didn't land) rather than GitHub's own OPEN/MERGED/CLOSED
// colors, so a PR badge reads the same way as a task or deployment badge.
const STATE_DOT: Record<string, string> = {
  OPEN: "bg-status-progress",
  MERGED: "bg-status-done",
  CLOSED: "bg-status-blocked",
};

export function PrStateBadge({ state }: { state: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-border/40 px-2 py-0.5 text-[11px] font-medium text-ink">
      <StatusDot colorClassName={STATE_DOT[state] ?? "bg-status-todo"} />
      {state}
    </span>
  );
}
