export interface ApiSuccessResponse<T> {
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export interface ApiFieldError {
  path: string;
  message: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: ApiFieldError[];
  };
  meta: {
    requestId: string;
  };
}
