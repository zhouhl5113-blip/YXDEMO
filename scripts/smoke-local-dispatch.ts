const baseUrl = process.env.LOCAL_APP_URL ?? "http://127.0.0.1:3000";

interface JsonResponse {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

async function post(
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} was not an object`);
  }
  return value as Record<string, unknown>;
}

function list(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} was not an array`);
  }
  return value;
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const session = await post("/api/session/context", { roleId: "dispatcher" });
const denied = await post("/api/v1/dispatches", {
  roleId: "operations_manager",
  businessNo: "DENIED-001",
  origin: "A",
  destination: "B",
  plannedStart: "2026-08-25T02:30:00.000Z",
  plannedEnd: "2026-08-25T05:30:00.000Z",
});
const created = await post("/api/v1/dispatches", {
  roleId: "dispatcher",
  businessNo: "SMOKE-001",
  origin: "上海",
  destination: "杭州",
  plannedStart: "2026-08-25T02:30:00.000Z",
  plannedEnd: "2026-08-25T05:30:00.000Z",
});
const createdDispatch = record(created.body.dispatch, "created dispatch");
const candidates = list(created.body.candidates, "dispatch candidates");
const dispatchId = String(createdDispatch.id);
const warningWithoutReason = await post(`/api/v1/dispatches/${dispatchId}/selection`, {
  roleId: "dispatcher",
  candidateId: "candidate-zhe-a7k91",
});
const selected = await post(`/api/v1/dispatches/${dispatchId}/selection`, {
  roleId: "dispatcher",
  candidateId: "candidate-su-e8m52",
});
const selectedDispatch = record(selected.body.dispatch, "selected dispatch");
const missingKey = await post(`/api/v1/dispatches/${dispatchId}/confirm`, {
  roleId: "dispatcher",
  expectedVersion: selectedDispatch.version,
});
const confirmationBody = {
  roleId: "dispatcher",
  expectedVersion: selectedDispatch.version,
};
const confirmationHeaders = { "idempotency-key": `smoke-${crypto.randomUUID()}` };
const confirmed = await post(
  `/api/v1/dispatches/${dispatchId}/confirm`,
  confirmationBody,
  confirmationHeaders,
);
const replayed = await post(
  `/api/v1/dispatches/${dispatchId}/confirm`,
  confirmationBody,
  confirmationHeaders,
);
const roleOptions = list(session.body.roleOptions, "role options");
const confirmedDispatch = record(confirmed.body.dispatch, "confirmed dispatch");
const confirmedCommand = record(confirmed.body.syncCommand, "confirmed command");
const replayedCommand = record(replayed.body.syncCommand, "replayed command");

expect(roleOptions.length === 6, "expected six role options");
expect(
  denied.status === 403 && denied.body.code === "DISPATCH_PERMISSION_DENIED",
  "read-only role was not denied",
);
expect(created.status === 201 && createdDispatch.status === "DRAFT", "draft was not created");
expect(candidates.length === 3, "expected three candidates");
expect(
  warningWithoutReason.body.code === "OVERRIDE_REASON_REQUIRED",
  "warning override was not enforced",
);
expect(missingKey.body.code === "IDEMPOTENCY_KEY_REQUIRED", "idempotency header was not enforced");
expect(confirmedDispatch.status === "CONFIRMED", "dispatch was not confirmed");
expect(confirmedDispatch.syncStatus === "PENDING", "sync command was not left pending");
expect(confirmedCommand.id === replayedCommand.id, "idempotent replay created another command");

console.log(
  JSON.stringify(
    {
      baseUrl,
      roleCount: roleOptions.length,
      readOnlyRole: { status: denied.status, code: denied.body.code },
      draft: {
        status: created.status,
        businessStatus: createdDispatch.status,
        candidates: candidates.length,
      },
      warningWithoutReason: {
        status: warningWithoutReason.status,
        code: warningWithoutReason.body.code,
      },
      missingIdempotencyKey: { status: missingKey.status, code: missingKey.body.code },
      confirmation: {
        status: confirmed.status,
        businessStatus: confirmedDispatch.status,
        syncStatus: confirmedDispatch.syncStatus,
      },
      idempotentReplay: confirmedCommand.id === replayedCommand.id,
    },
    null,
    2,
  ),
);
