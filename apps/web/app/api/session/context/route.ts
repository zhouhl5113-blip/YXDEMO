import { AppError } from "../../../../../../packages/contracts/src/index.ts";
import { createLocalWorkbenchContext, LOCAL_ROLE_OPTIONS } from "../../../../lib/local-session.ts";

export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 1024;
const NO_STORE_HEADERS = { "cache-control": "no-store" } as const;

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json(
    {
      code,
      category: "VALIDATION",
      message,
      retryable: false,
    },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse("CROSS_SITE_REQUEST_REJECTED", "不接受跨站角色请求", 403);
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return errorResponse("UNSUPPORTED_MEDIA_TYPE", "请求必须使用 application/json", 415);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return errorResponse("REQUEST_BODY_TOO_LARGE", "请求体超过允许大小", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("INVALID_JSON", "请求不是有效 JSON", 400);
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("INVALID_REQUEST_BODY", "请求体必须是 JSON 对象", 400);
  }

  try {
    const requestBody = body as Record<string, unknown>;
    const roleId = typeof requestBody.roleId === "string" ? requestBody.roleId : "";
    const browserTenantId =
      typeof requestBody.tenant_id === "string" ? requestBody.tenant_id : undefined;
    const context = createLocalWorkbenchContext(
      roleId,
      request.headers.get("x-request-id") ?? undefined,
      request.headers.get("traceparent")?.split("-")[1] ?? undefined,
      browserTenantId,
    );

    return Response.json(
      {
        tenantId: context.tenantScope.tenantId,
        selectedRoleId: context.selectedRoleId,
        roleOptions: LOCAL_ROLE_OPTIONS,
        requestId: context.requestId,
        traceId: context.traceId,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(error.toJSON(), {
        status:
          error.category === "AUTHENTICATION" ? 401 : error.category === "VALIDATION" ? 400 : 403,
        headers: NO_STORE_HEADERS,
      });
    }
    return Response.json(
      {
        code: "LOCAL_SESSION_UNAVAILABLE",
        category: "AUTHENTICATION",
        message: "本地开发会话不可用",
        retryable: false,
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
