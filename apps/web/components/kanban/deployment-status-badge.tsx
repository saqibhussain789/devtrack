import { StatusDot } from "../status-dot";
import type { DeploymentStatus } from "./types";

const STATUS_DOT: Record<DeploymentStatus, string> = {
  QUEUED: "bg-status-todo",
  RUNNING: "bg-status-progress",
  SUCCESS: "bg-status-done",
  FAILED: "bg-status-blocked",
  CANCELED: "bg-status-todo",
};

export function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-border/40 px-2 py-0.5 text-[11px] font-medium text-ink">
      <StatusDot colorClassName={STATUS_DOT[status]} />
      {status}
    </span>
  );
}
