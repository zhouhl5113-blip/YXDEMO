import {
  apiError,
  NO_STORE_HEADERS,
  readJsonObject,
  requiredString,
} from "../../../../../../../lib/local-api.ts";
import { createLocalTimelineWork } from "../../../../../../../lib/local-dispatch-store.ts";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { readonly params: Promise<{ readonly dispatchId: string }> },
): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const { dispatchId } = await params;
    return Response.json(
      createLocalTimelineWork(
        requiredString(body, "roleId"),
        dispatchId,
        requiredString(body, "sourceEventId"),
        requiredString(body, "dueAt"),
        requiredString(body, "closureCriteria"),
      ),
      { headers: NO_STORE_HEADERS, status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
