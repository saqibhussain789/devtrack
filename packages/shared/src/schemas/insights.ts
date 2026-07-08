import { z } from "zod";

export const atRiskQuerySchema = z.object({
  stalePrDays: z.coerce.number().int().min(1).max(90).default(5),
});

export type AtRiskQuery = z.infer<typeof atRiskQuerySchema>;
