import { AppError } from "../../../../../../../../packages/contracts/src/index.ts";
import { apiError, NO_STORE_HEADERS } from "../../../../../../lib/local-api.ts";
import { getLocalDispatchTimeline } from "../../../../../../lib/local-dispatch-store.ts";

export const dynamic = "force-dynamic";

function roleFrom(request: Request): string {
  const roleId = new URL(request.url).searchParams.get("roleId")?.trim();
  if (!roleId) {
    throw new AppError({
      code: "ROLE_REQUIRED",
      category: "VALIDATION",
      message: "roleId 不能为空",
      retryable: false,
    });
  }
  return roleId;
}

export async function GET(
  request: Request,
  { params }: { readonly params: Promise<{ readonly dispatchId: string }> },
): Promise<Response> {
  try {
    const { dispatchId } = await params;
    return Response.json(getLocalDispatchTimeline(roleFrom(request), dispatchId), {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return apiError(error);
  }
}
