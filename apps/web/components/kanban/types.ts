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

export interface BoardData {
  project: {
    id: string;
    name: string;
    key: string;
    description: string | null;
    status: string;
    workspaceId: string;
  };
  statuses: StatusColumn[];
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
