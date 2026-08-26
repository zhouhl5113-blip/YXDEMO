import { AppError } from "../../../../../../../../packages/contracts/src/index.ts";
import {
  apiError,
  NO_STORE_HEADERS,
  readJsonObject,
  requiredString,
} from "../../../../../../lib/local-api.ts";
import { confirmLocalDispatch } from "../../../../../../lib/local-dispatch-store.ts";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { readonly params: Promise<{ readonly dispatchId: string }> },
): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) {
      throw new AppError({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        category: "VALIDATION",
        message: "确认派车必须提供 Idempotency-Key",
        retryable: false,
      });
    }
    const expectedVersion = body.expectedVersion;
    if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 1) {
      throw new AppError({
        code: "INVALID_EXPECTED_VERSION",
        category: "VALIDATION",
        message: "expectedVersion 必须是正整数",
        retryable: false,
      });
    }
    const { dispatchId } = await params;
    const result = confirmLocalDispatch(
      requiredString(body, "roleId"),
      dispatchId,
      expectedVersion as number,
      idempotencyKey,
    );
    return Response.json(result, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return apiError(error);
  }
}
