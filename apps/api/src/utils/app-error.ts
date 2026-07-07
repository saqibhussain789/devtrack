export interface AppErrorField {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fields?: AppErrorField[];

  constructor(statusCode: number, code: string, message: string, fields?: AppErrorField[]) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }

  static badRequest(message: string, fields?: AppErrorField[]) {
    return new AppError(400, "VALIDATION_ERROR", message, fields);
  }

  static unauthorized(message = "Authentication is required.") {
    return new AppError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message = "You do not have permission to perform this action.") {
    return new AppError(403, "FORBIDDEN", message);
  }

  static notFound(message = "Resource not found.") {
    return new AppError(404, "NOT_FOUND", message);
  }

  static conflict(message: string) {
    return new AppError(409, "CONFLICT", message);
  }

  static tooManyRequests(message = "Too many requests. Try again later.") {
    return new AppError(429, "RATE_LIMITED", message);
  }
}
