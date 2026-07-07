"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type DragEvent, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { computeInsertSortOrder } from "../../../../lib/board-utils";
import { TaskCard } from "../../../../components/kanban/task-card";
import { TaskDrawer } from "../../../../components/kanban/task-drawer";
import { GitHubPanel } from "../../../../components/kanban/github-panel";
import type { BoardData, StatusColumn, TaskSummary } from "../../../../components/kanban/types";

interface Member {
  id: string;
  user: { id: string; name: string; email: string };
}

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
    return <p className="text-sm text-stone-500 dark:text-stone-400">{error ?? "Loading board…"}</p>;
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-100">
            {board.project.key}
          </span>
          <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">{board.project.name}</h1>
        </div>
        {board.project.description && (
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{board.project.description}</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {board.statuses.map((status) => (
          <div
            key={status.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropOnColumn(e, status)}
            className="flex w-72 flex-shrink-0 flex-col rounded-xl bg-stone-100 p-3 dark:bg-stone-900/60"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-200">{status.name}</h2>
              <span className="text-xs text-stone-400">{status.tasks.length}</span>
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
                  className="w-full rounded-lg border border-transparent bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:bg-stone-800 dark:text-stone-100"
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
