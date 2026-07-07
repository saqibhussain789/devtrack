import { z } from "zod";

export const deploymentEnvironmentSchema = z.enum(["DEV", "STAGING", "PROD"]);
export const deploymentStatusSchema = z.enum(["QUEUED", "RUNNING", "SUCCESS", "FAILED", "CANCELED"]);

export const reportDeploymentSchema = z.object({
  environment: deploymentEnvironmentSchema,
  commitSha: z.string().trim().min(7).max(64),
  status: deploymentStatusSchema,
  imageTag: z.string().trim().max(200).optional(),
  failureReason: z.string().trim().max(2000).optional(),
});

export type ReportDeploymentInput = z.infer<typeof reportDeploymentSchema>;

export const createDeploymentSchema = z.object({
  environment: deploymentEnvironmentSchema,
  commitSha: z.string().trim().min(7).max(64),
  imageTag: z.string().trim().max(200).optional(),
});

export type CreateDeploymentInput = z.infer<typeof createDeploymentSchema>;

export const listDeploymentsQuerySchema = z.object({
  environment: deploymentEnvironmentSchema.optional(),
});

export type ListDeploymentsQuery = z.infer<typeof listDeploymentsQuerySchema>;
