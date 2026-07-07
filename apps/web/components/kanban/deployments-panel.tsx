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
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-500/10">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Deploy token generated — this is shown only once
          </h3>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            Have your CI pipeline report deployment status with this token:
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="font-medium text-amber-900 dark:text-amber-100">Report URL</dt>
              <dd className="font-mono text-xs text-amber-800 dark:text-amber-200">
                POST {API_URL}/deploy/{projectId}/report
              </dd>
            </div>
            <div>
              <dt className="font-medium text-amber-900 dark:text-amber-100">Header</dt>
              <dd className="font-mono text-xs text-amber-800 dark:text-amber-200">
                X-Deploy-Token: {justGeneratedToken}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-amber-900 dark:text-amber-100">Body</dt>
              <dd className="font-mono text-xs text-amber-800 dark:text-amber-200">
                {"{ \"environment\": \"PROD\", \"commitSha\": \"<sha>\", \"status\": \"SUCCESS\" }"}
              </dd>
            </div>
          </dl>
          <button
            onClick={() => setJustGeneratedToken(null)}
            className="mt-4 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-500/20"
          >
            I&apos;ve saved it
          </button>
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4 dark:border-stone-800">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Deployments</h2>

          <div className="flex items-center gap-3">
            {canLog && (
              <form onSubmit={handleLogDeployment} className="flex items-center gap-2">
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as DeploymentEnvironment)}
                  className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs text-stone-900 outline-none focus:border-primary-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
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
                  className="w-32 rounded-lg border border-stone-300 px-2 py-1.5 text-xs text-stone-900 outline-none focus:border-primary-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
                <button
                  type="submit"
                  disabled={logging}
                  className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {logging ? "Logging…" : "Log deploy"}
                </button>
              </form>
            )}

            {canManageToken && (
              <button
                onClick={handleGenerateToken}
                disabled={generating}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
              >
                {generating ? "Generating…" : "Generate CI token"}
              </button>
            )}
          </div>
        </div>

        {tokenError && <p className="px-5 pt-3 text-sm text-red-600 dark:text-red-400">{tokenError}</p>}
        {logError && <p className="px-5 pt-3 text-sm text-red-600 dark:text-red-400">{logError}</p>}
        {listError && <p className="px-5 py-4 text-sm text-red-600 dark:text-red-400">{listError}</p>}

        <div className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800/60">
          {deployments.map((deployment) => (
            <div key={deployment.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-stone-900 dark:text-stone-100">
                  <span className="mr-2 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                    {deployment.environment}
                  </span>
                  <span className="font-mono text-xs text-stone-500 dark:text-stone-400">
                    {deployment.commitSha.slice(0, 10)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  {deployment.triggeredBy ? `by ${deployment.triggeredBy.name}` : "via CI"} · started{" "}
                  {formatTimestamp(deployment.startedAt)} · finished {formatTimestamp(deployment.finishedAt)}
                  {deployment.failureReason && ` · ${deployment.failureReason}`}
                </p>
              </div>
              <DeploymentStatusBadge status={deployment.status} />
            </div>
          ))}

          {deployments.length === 0 && !listError && (
            <p className="px-5 py-6 text-sm text-stone-400">No deployments logged yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
