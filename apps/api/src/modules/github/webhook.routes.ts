import { Router } from "express";
import { receiveGithubWebhook } from "./github.controller";

// Mounted at "/webhooks" in routes/index.ts. Deliberately unauthenticated (Bearer
// tokens don't apply here) — the HMAC signature check inside processGithubWebhook
// is the trust boundary instead.
const router = Router();

router.post("/github", receiveGithubWebhook);

export default router;
