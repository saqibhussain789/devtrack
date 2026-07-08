import { prisma } from "../../lib/prisma";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Two "at risk" signals, both derived from data already tracked elsewhere —
 * no new schema or background job needed:
 *
 * - Stale open PRs: state=OPEN with no webhook activity synced in
 *   `stalePrDays`. `syncedAt` only advances when GitHub sends a webhook event
 *   for that PR, so an old `syncedAt` on a still-open PR means it's genuinely
 *   gone quiet, not just recently opened.
 * - Done tasks without a merged PR: status.category=DONE but every PR linked
 *   to the task is still OPEN or was CLOSED unmerged — a task marked done
 *   that the code behind it never actually shipped.
 */
export async function getAtRiskItems(projectId: string, stalePrDays: number) {
  const staleCutoff = new Date(Date.now() - stalePrDays * MS_PER_DAY);
  const now = Date.now();

  const [stalePrs, doneTasksWithPrs] = await Promise.all([
    prisma.pullRequest.findMany({
      where: { projectId, state: "OPEN", syncedAt: { lt: staleCutoff } },
      orderBy: { syncedAt: "asc" },
      select: {
        id: true,
        number: true,
        title: true,
        url: true,
        authorLogin: true,
        syncedAt: true,
        taskId: true,
      },
    }),
    prisma.task.findMany({
      where: { projectId, status: { category: "DONE" }, pullRequests: { some: {} } },
      select: {
        id: true,
        taskNumber: true,
        title: true,
        completedAt: true,
        pullRequests: { select: { state: true } },
      },
    }),
  ]);

  const doneWithoutMergedPr = doneTasksWithPrs
    .filter((task) => task.pullRequests.every((pr) => pr.state !== "MERGED"))
    .map((task) => ({
      id: task.id,
      taskNumber: task.taskNumber,
      title: task.title,
      completedAt: task.completedAt,
    }));

  return {
    stalePrs: stalePrs.map((pr) => ({
      ...pr,
      idleDays: Math.floor((now - pr.syncedAt.getTime()) / MS_PER_DAY),
    })),
    doneWithoutMergedPr,
  };
}
