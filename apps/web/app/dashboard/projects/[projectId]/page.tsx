"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type DragEvent, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { computeInsertSortOrder } from "../../../../lib/board-utils";
import { TaskCard } from "../../../../components/kanban/task-card";
import { TaskDrawer } from "../../../../components/kanban/task-drawer";
import { GitHubPanel } from "../../../../components/kanban/github-panel";
import { DeploymentsPanel } from "../../../../components/kanban/deployments-panel";
import { StatusDot } from "../../../../components/status-dot";
import type { BoardData, StatusColumn, TaskSummary } from "../../../../components/kanban/types";

interface Member {
  id: string;
  user: { id: string; name: string; email: string };
}

const CATEGORY_DOT: Record<string, string> = {
  TODO: "bg-status-todo",
  IN_PROGRESS: "bg-status-progress",
  DONE: "bg-status-done",
};

export default function BoardPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { user, accessToken } = useAuth();

  const [board, setBoard] = useState<BoardData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const loadBoard = useCallback(async () => {
    if (!accessToken) return;

    try {
      const data = await apiFetch<BoardData>(`/projects/${projectId}/board`, { accessToken });
      setBoard(data);
      setError(null);

      const memberData = await apiFetch<Member[]>(`/workspaces/${data.project.workspaceId}/members`, {
        accessToken,
      });
      setMembers(memberData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load board.");
    }
  }, [projectId, accessToken]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  async function handleQuickAdd(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !quickAddTitle.trim()) return;

    setAddingTask(true);

    try {
      await apiFetch(`/projects/${projectId}/tasks`, {
        method: "POST",
        accessToken,
        body: { title: quickAddTitle },
      });
      setQuickAddTitle("");
      await loadBoard();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create task.");
    } finally {
      setAddingTask(false);
    }
  }

  async function moveTask(taskId: string, targetStatus: StatusColumn, insertBeforeIndex: number | null) {
    if (!board || !accessToken) return;

    let task: TaskSummary | undefined;
    for (const status of board.statuses) {
      const found = status.tasks.find((t) => t.id === taskId);
      if (found) {
        task = found;
        break;
      }
    }
    if (!task) return;

    const destTasksExcluding = targetStatus.tasks.filter((t) => t.id !== taskId);
    const newSortOrder = computeInsertSortOrder(destTasksExcluding, insertBeforeIndex);

    setBoard((prev) => {
      if (!prev) return prev;
      const statuses = prev.statuses.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }));
      const destIndex = statuses.findIndex((s) => s.id === targetStatus.id);
      const dest = statuses[destIndex]!;
      const updatedTask = { ...task!, sortOrder: newSortOrder };
      const insertAt = insertBeforeIndex === null ? dest.tasks.length : Math.min(insertBeforeIndex, dest.tasks.length);
      const nextTasks = [...dest.tasks];
      nextTasks.splice(insertAt, 0, updatedTask);
      statuses[destIndex] = { ...dest, tasks: nextTasks };
      return { ...prev, statuses };
    });

    try {
      await apiFetch(`/tasks/${taskId}/move`, {
        method: "PATCH",
        accessToken,
        body: { statusId: targetStatus.id, sortOrder: newSortOrder },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to move task.");
      await loadBoard();
    }
  }

  function handleCardDragStart(event: DragEvent<HTMLButtonElement>, taskId: string) {
    event.dataTransfer.setData("text/plain", taskId);
  }

  function handleDropOnCard(event: DragEvent<HTMLButtonElement>, status: StatusColumn, index: number) {
    const taskId = event.dataTransfer.getData("text/plain");
    if (!taskId) return;
    moveTask(taskId, status, index);
  }

  function handleDropOnColumn(event: DragEvent<HTMLDivElement>, status: StatusColumn) {
    const taskId = event.dataTransfer.getData("text/plain");
    if (!taskId) return;
    moveTask(taskId, status, null);
  }

  if (!board) {
    return <p className="text-sm text-ink-muted">{error ?? "Loading board…"}</p>;
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
              {board.project.key}
            </span>
            <h1 className="text-xl font-semibold text-ink">{board.project.name}</h1>
          </div>
          {board.project.description && (
            <p className="mt-1 text-sm text-ink-muted">{board.project.description}</p>
          )}
        </div>

        <Link
          href={`/dashboard/projects/${board.project.id}/metrics`}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-border/40"
        >
          View metrics →
        </Link>
      </div>

      {error && <p className="text-sm text-status-blocked">{error}</p>}

      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {board.statuses.map((status) => (
          <div
            key={status.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropOnColumn(e, status)}
            className="flex w-72 flex-shrink-0 flex-col rounded-xl bg-border/30 p-3"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <StatusDot colorClassName={CATEGORY_DOT[status.category] ?? "bg-status-todo"} />
                <h2 className="text-sm font-semibold text-ink">{status.name}</h2>
              </div>
              <span className="text-xs text-ink-muted">{status.tasks.length}</span>
            </div>

            <div className="flex flex-col gap-2">
              {status.tasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  projectKey={board.project.key}
                  onOpen={() => setOpenTaskId(task.id)}
                  onDragStart={(e) => handleCardDragStart(e, task.id)}
                  onDropBefore={(e) => handleDropOnCard(e, status, index)}
                />
              ))}
            </div>

            {status.isDefault && (
              <form onSubmit={handleQuickAdd} className="mt-3">
                <input
                  value={quickAddTitle}
                  onChange={(e) => setQuickAddTitle(e.target.value)}
                  placeholder="+ Add a task"
                  disabled={addingTask}
                  className="w-full rounded-lg border border-transparent bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
              </form>
            )}
          </div>
        ))}
      </div>

      {accessToken && (
        <GitHubPanel
          project={board.project}
          role={user?.memberships.find((m) => m.workspace.id === board.project.workspaceId)?.role}
          accessToken={accessToken}
          onConnected={loadBoard}
        />
      )}

      {accessToken && (
        <DeploymentsPanel
          projectId={board.project.id}
          role={user?.memberships.find((m) => m.workspace.id === board.project.workspaceId)?.role}
          accessToken={accessToken}
        />
      )}

      {openTaskId && accessToken && (
        <TaskDrawer
          taskId={openTaskId}
          projectKey={board.project.key}
          accessToken={accessToken}
          members={members}
          onClose={() => setOpenTaskId(null)}
          onUpdated={loadBoard}
        />
      )}
    </div>
  );
}
