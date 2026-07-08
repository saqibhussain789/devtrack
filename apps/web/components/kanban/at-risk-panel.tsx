"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import type { AtRiskData } from "./types";

export function AtRiskPanel({
  projectId,
  projectKey,
  accessToken,
}: {
  projectId: string;
  projectKey: string;
  accessToken: string;
}) {
  const [data, setData] = useState<AtRiskData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<AtRiskData>(`/projects/${projectId}/insights/at-risk`, { accessToken });
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load at-risk items.");
    }
  }, [projectId, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <p className="text-sm text-status-blocked">{error}</p>;
  }

  if (!data) return null;

  const totalRisks = data.stalePrs.length + data.doneWithoutMergedPr.length;
  if (totalRisks === 0) return null;

  return (
    <section className="rounded-xl border border-status-blocked/30 bg-status-blocked/5">
      <div className="border-b border-status-blocked/20 px-5 py-4">
        <h2 className="text-sm font-semibold text-status-blocked">At risk ({totalRisks})</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Work that looks stuck — a quiet open pull request, or a task marked done without a merged PR behind it.
        </p>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {data.stalePrs.map((pr) => (
          <div key={pr.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <div>
              <a
                href={pr.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-ink transition-colors hover:text-brand"
              >
                #{pr.number} {pr.title}
              </a>
              <p className="mt-1 text-xs text-ink-muted">opened by {pr.authorLogin}</p>
            </div>
            <span className="whitespace-nowrap text-xs font-medium text-status-blocked">idle {pr.idleDays}d</span>
          </div>
        ))}

        {data.doneWithoutMergedPr.map((task) => (
          <div key={task.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <p className="font-medium text-ink">
              {projectKey}-{task.taskNumber} {task.title}
            </p>
            <span className="whitespace-nowrap text-xs font-medium text-status-blocked">done, not merged</span>
          </div>
        ))}
      </div>
    </section>
  );
}
