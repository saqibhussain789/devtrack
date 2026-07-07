import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { getProjectMetrics } from "./metrics.service";

export const getProjectMetricsHandler = asyncHandler(async (req, res) => {
  const { days } = req.query as unknown as { days: number };
  const result = await getProjectMetrics(req.params.id as string, days);
  ApiResponse.success(res, req, result);
});
