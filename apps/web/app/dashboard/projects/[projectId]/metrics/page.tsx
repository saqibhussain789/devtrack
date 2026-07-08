"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../../../lib/api";
import { useAuth } from "../../../../../lib/auth-context";
import { StatTile } from "../../../../../components/metrics/stat-tile";
import { WeeklyVelocityChart } from "../../../../../components/metrics/weekly-velocity-chart";
import type { ProjectMetrics } from "../../../../../components/metrics/types";

function formatNumber(value: string | number | null, suffix = ""): string {
  if (value === null) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  return `${num}${suffix}`;
}

export default function ProjectMetricsPage() {
  const params = useParams<{ projectId: string }>();
  const { accessToken } = useAuth();
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    apiFetch<ProjectMetrics>(`/projects/${params.projectId}/metrics?days=30`, { accessToken })
      .then(setMetrics)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Unable to load metrics."));
  }, [params.projectId, accessToken]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/projects/${params.projectId}`}
          className="text-sm font-medium text-brand hover:text-brand/80"
        >
          ← Back to board
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-ink">Metrics</h1>
        <p className="mt-1 text-sm text-ink-muted">Trailing 30 days.</p>
      </div>

      {error && <p className="text-sm text-status-blocked">{error}</p>}

      {!metrics && !error && <p className="text-sm text-ink-muted">Loading…</p>}

      {metrics && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Velocity" value={formatNumber(metrics.snapshot.velocityPoints, " pts")} />
            <StatTile label="Open PRs" value={formatNumber(metrics.snapshot.openPrCount)} />
            <StatTile label="Deploy frequency" value={formatNumber(metrics.snapshot.deployFrequency, "/day")} />
            <StatTile label="Change failure rate" value={formatNumber(metrics.snapshot.changeFailureRate, "%")} />
            <StatTile label="MTTR" value={formatNumber(metrics.snapshot.mttrHours, "h")} />
            <StatTile
              label="Avg. deploy duration"
              value={formatNumber(metrics.snapshot.leadTimeHours, "h")}
              hint="Queued → finished"
            />
          </div>

          <WeeklyVelocityChart data={metrics.weeklyVelocity} />
        </>
      )}
    </div>
  );
}
