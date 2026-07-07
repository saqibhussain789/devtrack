import type { DragEvent } from "react";
import { PriorityBadge } from "./priority-badge";
import type { TaskSummary } from "./types";

export function TaskCard({
  task,
  projectKey,
  onOpen,
  onDragStart,
  onDropBefore,
}: {
  task: TaskSummary;
  projectKey: string;
  onOpen: () => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDropBefore: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.stopPropagation();
        onDropBefore(e);
      }}
      onClick={onOpen}
      className="flex w-full flex-col gap-2 rounded-lg border border-stone-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-primary-300 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-primary-700"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-stone-400">
          {projectKey}-{task.taskNumber}
        </span>
        <PriorityBadge priority={task.priority} />
      </div>
      <p className="text-sm font-medium text-stone-900 dark:text-stone-100">{task.title}</p>
      <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
        <span>{task.assignee ? task.assignee.name : "Unassigned"}</span>
        {task.storyPoints !== null && (
          <span className="rounded bg-stone-100 px-1.5 py-0.5 font-medium dark:bg-stone-800">
            {task.storyPoints} pts
          </span>
        )}
      </div>
    </button>
  );
}
