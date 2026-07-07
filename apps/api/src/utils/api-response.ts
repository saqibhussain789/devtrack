import type { Request, Response } from "express";
import type { AppErrorField } from "./app-error";

export class ApiResponse {
  static success<T>(res: Response, req: Request, data: T, statusCode = 200) {
    return res.status(statusCode).json({
      data,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  static error(
    res: Response,
    req: Request,
    statusCode: number,
    code: string,
    message: string,
    fields?: AppErrorField[]
  ) {
    return res.status(statusCode).json({
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
      },
      meta: {
        requestId: req.requestId,
      },
    });
  }
}
