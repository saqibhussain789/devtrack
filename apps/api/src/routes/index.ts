import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import workspaceRoutes from "../modules/workspaces/workspace.routes";
import healthRoutes from "./health.routes";

const router = Router();

router.use(healthRoutes);
router.use(authRoutes);
router.use(workspaceRoutes);

export default router;
