import { Router } from "express";
import { publicIntegrationRateLimiter } from "../../middleware/rate-limit.middleware";
import { receiveGithubWebhook } from "./github.controller";

// Mounted at "/webhooks" in routes/index.ts. Deliberately unauthenticated (Bearer
// tokens don't apply here) — the HMAC signature check inside processGithubWebhook
// is the trust boundary instead. Rate-limited on top of that, since a secret is
// the only thing standing between an attacker and brute-forcing this route.
const router = Router();

router.post("/github", publicIntegrationRateLimiter, receiveGithubWebhook);

export default router;
