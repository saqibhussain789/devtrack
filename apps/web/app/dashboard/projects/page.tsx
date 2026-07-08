"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status: string;
  createdAt: string;
}

export default function ProjectsPage() {
  const { user, accessToken } = useAuth();
  const workspace = user?.memberships[0]?.workspace;
  const role = user?.memberships[0]?.role;
  const canCreate = role === "OWNER" || role === "ADMIN";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!workspace || !accessToken) return;

    try {
      const data = await apiFetch<Project[]>(`/projects?workspaceId=${workspace.id}`, { accessToken });
      setProjects(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Unable to load projects.");
    }
  }, [workspace, accessToken]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !accessToken) return;

    setCreating(true);
    setCreateError(null);

    try {
      await apiFetch("/projects", {
        method: "POST",
        accessToken,
        body: { workspaceId: workspace.id, name, key },
      });
      setName("");
      setKey("");
      await loadProjects();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Unable to create project.");
    } finally {
      setCreating(false);
    }
  }

  if (!user || !workspace) {
    return null;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Projects</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Each project gets a Kanban board with To Do, In Progress, and Done lanes.
        </p>
      </div>

      {loadError && <p className="text-sm text-status-blocked">{loadError}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/dashboard/projects/${project.id}`}
            className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand/60"
          >
            <span className="inline-flex rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
              {project.key}
            </span>
            <h2 className="mt-3 text-sm font-semibold text-ink">{project.name}</h2>
            {project.description && (
              <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{project.description}</p>
            )}
          </Link>
        ))}

        {projects.length === 0 && !loadError && (
          <p className="col-span-full text-sm text-ink-muted">No projects yet.</p>
        )}
      </div>

      {canCreate && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">New project</h2>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <label htmlFor="project-name" className="text-xs font-medium text-ink-muted">
                Name
              </label>
              <input
                id="project-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div className="flex w-32 flex-col gap-1.5">
              <label htmlFor="project-key" className="text-xs font-medium text-ink-muted">
                Key
              </label>
              <input
                id="project-key"
                required
                placeholder="DEV"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm uppercase text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create project"}
            </button>
          </form>
          {createError && <p className="mt-3 text-sm text-status-blocked">{createError}</p>}
        </section>
      )}
    </div>
  );
}
