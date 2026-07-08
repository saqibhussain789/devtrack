import { StatusDot } from "../status-dot";
import type { TaskPriority } from "./types";

const PRIORITY_DOT: Record<TaskPriority, string> = {
  LOW: "bg-status-todo",
  MEDIUM: "bg-brand",
  HIGH: "bg-status-blocked",
  URGENT: "bg-status-blocked",
};

// URGENT reuses the same "blocked" red as HIGH (no extra hue in the given
// palette to escalate further) but bumps to semibold so it still reads as
// one step more severe than HIGH at a glance.
const PRIORITY_WEIGHT: Record<TaskPriority, string> = {
  LOW: "font-medium",
  MEDIUM: "font-medium",
  HIGH: "font-medium",
  URGENT: "font-semibold",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-border/40 px-2 py-0.5 text-[11px] text-ink ${PRIORITY_WEIGHT[priority]}`}
    >
      <StatusDot colorClassName={PRIORITY_DOT[priority]} />
      {priority}
    </span>
  );
}
