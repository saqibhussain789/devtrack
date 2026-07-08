"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { DeploymentStatusBadge } from "../../../components/kanban/deployment-status-badge";
import type { DeploymentEnvironment, WorkspaceDeploymentSummary } from "../../../components/kanban/types";

const ENVIRONMENTS: DeploymentEnvironment[] = ["DEV", "STAGING", "PROD"];

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function DeploymentsPage() {
  const { user, accessToken } = useAuth();
  const workspace = user?.memberships[0]?.workspace;

  const [deployments, setDeployments] = useState<WorkspaceDeploymentSummary[]>([]);
  const [environment, setEnvironment] = useState<DeploymentEnvironment | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspace || !accessToken) return;

    try {
      const query = environment === "ALL" ? "" : `?environment=${environment}`;
      const data = await apiFetch<WorkspaceDeploymentSummary[]>(`/workspaces/${workspace.id}/deployments${query}`, {
        accessToken,
      });
      setDeployments(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load deployments.");
    }
  }, [workspace, accessToken, environment]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user || !workspace) {
    return null;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Deployments</h1>
        <p className="mt-1 text-sm text-ink-muted">
          The deployment log across every project in {workspace.name}, most recent first.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="environment-filter" className="text-xs font-medium text-ink-muted">
          Environment
        </label>
        <select
          id="environment-filter"
          value={environment}
          onChange={(e) => setEnvironment(e.target.value as DeploymentEnvironment | "ALL")}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        >
          <option value="ALL">All</option>
          {ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>
              {env}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-status-blocked">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-5 py-3 font-medium">Project</th>
              <th className="px-5 py-3 font-medium">Environment</th>
              <th className="px-5 py-3 font-medium">Commit</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Triggered by</th>
              <th className="px-5 py-3 font-medium">Finished</th>
            </tr>
          </thead>
          <tbody>
            {deployments.map((deployment) => (
              <tr key={deployment.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3">
                  <Link
                    href={`/dashboard/projects/${deployment.project.id}`}
                    className="font-medium text-ink transition-colors hover:text-brand"
                  >
                    {deployment.project.key}
                  </Link>
                </td>
                <td className="px-5 py-3 text-ink-muted">{deployment.environment}</td>
                <td className="px-5 py-3 font-mono text-xs text-ink-muted">{deployment.commitSha.slice(0, 10)}</td>
                <td className="px-5 py-3">
                  <DeploymentStatusBadge status={deployment.status} />
                </td>
                <td className="px-5 py-3 text-ink-muted">
                  {deployment.triggeredBy ? deployment.triggeredBy.name : "via CI"}
                </td>
                <td className="px-5 py-3 text-ink-muted">{formatTimestamp(deployment.finishedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {deployments.length === 0 && !error && (
          <p className="px-5 py-6 text-sm text-ink-muted">No deployments logged yet.</p>
        )}
      </div>
    </div>
  );
}
