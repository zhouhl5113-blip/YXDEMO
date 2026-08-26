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

async function get(path: string): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
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
const timeline = await get(`/api/v1/dispatches/${dispatchId}/timeline?roleId=operations_manager`);
const timelineEvents = list(timeline.body.events, "timeline events");
const exceptionFact = record(
  timelineEvents.find((event) => record(event, "timeline event").type === "EXCEPTION"),
  "exception fact",
);
const timelineWorkBody = {
  roleId: "dispatcher",
  sourceEventId: String(exceptionFact.sourceEventId),
  dueAt: "2026-08-25T05:00:00.000Z",
  closureCriteria: "确认新 ETA 并通知客户",
};
const deniedTimelineWork = await post(`/api/v1/dispatches/${dispatchId}/timeline/work`, {
  ...timelineWorkBody,
  roleId: "operations_manager",
});
const createdTimelineWork = await post(
  `/api/v1/dispatches/${dispatchId}/timeline/work`,
  timelineWorkBody,
);
const replayedTimelineWork = await post(
  `/api/v1/dispatches/${dispatchId}/timeline/work`,
  timelineWorkBody,
);
const timelineWork = record(createdTimelineWork.body.work, "timeline work");
const replayedWork = record(replayedTimelineWork.body.work, "replayed timeline work");
const todayWork = await get(
  "/api/v1/work-items?roleId=operations_manager&windowStart=2026-08-25T00%3A00%3A00.000Z&windowEnd=2026-08-26T00%3A00%3A00.000Z",
);
const todayItems = list(todayWork.body.items, "today work items");
const deniedSync = await post(`/api/v1/dispatches/${dispatchId}/sync`, {
  roleId: "operations_manager",
  commandId: String(confirmedCommand.id),
  action: "SIMULATE_RETRYABLE_FAILURE",
});
const mismatchedDispatchSync = await post("/api/v1/dispatches/dispatch-other/sync", {
  roleId: "dispatcher",
  commandId: String(confirmedCommand.id),
  action: "SIMULATE_RETRYABLE_FAILURE",
});
const failed = await post(`/api/v1/dispatches/${dispatchId}/sync`, {
  roleId: "dispatcher",
  commandId: String(confirmedCommand.id),
  action: "SIMULATE_RETRYABLE_FAILURE",
});
const failedDispatch = record(failed.body.dispatch, "failed-sync dispatch");
const failedCommand = record(failed.body.syncCommand, "failed-sync command");
const retrying = await post(`/api/v1/dispatches/${dispatchId}/sync`, {
  roleId: "dispatcher",
  commandId: String(confirmedCommand.id),
  action: "RETRY",
});
const retryingDispatch = record(retrying.body.dispatch, "retrying dispatch");
const retryingCommand = record(retrying.body.syncCommand, "retrying command");
const synced = await post(`/api/v1/dispatches/${dispatchId}/sync`, {
  roleId: "dispatcher",
  commandId: String(confirmedCommand.id),
  action: "SIMULATE_ALREADY_EXISTS",
});
const syncedDispatch = record(synced.body.dispatch, "synced dispatch");
const syncedCommand = record(synced.body.syncCommand, "synced command");

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
expect(timeline.status === 200, "read-only role could not read the in-transit timeline");
expect(
  timelineEvents.length === 4,
  "plan, location, geofence and exception facts were not composed",
);
expect(
  timeline.body.tripSegmentSearchUsed === false,
  "disabled trip-segment-search was reported as used",
);
expect(
  deniedTimelineWork.status === 403 &&
    deniedTimelineWork.body.code === "DISPATCH_PERMISSION_DENIED",
  "read-only role was allowed to create timeline work",
);
expect(
  createdTimelineWork.status === 201 &&
    timelineWork.dispatchId === dispatchId &&
    timelineWork.sourceEventId === exceptionFact.sourceEventId,
  "timeline work was not linked to the dispatch and source fact",
);
expect(
  typeof timelineWork.vehicleId === "string" && typeof timelineWork.driverId === "string",
  "timeline work did not retain the selected vehicle and driver",
);
expect(timelineWork.id === replayedWork.id, "source-fact replay created duplicate work");
expect(
  todayItems.some((item) => record(item, "today work item").id === timelineWork.id),
  "timeline work did not appear in today's server projection",
);
expect(
  deniedSync.status === 403 && deniedSync.body.code === "DISPATCH_PERMISSION_DENIED",
  "read-only role was allowed to recover a sync command",
);
expect(
  mismatchedDispatchSync.status === 404 &&
    mismatchedDispatchSync.body.code === "SYNC_COMMAND_NOT_FOUND",
  "a sync command was accepted under another dispatch path",
);
expect(
  failedDispatch.status === "CONFIRMED" && failedDispatch.syncStatus === "FAILED",
  "retryable failure rolled back or hid the confirmed dispatch",
);
expect(
  failedCommand.id === confirmedCommand.id && failedCommand.status === "FAILED",
  "retryable failure replaced the original command",
);
expect(
  retryingDispatch.status === "CONFIRMED" && retryingDispatch.syncStatus === "RETRYING",
  "retry did not preserve the business state",
);
expect(
  retryingCommand.id === confirmedCommand.id && retryingCommand.status === "RETRYING",
  "retry created another command",
);
expect(
  syncedDispatch.syncStatus === "SYNCED" && syncedCommand.result === "ALREADY_EXISTS",
  "existing upstream binding did not converge to SYNCED",
);
expect(syncedCommand.id === confirmedCommand.id, "sync completion replaced the original command");

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
      timeline: {
        status: timeline.status,
        eventTypes: timelineEvents.map((event) => record(event, "timeline event").type),
        tripSegmentSearchUsed: timeline.body.tripSegmentSearchUsed,
        readOnlyAccess: true,
      },
      timelineWork: {
        status: createdTimelineWork.status,
        readOnlyCreateStatus: deniedTimelineWork.status,
        dispatchLinked: timelineWork.dispatchId === dispatchId,
        resourceLinked:
          typeof timelineWork.vehicleId === "string" && typeof timelineWork.driverId === "string",
        sourceLinked: timelineWork.sourceEventId === exceptionFact.sourceEventId,
        idempotentReplay: timelineWork.id === replayedWork.id,
        appearsToday: todayItems.some(
          (item) => record(item, "today work item").id === timelineWork.id,
        ),
      },
      syncAuthorization: {
        readOnlyStatus: deniedSync.status,
        mismatchedDispatchStatus: mismatchedDispatchSync.status,
      },
      recovery: {
        failedBusinessStatus: failedDispatch.status,
        failedSyncStatus: failedDispatch.syncStatus,
        retryingSyncStatus: retryingDispatch.syncStatus,
        syncedStatus: syncedDispatch.syncStatus,
        result: syncedCommand.result,
        sameCommand:
          failedCommand.id === retryingCommand.id && retryingCommand.id === syncedCommand.id,
      },
    },
    null,
    2,
  ),
);
