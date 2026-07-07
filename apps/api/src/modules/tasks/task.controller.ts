import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { addComment, createTask, getTask, moveTask, updateTask } from "./task.service";

export const createTaskHandler = asyncHandler(async (req, res) => {
  const task = await createTask(req.params.id as string, req.user!.id, req.body);
  ApiResponse.success(res, req, task, 201);
});

export const getTaskHandler = asyncHandler(async (req, res) => {
  const task = await getTask(req.params.id as string);
  ApiResponse.success(res, req, task);
});

export const updateTaskHandler = asyncHandler(async (req, res) => {
  const task = await updateTask(req.params.id as string, req.user!.id, req.body);
  ApiResponse.success(res, req, task);
});

export const moveTaskHandler = asyncHandler(async (req, res) => {
  const task = await moveTask(req.params.id as string, req.user!.id, req.body);
  ApiResponse.success(res, req, task);
});

export const addCommentHandler = asyncHandler(async (req, res) => {
  const comment = await addComment(req.params.id as string, req.user!.id, req.body);
  ApiResponse.success(res, req, comment, 201);
});
