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
      className="flex w-full flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition-colors hover:border-brand/60"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-ink-muted">
          {projectKey}-{task.taskNumber}
        </span>
        <PriorityBadge priority={task.priority} />
      </div>
      <p className="text-sm font-medium text-ink">{task.title}</p>
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>{task.assignee ? task.assignee.name : "Unassigned"}</span>
        {task.storyPoints !== null && (
          <span className="rounded bg-border/50 px-1.5 py-0.5 font-medium text-ink">
            {task.storyPoints} pts
          </span>
        )}
      </div>
    </button>
  );
}
