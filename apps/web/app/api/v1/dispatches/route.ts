import {
  apiError,
  NO_STORE_HEADERS,
  readJsonObject,
  requiredString,
} from "../../../../lib/local-api.ts";
import { createLocalDispatch } from "../../../../lib/local-dispatch-store.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const result = createLocalDispatch(requiredString(body, "roleId"), {
      businessNo: requiredString(body, "businessNo"),
      origin: requiredString(body, "origin"),
      destination: requiredString(body, "destination"),
      plannedStart: requiredString(body, "plannedStart"),
      plannedEnd: requiredString(body, "plannedEnd"),
      ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
    });
    return Response.json(result, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) {
    return apiError(error);
  }
}
