import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import workspaceRoutes from "../modules/workspaces/workspace.routes";
import projectRoutes from "../modules/projects/project.routes";
import taskRoutes from "../modules/tasks/task.routes";
import githubRoutes from "../modules/github/github.routes";
import webhookRoutes from "../modules/github/webhook.routes";
import deploymentRoutes from "../modules/deployments/deployment.routes";
import deploymentReportRoutes from "../modules/deployments/deployment-report.routes";
import notificationRoutes from "../modules/notifications/notification.routes";
import metricsRoutes from "../modules/metrics/metrics.routes";
import insightsRoutes from "../modules/insights/insights.routes";
import healthRoutes from "./health.routes";

const router = Router();

// health and auth apply their own (per-route, where needed) auth checks and
// have no shared path prefix, so they stay mounted at "/" like before.
router.use(healthRoutes);
router.use(authRoutes);

// Everything else is mounted at an explicit prefix so each router's blanket
// `router.use(requireAuth)` only ever sees requests actually meant for it —
// mounting multiple `router.use(requireAuth)` routers at "/" would otherwise let
// an earlier router's auth check intercept a later, differently-scoped router's
// routes (this bit the public GitHub webhook route: workspaceRoutes' requireAuth
// was rejecting unauthenticated `/webhooks/github` requests before they ever
// reached webhookRoutes).
router.use("/workspaces", workspaceRoutes);
router.use("/projects", projectRoutes);
router.use("/projects", githubRoutes);
router.use("/projects", deploymentRoutes);
router.use("/projects", metricsRoutes);
router.use("/projects", insightsRoutes);
router.use("/tasks", taskRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/deploy", deploymentReportRoutes);
router.use("/notifications", notificationRoutes);

export default router;
