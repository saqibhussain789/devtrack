export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TaskSummary {
  id: string;
  taskNumber: number;
  title: string;
  priority: TaskPriority;
  storyPoints: number | null;
  completedAt: string | null;
  sortOrder: number;
  assignee: { id: string; name: string; email: string } | null;
}

export interface StatusColumn {
  id: string;
  name: string;
  category: "TODO" | "IN_PROGRESS" | "DONE";
  sortOrder: number;
  isDefault: boolean;
  tasks: TaskSummary[];
}

export interface ConnectedRepository {
  id: string;
  owner: string;
  repo: string;
  defaultBranch: string;
}

export interface BoardData {
  project: {
    id: string;
    name: string;
    key: string;
    description: string | null;
    status: string;
    workspaceId: string;
    repository: ConnectedRepository | null;
  };
  statuses: StatusColumn[];
}

export interface PullRequestSummary {
  id: string;
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  authorLogin: string;
  mergedAt: string | null;
  syncedAt: string;
  task: { id: string; taskNumber: number; title: string } | null;
}

export type DeploymentEnvironment = "DEV" | "STAGING" | "PROD";
export type DeploymentStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELED";

export interface DeploymentSummary {
  id: string;
  environment: DeploymentEnvironment;
  commitSha: string;
  imageTag: string | null;
  status: DeploymentStatus;
  startedAt: string | null;
  finishedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  triggeredBy: { id: string; name: string; email: string } | null;
}

export interface TaskComment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
}

export interface TaskDetail extends TaskSummary {
  projectId: string;
  description: string | null;
  reporter: { id: string; name: string; email: string };
  comments: TaskComment[];
  createdAt: string;
  updatedAt: string;
}
