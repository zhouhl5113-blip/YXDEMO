import { AppError } from "../../../../../../packages/contracts/src/index.ts";
import { apiError, NO_STORE_HEADERS } from "../../../../lib/local-api.ts";
import { listLocalTodayWork } from "../../../../lib/local-dispatch-store.ts";

export const dynamic = "force-dynamic";

function requiredParameter(search: URLSearchParams, key: string): string {
  const value = search.get(key)?.trim();
  if (!value) {
    throw new AppError({
      code: "QUERY_PARAMETER_REQUIRED",
      category: "VALIDATION",
      message: `${key} 不能为空`,
      retryable: false,
    });
  }
  return value;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const search = new URL(request.url).searchParams;
    return Response.json(
      {
        items: listLocalTodayWork(
          requiredParameter(search, "roleId"),
          requiredParameter(search, "windowStart"),
          requiredParameter(search, "windowEnd"),
        ),
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return apiError(error);
  }
}
