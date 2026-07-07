import { z } from "zod";

export const connectRepositorySchema = z.object({
  owner: z.string().trim().min(1, "Owner is required.").max(120),
  repo: z.string().trim().min(1, "Repository name is required.").max(160),
  defaultBranch: z.string().trim().min(1).max(120).default("main"),
});

export type ConnectRepositoryInput = z.infer<typeof connectRepositorySchema>;
