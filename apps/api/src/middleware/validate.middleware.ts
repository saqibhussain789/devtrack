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
      // Express 5 exposes req.query as a getter-only property, so the parsed
      // (coerced/defaulted) result must be merged in rather than reassigned.
      Object.assign(req.query, result.data);
    } else {
      req[target] = result.data;
    }

    next();
  };
}
