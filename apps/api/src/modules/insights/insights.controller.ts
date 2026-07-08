import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { getAtRiskItems } from "./insights.service";

export const getAtRiskItemsHandler = asyncHandler(async (req, res) => {
  const { stalePrDays } = req.query as unknown as { stalePrDays: number };
  const result = await getAtRiskItems(req.params.id as string, stalePrDays);
  ApiResponse.success(res, req, result);
});
