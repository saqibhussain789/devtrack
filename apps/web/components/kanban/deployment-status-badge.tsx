import type { DeploymentStatus } from "./types";

const STATUS_CLASSES: Record<DeploymentStatus, string> = {
  QUEUED: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
  RUNNING: "bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-100",
  SUCCESS: "bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-100",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
  CANCELED: "bg-stone-200 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
};

export function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASSES[status]}`}>
      {status}
    </span>
  );
}
