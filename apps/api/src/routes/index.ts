import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import workspaceRoutes from "../modules/workspaces/workspace.routes";
import projectRoutes from "../modules/projects/project.routes";
import taskRoutes from "../modules/tasks/task.routes";
import healthRoutes from "./health.routes";

const router = Router();

router.use(healthRoutes);
router.use(authRoutes);
router.use(workspaceRoutes);
router.use(projectRoutes);
router.use(taskRoutes);

export default router;
