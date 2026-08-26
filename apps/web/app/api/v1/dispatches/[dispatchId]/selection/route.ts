import {
  apiError,
  NO_STORE_HEADERS,
  readJsonObject,
  requiredString,
} from "../../../../../../lib/local-api.ts";
import { selectLocalDispatchCandidate } from "../../../../../../lib/local-dispatch-store.ts";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { readonly params: Promise<{ readonly dispatchId: string }> },
): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const { dispatchId } = await params;
    const result = selectLocalDispatchCandidate(
      requiredString(body, "roleId"),
      dispatchId,
      requiredString(body, "candidateId"),
      typeof body.overrideReason === "string" ? body.overrideReason : undefined,
    );
    return Response.json(result, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return apiError(error);
  }
}
