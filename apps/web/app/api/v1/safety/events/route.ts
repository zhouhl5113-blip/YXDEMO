import { AppError } from "../../../../../../../packages/contracts/src/index.ts";
import { apiError, NO_STORE_HEADERS } from "../../../../../lib/local-api.ts";
import { getLocalSafetyInbox } from "../../../../../lib/local-safety-store.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const roleId = new URL(request.url).searchParams.get("roleId")?.trim();
    if (!roleId) {
      throw new AppError({
        code: "QUERY_PARAMETER_REQUIRED",
        category: "VALIDATION",
        message: "roleId 不能为空",
        retryable: false,
      });
    }
    return Response.json(getLocalSafetyInbox(roleId), { headers: NO_STORE_HEADERS });
  } catch (error) {
    return apiError(error);
  }
}
