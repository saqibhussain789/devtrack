"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { PrStateBadge } from "./pr-state-badge";
import type { BoardData, PullRequestSummary } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

interface JustConnected {
  owner: string;
  repo: string;
  webhookSecret: string;
}

export function GitHubPanel({
  project,
  role,
  accessToken,
  onConnected,
}: {
  project: BoardData["project"];
  role: string | undefined;
  accessToken: string;
  onConnected: () => void;
}) {
  const canConnect = role === "OWNER" || role === "ADMIN";

  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState<JustConnected | null>(null);

  const [pullRequests, setPullRequests] = useState<PullRequestSummary[]>([]);
  const [prError, setPrError] = useState<string | null>(null);

  const loadPullRequests = useCallback(async () => {
    try {
      const data = await apiFetch<PullRequestSummary[]>(`/projects/${project.id}/pull-requests`, { accessToken });
      setPullRequests(data);
      setPrError(null);
    } catch (err) {
      setPrError(err instanceof ApiError ? err.message : "Unable to load pull requests.");
    }
  }, [project.id, accessToken]);

  useEffect(() => {
    if (project.repository) {
      loadPullRequests();
    }
  }, [project.repository, loadPullRequests]);

  async function handleConnect(event: FormEvent) {
    event.preventDefault();
    setConnecting(true);
    setConnectError(null);

    try {
      const result = await apiFetch<{ owner: string; repo: string; webhookSecret: string }>(
        `/projects/${project.id}/repository`,
        { method: "POST", accessToken, body: { owner, repo } }
      );
      setJustConnected(result);
      onConnected();
    } catch (err) {
      setConnectError(err instanceof ApiError ? err.message : "Unable to connect repository.");
    } finally {
      setConnecting(false);
    }
  }

  if (!project.repository && !justConnected) {
    if (!canConnect) {
      return (
        <section className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">GitHub</h2>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            No repository connected yet. Ask a workspace admin to connect one.
          </p>
        </section>
      );
    }

    return (
      <section className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <h2 className="mb-4 text-sm font-semibold text-stone-900 dark:text-stone-100">Connect a GitHub repository</h2>
        <form onSubmit={handleConnect} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-600 dark:text-stone-300">Owner</label>
            <input
              required
              placeholder="acme-org"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-600 dark:text-stone-300">Repository</label>
            <input
              required
              placeholder="devtrack"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            />
          </div>
          <button
            type="submit"
            disabled={connecting}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {connecting ? "Connecting…" : "Connect"}
          </button>
        </form>
        {connectError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{connectError}</p>}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {justConnected && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-500/10">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Finish setup on GitHub — this secret is shown only once
          </h3>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            On {justConnected.owner}/{justConnected.repo} → Settings → Webhooks → Add webhook:
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="font-medium text-amber-900 dark:text-amber-100">Payload URL</dt>
              <dd className="font-mono text-xs text-amber-800 dark:text-amber-200">{API_URL}/webhooks/github</dd>
            </div>
            <div>
              <dt className="font-medium text-amber-900 dark:text-amber-100">Content type</dt>
              <dd className="font-mono text-xs text-amber-800 dark:text-amber-200">application/json</dd>
            </div>
            <div>
              <dt className="font-medium text-amber-900 dark:text-amber-100">Secret</dt>
              <dd className="font-mono text-xs text-amber-800 dark:text-amber-200">{justConnected.webhookSecret}</dd>
            </div>
            <div>
              <dt className="font-medium text-amber-900 dark:text-amber-100">Events</dt>
              <dd className="text-xs text-amber-800 dark:text-amber-200">Just the &ldquo;Pull requests&rdquo; event</dd>
            </div>
          </dl>
          <button
            onClick={() => setJustConnected(null)}
            className="mt-4 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-500/20"
          >
            I&apos;ve saved it
          </button>
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-800">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Pull requests
            {project.repository && (
              <span className="ml-2 font-normal text-stone-400">
                {project.repository.owner}/{project.repository.repo}
              </span>
            )}
          </h2>
        </div>

        {prError && <p className="px-5 py-4 text-sm text-red-600 dark:text-red-400">{prError}</p>}

        <div className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800/60">
          {pullRequests.map((pr) => (
            <a
              key={pr.id}
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-stone-50 dark:hover:bg-stone-800/40"
            >
              <div>
                <p className="font-medium text-stone-900 dark:text-stone-100">
                  #{pr.number} {pr.title}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  by {pr.authorLogin}
                  {pr.task && ` · linked to task #${pr.task.taskNumber}`}
                </p>
              </div>
              <PrStateBadge state={pr.state} />
            </a>
          ))}

          {pullRequests.length === 0 && !prError && (
            <p className="px-5 py-6 text-sm text-stone-400">No pull requests synced yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
