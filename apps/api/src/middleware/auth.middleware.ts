import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error";
import { verifyAccessToken } from "../modules/auth/token.util";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(AppError.unauthorized());
  }

  try {
    const payload = await verifyAccessToken(header.slice("Bearer ".length));
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    next(err);
  }
}
