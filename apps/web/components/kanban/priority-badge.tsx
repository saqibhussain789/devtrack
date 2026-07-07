import type { TaskPriority } from "./types";

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  LOW: "bg-stone-100 text-stone-500 dark:bg-stone-800/60 dark:text-stone-400",
  MEDIUM: "bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-100",
  HIGH: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  URGENT: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_CLASSES[priority]}`}>
      {priority}
    </span>
  );
}
