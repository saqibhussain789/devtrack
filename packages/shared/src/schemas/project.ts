import { z } from "zod";

export const createProjectSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1, "Project name is required.").max(180),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,11}$/, "Key must be 2-12 letters/numbers, starting with a letter (e.g. DEV)."),
  description: z.string().trim().max(2000).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const listProjectsQuerySchema = z.object({
  workspaceId: z.string().uuid(),
});
