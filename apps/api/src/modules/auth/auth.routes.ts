import { Router } from "express";
import { loginSchema, registerSchema } from "@repo/shared";
import { validate } from "../../middleware/validate.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { authRateLimiter } from "../../middleware/rate-limit.middleware";
import { githubAuthorize, githubCallback, login, logout, me, refresh, register } from "./auth.controller";

const router = Router();

router.post("/auth/register", authRateLimiter, validate(registerSchema), register);
router.post("/auth/login", authRateLimiter, validate(loginSchema), login);
router.post("/auth/refresh", authRateLimiter, refresh);
router.post("/auth/logout", logout);
router.get("/auth/github", authRateLimiter, githubAuthorize);
router.get("/auth/github/callback", authRateLimiter, githubCallback);
router.get("/me", requireAuth, me);

export default router;
