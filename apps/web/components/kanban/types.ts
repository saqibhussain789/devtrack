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

export interface WorkspaceDeploymentSummary extends DeploymentSummary {
  project: { id: string; name: string; key: string };
}

export interface StalePullRequest {
  id: string;
  number: number;
  title: string;
  url: string;
  authorLogin: string;
  syncedAt: string;
  idleDays: number;
  taskId: string | null;
}

export interface AtRiskDoneTask {
  id: string;
  taskNumber: number;
  title: string;
  completedAt: string | null;
}

export interface AtRiskData {
  stalePrs: StalePullRequest[];
  doneWithoutMergedPr: AtRiskDoneTask[];
}

export interface TaskComment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
}