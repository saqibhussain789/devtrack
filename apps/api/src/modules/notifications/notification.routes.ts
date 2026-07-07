import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import {
  listNotificationsHandler,
  markAllNotificationsReadHandler,
  markNotificationReadHandler,
} from "./notification.controller";

// Mounted at "/notifications" — its own prefix, so requireAuth here can never
// leak onto a sibling public router (see routes/index.ts for the general rule).
const router = Router();

router.use(requireAuth);

router.get("/", listNotificationsHandler);
router.patch("/read-all", markAllNotificationsReadHandler);
router.patch("/:id/read", markNotificationReadHandler);

export default router;
