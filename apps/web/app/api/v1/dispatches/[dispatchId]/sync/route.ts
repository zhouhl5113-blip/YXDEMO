import { AppError } from "../../../../../../../../packages/contracts/src/index.ts";
import {
  apiError,
  NO_STORE_HEADERS,
  readJsonObject,
  requiredString,
} from "../../../../../../lib/local-api.ts";
import {
  type LocalDispatchSyncAction,
  updateLocalDispatchSync,
} from "../../../../../../lib/local-dispatch-store.ts";

export const dynamic = "force-dynamic";

const ACTIONS: readonly LocalDispatchSyncAction[] = [
  "SIMULATE_RETRYABLE_FAILURE",
  "RETRY",
  "SIMULATE_ALREADY_EXISTS",
  "REVOKE",
];

function syncAction(value: unknown): LocalDispatchSyncAction {
  if (typeof value !== "string" || !ACTIONS.includes(value as LocalDispatchSyncAction)) {
    throw new AppError({
      code: "INVALID_SYNC_ACTION",
      category: "VALIDATION",
      message: "同步恢复动作无效",
      retryable: false,
    });
  }
  return value as LocalDispatchSyncAction;
}

export async function POST(
  request: Request,
  { params }: { readonly params: Promise<{ readonly dispatchId: string }> },
): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const { dispatchId } = await params;
    const result = updateLocalDispatchSync(
      requiredString(body, "roleId"),
      dispatchId,
      requiredString(body, "commandId"),
      syncAction(body.action),
      typeof body.reason === "string" ? body.reason : undefined,
    );
    return Response.json(result, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return apiError(error);
  }
}
