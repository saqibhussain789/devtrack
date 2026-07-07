"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import type { TaskDetail, TaskPriority } from "./types";

const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

interface Member {
  id: string;
  user: { id: string; name: string; email: string };
}

export function TaskDrawer({
  taskId,
  projectKey,
  accessToken,
  members,
  onClose,
  onUpdated,
}: {
  taskId: string;
  projectKey: string;
  accessToken: string;
  members: Member[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [storyPoints, setStoryPoints] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);

  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch<TaskDetail>(`/tasks/${taskId}`, { accessToken })
      .then((data) => {
        if (cancelled) return;
        setTask(data);
        setTitle(data.title);
        setDescription(data.description ?? "");
        setPriority(data.priority);
        setStoryPoints(data.storyPoints?.toString() ?? "");
        setAssigneeId(data.assignee?.id ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Unable to load task."));

    return () => {
      cancelled = true;
    };
  }, [taskId, accessToken]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const updated = await apiFetch<TaskDetail>(`/tasks/${taskId}`, {
        method: "PATCH",
        accessToken,
        body: {
          title,
          description: description || null,
          priority,
          storyPoints: storyPoints === "" ? null : Number(storyPoints),
          assigneeId: assigneeId || null,
        },
      });
      setTask(updated);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddComment(event: FormEvent) {
    event.preventDefault();
    if (!commentBody.trim()) return;

    setPostingComment(true);
    setCommentError(null);

    try {
      const comment = await apiFetch<TaskDetail["comments"][number]>(`/tasks/${taskId}/comments`, {
        method: "POST",
        accessToken,
        body: { body: commentBody },
      });
      setTask((prev) => (prev ? { ...prev, comments: [...prev.comments, comment] } : prev));
      setCommentBody("");
    } catch (err) {
      setCommentError(err instanceof ApiError ? err.message : "Unable to add comment.");
    } finally {
      setPostingComment(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-medium text-stone-400">
            {projectKey}-{task?.taskNumber ?? "…"}
          </span>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            Close
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {!task ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">Loading…</p>
        ) : (
          <>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-stone-600 dark:text-stone-300">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-stone-600 dark:text-stone-300">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-stone-600 dark:text-stone-300">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-stone-600 dark:text-stone-300">Story points</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={storyPoints}
                    onChange={(e) => setStoryPoints(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-stone-600 dark:text-stone-300">Assignee</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </form>

            <div className="mt-8 flex flex-col gap-3 border-t border-stone-200 pt-6 dark:border-stone-800">
              <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Comments ({task.comments.length})
              </h3>

              <div className="flex flex-col gap-3">
                {task.comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-stone-50 p-3 text-sm dark:bg-stone-800/60">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium text-stone-900 dark:text-stone-100">{comment.author.name}</span>
                      <span className="text-xs text-stone-400">{new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-stone-600 dark:text-stone-300">{comment.body}</p>
                  </div>
                ))}
                {task.comments.length === 0 && (
                  <p className="text-sm text-stone-400">No comments yet.</p>
                )}
              </div>

              <form onSubmit={handleAddComment} className="flex flex-col gap-2">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Add a comment…"
                  rows={2}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
                {commentError && <p className="text-sm text-red-600 dark:text-red-400">{commentError}</p>}
                <button
                  type="submit"
                  disabled={postingComment}
                  className="self-start rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
                >
                  {postingComment ? "Posting…" : "Post comment"}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
