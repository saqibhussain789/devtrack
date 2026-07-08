import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { AppError, type AppErrorField } from "../utils/app-error";

type ValidationTarget = "body" | "params" | "query";

function toFieldErrors(error: ZodError): AppErrorField[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function validate(schema: ZodType, target: ValidationTarget = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      return next(
        AppError.badRequest("Request data is invalid.", toFieldErrors(result.error))
      );
    }

    if (target === "query") {
      // Express 5's req.query is a getter that re-derives a fresh object from
      // the raw querystring on every access, so Object.assign(req.query, ...)
      // silently mutates a throwaway snapshot — a later `req.query` read (e.g.
      // in the controller) sees the original, un-defaulted/un-coerced value.
      // Shadowing it with an own property is the only way to make a parsed
      // default (e.g. a missing optional query param) actually reach the
      // controller.
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } else {
      req[target] = result.data;
    }

    next();
  };
}
