import { AppError } from "../../../packages/contracts/src/index.ts";

export const NO_STORE_HEADERS = { "cache-control": "no-store" } as const;

const MAX_REQUEST_BYTES = 16 * 1024;

export function assertLocalApiRuntime(): void {
  if (process.env.NODE_ENV === "production") {
    throw new AppError({
      code: "LOCAL_API_DISABLED",
      category: "AUTHORIZATION",
      message: "本地开发接口在生产运行时关闭",
      retryable: false,
    });
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AppError({
      code: "CROSS_SITE_REQUEST_REJECTED",
      category: "AUTHORIZATION",
      message: "不接受跨站请求",
      retryable: false,
    });
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new AppError({
      code: "UNSUPPORTED_MEDIA_TYPE",
      category: "VALIDATION",
      message: "请求必须使用 application/json",
      retryable: false,
    });
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    throw new AppError({
      code: "REQUEST_BODY_TOO_LARGE",
      category: "VALIDATION",
      message: "请求体超过允许大小",
      retryable: false,
    });
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new AppError({
      code: "INVALID_JSON",
      category: "VALIDATION",
      message: "请求不是有效 JSON",
      retryable: false,
    });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError({
      code: "INVALID_REQUEST_BODY",
      category: "VALIDATION",
      message: "请求体必须是 JSON 对象",
      retryable: false,
    });
  }
  return body as Record<string, unknown>;
}

export function requiredString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError({
      code: "INVALID_REQUEST_FIELD",
      category: "VALIDATION",
      message: `${field} 必须是非空字符串`,
      retryable: false,
    });
  }
  return value.trim();
}

export function apiError(error: unknown): Response {
  if (error instanceof AppError) {
    const status =
      error.code === "UNSUPPORTED_MEDIA_TYPE"
        ? 415
        : error.code === "REQUEST_BODY_TOO_LARGE"
          ? 413
          : error.category === "AUTHENTICATION"
            ? 401
            : error.category === "AUTHORIZATION"
              ? 403
              : error.category === "NOT_FOUND"
                ? 404
                : error.category === "CONFLICT"
                  ? 409
                  : 400;
    return Response.json(error.toJSON(), { status, headers: NO_STORE_HEADERS });
  }
  return Response.json(
    {
      code: "LOCAL_API_UNAVAILABLE",
      category: "UPSTREAM",
      message: "本地开发接口暂时不可用",
      retryable: true,
    },
    { status: 503, headers: NO_STORE_HEADERS },
  );
}
