export type ErrorCategory =
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "CONFLICT"
  | "NOT_FOUND"
  | "SECURITY"
  | "UPSTREAM"
  | "VALIDATION";

export interface AppErrorOptions {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly message: string;
  readonly retryable: boolean;
  readonly requestId?: string;
  readonly upstreamReference?: string;
  readonly cause?: unknown;
}

export interface AppErrorContract {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly message: string;
  readonly retryable: boolean;
  readonly requestId?: string;
  readonly upstreamReference?: string;
}

export class AppError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly requestId: string | undefined;
  readonly upstreamReference: string | undefined;

  constructor(options: AppErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.category = options.category;
    this.retryable = options.retryable;
    this.requestId = options.requestId;
    this.upstreamReference = options.upstreamReference;
  }

  toJSON(): AppErrorContract {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      retryable: this.retryable,
      ...(this.requestId === undefined ? {} : { requestId: this.requestId }),
      ...(this.upstreamReference === undefined
        ? {}
        : { upstreamReference: this.upstreamReference }),
    };
  }
}
