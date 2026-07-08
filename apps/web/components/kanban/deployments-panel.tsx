"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { DeploymentStatusBadge } from "./deployment-status-badge";
import type { DeploymentEnvironment, DeploymentSummary } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const ENVIRONMENTS: DeploymentEnvironment[] = ["DEV", "STAGING", "PROD"];

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function DeploymentsPanel({
  projectId,
  role,
  accessToken,
}: {
  projectId: string;
  role: string | undefined;
  accessToken: string;
}) {
  const canManageToken = role === "OWNER" || role === "ADMIN";
  const canLog = canManageToken || role === "DEVELOPER";

  const [deployments, setDeployments] = useState<DeploymentSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [justGeneratedToken, setJustGeneratedToken] = useState<string | null>(null);

  const [environment, setEnvironment] = useState<DeploymentEnvironment>("DEV");
  const [commitSha, setCommitSha] = useState("");
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const loadDeployments = useCallback(async () => {
    try {
      const data = await apiFetch<DeploymentSummary[]>(`/projects/${projectId}/deployments`, { accessToken });
      setDeployments(data);
      setListError(null);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Unable to load deployments.");
    }
  }, [projectId, accessToken]);

  useEffect(() => {
    loadDeployments();
  }, [loadDeployments]);

  async function handleGenerateToken() {
    setGenerating(true);
    setTokenError(null);

    try {
      const result = await apiFetch<{ deployToken: string }>(`/projects/${projectId}/deploy-token`, {
        method: "POST",
        accessToken,
      });
      setJustGeneratedToken(result.deployToken);
    } catch (err) {
      setTokenError(err instanceof ApiError ? err.message : "Unable to generate a deploy token.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleLogDeployment(event: FormEvent) {
    event.preventDefault();
    if (!commitSha.trim()) return;

    setLogging(true);
    setLogError(null);

    try {
      await apiFetch(`/projects/${projectId}/deployments`, {
        method: "POST",
        accessToken,
        body: { environment, commitSha: commitSha.trim() },
      });
      setCommitSha("");
      await loadDeployments();
    } catch (err) {
      setLogError(err instanceof ApiError ? err.message : "Unable to log deployment.");
    } finally {
      setLogging(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {justGeneratedToken && (
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-5">
          <h3 className="text-sm font-semibold text-ink">
            Deploy token generated — this is shown only once
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            Have your CI pipeline report deployment status with this token:
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="font-medium text-ink">Report URL</dt>
              <dd className="font-mono text-xs text-ink-muted">
                POST {API_URL}/deploy/{projectId}/report
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Header</dt>
              <dd className="font-mono text-xs text-ink-muted">
                X-Deploy-Token: {justGeneratedToken}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Body</dt>
              <dd className="font-mono text-xs text-ink-muted">
                {"{ \"environment\": \"PROD\", \"commitSha\": \"<sha>\", \"status\": \"SUCCESS\" }"}
              </dd>
            </div>
          </dl>
          <button
            onClick={() => setJustGeneratedToken(null)}
            className="mt-4 rounded-lg border border-brand/30 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10"
          >
            I&apos;ve saved it
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Deployments</h2>

          <div className="flex items-center gap-3">
            {canLog && (
              <form onSubmit={handleLogDeployment} className="flex items-center gap-2">
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as DeploymentEnvironment)}
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand"
                >
                  {ENVIRONMENTS.map((env) => (
                    <option key={env} value={env}>
                      {env}
                    </option>
                  ))}
                </select>
                <input
                  required
                  placeholder="commit sha"
                  value={commitSha}
                  onChange={(e) => setCommitSha(e.target.value)}
                  className="w-32 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand"
                />
                <button
                  type="submit"
                  disabled={logging}
                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {logging ? "Logging…" : "Log deploy"}
                </button>
              </form>
            )}

            {canManageToken && (
              <button
                onClick={handleGenerateToken}
                disabled={generating}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-border/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? "Generating…" : "Generate CI token"}
              </button>
            )}
          </div>
        </div>

        {tokenError && <p className="px-5 pt-3 text-sm text-status-blocked">{tokenError}</p>}
        {logError && <p className="px-5 pt-3 text-sm text-status-blocked">{logError}</p>}
        {listError && <p className="px-5 py-4 text-sm text-status-blocked">{listError}</p>}

        <div className="flex flex-col divide-y divide-border">
          {deployments.map((deployment) => (
            <div key={deployment.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-ink">
                  <span className="mr-2 rounded bg-border/50 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
                    {deployment.environment}
                  </span>
                  <span className="font-mono text-xs text-ink-muted">
                    {deployment.commitSha.slice(0, 10)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {deployment.triggeredBy ? `by ${deployment.triggeredBy.name}` : "via CI"} · started{" "}
                  {formatTimestamp(deployment.startedAt)} · finished {formatTimestamp(deployment.finishedAt)}
                  {deployment.failureReason && ` · ${deployment.failureReason}`}
                </p>
              </div>
              <DeploymentStatusBadge status={deployment.status} />
            </div>
          ))}

          {deployments.length === 0 && !listError && (
            <p className="px-5 py-6 text-sm text-ink-muted">No deployments logged yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
