import { z } from "zod";

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(220),
  description: z.string().trim().max(5000).optional(),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  storyPoints: z.number().int().min(0).max(100).optional(),
  assigneeId: z.string().uuid().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(220).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    storyPoints: z.number().int().min(0).max(100).nullable().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to update." });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const moveTaskSchema = z.object({
  statusId: z.string().uuid(),
  sortOrder: z.number().finite(),
});

export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty.").max(4000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
