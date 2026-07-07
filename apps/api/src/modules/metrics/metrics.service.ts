import { prisma } from "../../lib/prisma";

const MS_PER_HOUR = 1000 * 60 * 60;
const WEEKLY_VELOCITY_WEEKS = 6;

function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday-anchored week
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round2(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

/**
 * Computes metrics for the trailing `days` window and upserts a MetricSnapshot
 * as both a cache and a history record. Two of these six numbers are
 * deliberate approximations given what the schema actually captures:
 *
 * - `leadTimeHours` is the classic DORA "lead time for changes" (commit authored
 *   -> deployed), but nothing in this schema records when a commit was authored,
 *   only when a Deployment was queued/finished. So this reports avg deployment
 *   *pipeline duration* (queued -> finished) instead, surfaced in the UI as
 *   "Avg. deploy duration" rather than mislabeled as true lead time.
 * - `mttrHours` is the time from a failed deployment to the next successful
 *   deployment of the *same environment*, which is a reasonable proxy for
 *   mean-time-to-recovery without needing a separate incident-tracking model.
 */
export async function getProjectMetrics(projectId: string, days: number) {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - days * 24 * MS_PER_HOUR);

  const [velocityAgg, openPrCount, deployments] = await Promise.all([
    prisma.task.aggregate({
      where: { projectId, completedAt: { gte: periodStart, lte: periodEnd } },
      _sum: { storyPoints: true },
    }),
    prisma.pullRequest.count({ where: { projectId, state: "OPEN" } }),
    prisma.deployment.findMany({
      where: { projectId, createdAt: { gte: periodStart, lte: periodEnd } },
      orderBy: { createdAt: "asc" },
      select: { environment: true, status: true, startedAt: true, finishedAt: true, createdAt: true },
    }),
  ]);

  const velocityPoints = velocityAgg._sum.storyPoints ?? 0;

  const successDeploys = deployments.filter((d) => d.status === "SUCCESS");
  const failedDeploys = deployments.filter((d) => d.status === "FAILED");
  const terminalCount = successDeploys.length + failedDeploys.length;

  const deployFrequency = successDeploys.length / days;

  const changeFailureRate = terminalCount === 0 ? null : (failedDeploys.length / terminalCount) * 100;

  const deployDurationsHours = successDeploys
    .filter((d) => d.startedAt && d.finishedAt)
    .map((d) => (d.finishedAt!.getTime() - d.startedAt!.getTime()) / MS_PER_HOUR);
  const leadTimeHours = average(deployDurationsHours);

  // For each failure, find the next successful deploy to the *same* environment
  // anywhere in the (already fetched, createdAt-ascending) deployment history.
  const recoveryHours: number[] = [];
  for (const failure of failedDeploys) {
    if (!failure.finishedAt) continue;
    const recovery = deployments.find(
      (d) =>
        d.environment === failure.environment &&
        d.status === "SUCCESS" &&
        d.finishedAt &&
        d.finishedAt.getTime() > failure.finishedAt!.getTime()
    );
    if (recovery?.finishedAt) {
      recoveryHours.push((recovery.finishedAt.getTime() - failure.finishedAt.getTime()) / MS_PER_HOUR);
    }
  }
  const mttrHours = average(recoveryHours);

  const snapshot = await prisma.metricSnapshot.upsert({
    where: { projectId_periodStart_periodEnd: { projectId, periodStart, periodEnd } },
    create: {
      projectId,
      periodStart,
      periodEnd,
      velocityPoints,
      openPrCount,
      deployFrequency: round2(deployFrequency) ?? 0,
      leadTimeHours: round2(leadTimeHours),
      changeFailureRate: round2(changeFailureRate),
      mttrHours: round2(mttrHours),
    },
    update: {
      velocityPoints,
      openPrCount,
      deployFrequency: round2(deployFrequency) ?? 0,
      leadTimeHours: round2(leadTimeHours),
      changeFailureRate: round2(changeFailureRate),
      mttrHours: round2(mttrHours),
    },
  });

  const weeklyVelocity = await getWeeklyVelocity(projectId);

  return { snapshot, weeklyVelocity };
}

async function getWeeklyVelocity(projectId: string) {
  const now = new Date();
  const earliestWeekStart = startOfWeek(
    new Date(now.getTime() - (WEEKLY_VELOCITY_WEEKS - 1) * 7 * 24 * MS_PER_HOUR)
  );

  const tasks = await prisma.task.findMany({
    where: { projectId, completedAt: { gte: earliestWeekStart } },
    select: { completedAt: true, storyPoints: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < WEEKLY_VELOCITY_WEEKS; i++) {
    const weekStart = new Date(earliestWeekStart.getTime() + i * 7 * 24 * MS_PER_HOUR);
    buckets.set(weekStart.toISOString().slice(0, 10), 0);
  }

  for (const task of tasks) {
    if (!task.completedAt) continue;
    const weekKey = startOfWeek(task.completedAt).toISOString().slice(0, 10);
    if (buckets.has(weekKey)) {
      buckets.set(weekKey, (buckets.get(weekKey) ?? 0) + (task.storyPoints ?? 0));
    }
  }

  return Array.from(buckets.entries()).map(([weekStart, points]) => ({ weekStart, points }));
}
