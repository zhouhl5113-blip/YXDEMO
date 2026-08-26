import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AppError } from "../../packages/contracts/src/index.ts";
import {
  createDispatchService,
  type DispatchCandidate,
} from "../../packages/dispatch-domain/src/index.ts";

const baseDraft = {
  tenantId: "tenant-yixing-local",
  businessNo: "YD-260825-1001",
  origin: "上海闵行集散中心",
  destination: "杭州萧山客户仓",
  plannedStart: "2026-08-25T02:30:00.000Z",
  plannedEnd: "2026-08-25T05:30:00.000Z",
  ownerId: "user-zhou-helong",
  notes: "本地开发测试草稿",
} as const;

const availableCandidate: DispatchCandidate = {
  candidateId: "candidate-available",
  vehicleId: "vehicle-su-e8m52",
  vehicleLabel: "苏E·8M52",
  driverId: "driver-li",
  driverLabel: "李师傅",
  identity: "PRIMARY",
  organizationInScope: true,
  qualificationsValid: true,
  availability: "AVAILABLE",
  conflicts: [],
  freshness: {
    status: "FRESH",
    observedAt: "2026-08-25T02:20:00.000Z",
    source: "G7_SANDBOX_SYNTHETIC_FIXTURE",
  },
  distanceKm: 12,
};

describe("dispatch domain", () => {
  it("TEST-013 saves a DRAFT without producing a G7 write", () => {
    const service = createDispatchService({
      idFactory: () => "dispatch-001",
      clock: () => "2026-08-25T02:00:00.000Z",
    });

    const result = service.createDraft(baseDraft);

    assert.equal(result.dispatch.status, "DRAFT");
    assert.equal(result.dispatch.syncStatus, "NOT_QUEUED");
    assert.equal(result.dispatch.version, 1);
    assert.deepEqual(result.outboundCommands, []);
  });

  it("TEST-014 separates blockers from overridable advice and records the override reason", () => {
    const service = createDispatchService();
    const draft = service.createDraft(baseDraft).dispatch;
    const blocked = service.evaluateCandidate(draft.id, {
      ...availableCandidate,
      candidateId: "candidate-blocked",
      qualificationsValid: false,
      availability: "BLOCKED",
      conflicts: [
        {
          kind: "VEHICLE",
          objectLabel: "苏E·8M52",
          startsAt: "2026-08-25T03:00:00.000Z",
          endsAt: "2026-08-25T04:00:00.000Z",
        },
      ],
    });
    const warned = service.evaluateCandidate(draft.id, {
      ...availableCandidate,
      candidateId: "candidate-warning",
      availability: "WARNING",
      availabilityReason: "距计划起点 42 公里",
    });

    assert.equal(blocked.decision, "BLOCKED");
    assert.ok(blocked.blockers.length >= 2);
    assert.equal(warned.decision, "AVAILABLE_WITH_WARNING");
    assert.equal(warned.blockers.length, 0);
    assert.throws(
      () => service.selectCandidate(draft.id, warned.candidate.candidateId),
      (error: unknown) => error instanceof AppError && error.code === "OVERRIDE_REASON_REQUIRED",
    );

    const selected = service.selectCandidate(
      draft.id,
      warned.candidate.candidateId,
      "客户时窗优先，已电话确认空驶距离",
    );
    assert.equal(selected.overrideReason, "客户时窗优先，已电话确认空驶距离");
  });

  it("TEST-015 blocks confirmation when the driver already has an overlapping vehicle assignment", () => {
    const service = createDispatchService();
    const draft = service.createDraft(baseDraft).dispatch;
    service.evaluateCandidate(draft.id, availableCandidate);
    service.selectCandidate(draft.id, availableCandidate.candidateId);

    assert.throws(
      () =>
        service.confirmDispatch({
          tenantId: baseDraft.tenantId,
          dispatchId: draft.id,
          expectedVersion: 2,
          idempotencyKey: "confirm-overlap-driver",
          existingAssignments: [
            {
              dispatchId: "dispatch-existing",
              driverId: availableCandidate.driverId,
              vehicleId: "vehicle-other",
              identity: "PRIMARY",
              startsAt: "2026-08-25T02:45:00.000Z",
              endsAt: "2026-08-25T04:00:00.000Z",
            },
          ],
        }),
      (error: unknown) => error instanceof AppError && error.code === "DRIVER_TIME_CONFLICT",
    );
    assert.equal(service.getDispatch(draft.id).status, "DRAFT");
    assert.equal(service.getPendingSyncCommands().length, 0);
  });

  it("TEST-016 rejects an invalid time window before any outbound command is queued", () => {
    const service = createDispatchService();

    assert.throws(
      () =>
        service.createDraft({
          ...baseDraft,
          plannedEnd: baseDraft.plannedStart,
        }),
      (error: unknown) => error instanceof AppError && error.code === "INVALID_DISPATCH_WINDOW",
    );
    assert.equal(service.getPendingSyncCommands().length, 0);
  });

  it("TEST-017 confirms atomically and replays the original result for the same idempotency key", () => {
    let idSequence = 0;
    const service = createDispatchService({
      idFactory: (prefix) => `${prefix}-${++idSequence}`,
      clock: () => "2026-08-25T02:00:00.000Z",
    });
    const draft = service.createDraft(baseDraft).dispatch;
    service.evaluateCandidate(draft.id, availableCandidate);
    service.selectCandidate(draft.id, availableCandidate.candidateId);
    const command = {
      tenantId: baseDraft.tenantId,
      dispatchId: draft.id,
      expectedVersion: 2,
      idempotencyKey: "confirm-idempotent-001",
      existingAssignments: [],
    } as const;

    const first = service.confirmDispatch(command);
    const replay = service.confirmDispatch(command);

    assert.equal(first.dispatch.status, "CONFIRMED");
    assert.equal(first.dispatch.syncStatus, "PENDING");
    assert.equal(first.syncCommand.status, "PENDING");
    assert.strictEqual(replay, first);
    assert.equal(service.getPendingSyncCommands().length, 1);
  });

  it("TEST-018 appends out-of-order facts without replacing the newest location", () => {
    const service = createDispatchService();
    const dispatch = service.createDraft(baseDraft).dispatch;

    service.appendTimelineFact(dispatch.id, {
      sourceEventId: "location-new",
      type: "LOCATION",
      source: "G7_SANDBOX_SYNTHETIC_FIXTURE",
      happenedAt: "2026-08-25T03:10:00.000Z",
      receivedAt: "2026-08-25T03:10:03.000Z",
      summary: "G2 京沪高速昆山段",
      location: "昆山花桥附近",
    });
    service.appendTimelineFact(dispatch.id, {
      sourceEventId: "location-old-arrived-late",
      type: "LOCATION",
      source: "G7_SANDBOX_SYNTHETIC_FIXTURE",
      happenedAt: "2026-08-25T03:00:00.000Z",
      receivedAt: "2026-08-25T03:12:00.000Z",
      summary: "G2 京沪高速安亭段",
      location: "安亭收费站附近",
    });

    const projection = service.getTimeline(dispatch.id);
    assert.equal(projection.events.length, 2);
    assert.equal(projection.events[0]?.sourceEventId, "location-old-arrived-late");
    assert.equal(projection.events[1]?.sourceEventId, "location-new");
    assert.equal(projection.latestLocation?.sourceEventId, "location-new");
    assert.equal(projection.latestLocation?.location, "昆山花桥附近");
  });

  it("TEST-019 creates a today work item linked to the dispatch resources and source fact", () => {
    let idSequence = 0;
    const service = createDispatchService({ idFactory: (prefix) => `${prefix}-${++idSequence}` });
    const draft = service.createDraft(baseDraft).dispatch;
    service.evaluateCandidate(draft.id, availableCandidate);
    service.selectCandidate(draft.id, availableCandidate.candidateId);
    service.confirmDispatch({
      tenantId: baseDraft.tenantId,
      dispatchId: draft.id,
      expectedVersion: 2,
      idempotencyKey: "confirm-timeline-work",
      existingAssignments: [],
    });
    service.appendTimelineFact(draft.id, {
      sourceEventId: "exception-delay-001",
      type: "EXCEPTION",
      source: "LOCAL_SANDBOX_FIXTURE",
      happenedAt: "2026-08-25T03:20:00.000Z",
      receivedAt: "2026-08-25T03:20:04.000Z",
      summary: "预计晚到 42 分钟",
      location: "昆山花桥附近",
    });

    const work = service.createWorkFromTimelineFact({
      tenantId: baseDraft.tenantId,
      dispatchId: draft.id,
      sourceEventId: "exception-delay-001",
      ownerId: "user-zhou-helong",
      dueAt: "2026-08-25T04:00:00.000Z",
      closureCriteria: "确认新 ETA 并通知客户",
    });

    assert.equal(work.dispatchId, draft.id);
    assert.equal(work.vehicleId, availableCandidate.vehicleId);
    assert.equal(work.driverId, availableCandidate.driverId);
    assert.equal(work.sourceEventId, "exception-delay-001");
    assert.equal(work.ownerId, "user-zhou-helong");
    assert.equal(work.status, "OPEN");
    assert.equal(
      service.listTodayWork({
        tenantId: baseDraft.tenantId,
        windowStart: "2026-08-25T00:00:00.000Z",
        windowEnd: "2026-08-26T00:00:00.000Z",
      })[0]?.id,
      work.id,
    );
  });

  it("TEST-020 composes the timeline without calling the developing trip search when disabled", () => {
    let developingCallCount = 0;
    const service = createDispatchService({
      tripSegmentSearch: {
        search() {
          developingCallCount += 1;
          return [];
        },
      },
    });
    const dispatch = service.createDraft(baseDraft).dispatch;
    for (const fact of [
      {
        sourceEventId: "plan-departure",
        type: "PLAN" as const,
        source: "LOCAL_DISPATCH_PLAN",
        happenedAt: "2026-08-25T02:30:00.000Z",
        receivedAt: "2026-08-25T02:00:00.000Z",
        summary: "计划从上海闵行集散中心发车",
      },
      {
        sourceEventId: "location-001",
        type: "LOCATION" as const,
        source: "G7_SANDBOX_SYNTHETIC_FIXTURE",
        happenedAt: "2026-08-25T03:00:00.000Z",
        receivedAt: "2026-08-25T03:00:03.000Z",
        summary: "车辆进入昆山花桥路段",
        location: "昆山花桥附近",
      },
      {
        sourceEventId: "geofence-entry-001",
        type: "GEOFENCE" as const,
        source: "G7_SANDBOX_SYNTHETIC_FIXTURE",
        happenedAt: "2026-08-25T03:10:00.000Z",
        receivedAt: "2026-08-25T03:10:05.000Z",
        summary: "进入昆山中转围栏",
      },
    ]) {
      service.appendTimelineFact(dispatch.id, fact);
    }

    const projection = service.getInTransitTimeline({
      tenantId: baseDraft.tenantId,
      dispatchId: dispatch.id,
      tripSegmentSearchEnabled: false,
    });

    assert.equal(developingCallCount, 0);
    assert.deepEqual(
      projection.events.map((event) => event.type),
      ["PLAN", "LOCATION", "GEOFENCE"],
    );
    assert.equal(projection.tripSegmentSearchUsed, false);
  });

  it("TEST-021 keeps the confirmed business state while retryable G7 sync fails and retries", () => {
    const service = createDispatchService({
      idFactory: (prefix) => `${prefix}-sync-recovery`,
      clock: () => "2026-08-25T02:00:00.000Z",
    });
    const draft = service.createDraft(baseDraft).dispatch;
    service.evaluateCandidate(draft.id, availableCandidate);
    service.selectCandidate(draft.id, availableCandidate.candidateId);
    const confirmed = service.confirmDispatch({
      tenantId: baseDraft.tenantId,
      dispatchId: draft.id,
      expectedVersion: 2,
      idempotencyKey: "confirm-sync-recovery",
      existingAssignments: [],
      requestId: "request-sync-recovery",
      traceId: "trace-sync-recovery",
    });

    const failed = service.recordSyncFailure({
      tenantId: baseDraft.tenantId,
      commandId: confirmed.syncCommand.id,
      attemptedAt: "2026-08-25T02:05:00.000Z",
      errorCode: "G7_RATE_LIMITED",
      message: "G7 暂时限流，本地派车已保留",
      retryable: true,
      upstreamReference: "g7-request-recovery-001",
    });

    assert.equal(failed.dispatch.status, "CONFIRMED");
    assert.equal(failed.dispatch.syncStatus, "FAILED");
    assert.equal(failed.syncCommand.status, "FAILED");
    assert.equal(failed.syncCommand.attemptCount, 1);
    assert.equal(failed.syncCommand.lastError?.code, "G7_RATE_LIMITED");
    assert.equal(failed.syncCommand.lastAttemptAt, "2026-08-25T02:05:00.000Z");

    const retrying = service.retrySyncCommand({
      tenantId: baseDraft.tenantId,
      commandId: confirmed.syncCommand.id,
      requestedAt: "2026-08-25T02:06:00.000Z",
    });
    assert.equal(retrying.dispatch.status, "CONFIRMED");
    assert.equal(retrying.dispatch.syncStatus, "RETRYING");
    assert.equal(retrying.syncCommand.status, "RETRYING");

    const revoked = service.revokeSyncCommand({
      tenantId: baseDraft.tenantId,
      commandId: confirmed.syncCommand.id,
      revokedAt: "2026-08-25T02:07:00.000Z",
      reason: "客户取消本次运输，保留审计记录",
    });
    assert.equal(revoked.dispatch.status, "CANCELLED");
    assert.equal(revoked.dispatch.syncStatus, "REVOKED");
    assert.equal(revoked.syncCommand.status, "REVOKED");
    assert.equal(revoked.syncCommand.revokedReason, "客户取消本次运输，保留审计记录");
  });

  it("TEST-022 converges the same retry command to SYNCED when G7 reports an existing binding", () => {
    let idSequence = 0;
    const service = createDispatchService({ idFactory: (prefix) => `${prefix}-${++idSequence}` });
    const draft = service.createDraft(baseDraft).dispatch;
    service.evaluateCandidate(draft.id, availableCandidate);
    service.selectCandidate(draft.id, availableCandidate.candidateId);
    const confirmed = service.confirmDispatch({
      tenantId: baseDraft.tenantId,
      dispatchId: draft.id,
      expectedVersion: 2,
      idempotencyKey: "confirm-existing-binding",
      existingAssignments: [],
    });
    service.recordSyncFailure({
      tenantId: baseDraft.tenantId,
      commandId: confirmed.syncCommand.id,
      attemptedAt: "2026-08-25T02:05:00.000Z",
      errorCode: "G7_TIMEOUT",
      message: "G7 请求超时",
      retryable: true,
    });
    service.retrySyncCommand({
      tenantId: baseDraft.tenantId,
      commandId: confirmed.syncCommand.id,
      requestedAt: "2026-08-25T02:06:00.000Z",
    });

    const first = service.completeSyncCommand({
      tenantId: baseDraft.tenantId,
      commandId: confirmed.syncCommand.id,
      completedAt: "2026-08-25T02:06:02.000Z",
      outcome: "ALREADY_EXISTS",
      upstreamReference: "g7-existing-binding-001",
    });
    const replay = service.completeSyncCommand({
      tenantId: baseDraft.tenantId,
      commandId: confirmed.syncCommand.id,
      completedAt: "2026-08-25T02:07:00.000Z",
      outcome: "ALREADY_EXISTS",
      upstreamReference: "g7-existing-binding-001",
    });

    assert.equal(first.dispatch.status, "CONFIRMED");
    assert.equal(first.dispatch.syncStatus, "SYNCED");
    assert.equal(first.syncCommand.status, "SYNCED");
    assert.equal(first.syncCommand.result, "ALREADY_EXISTS");
    assert.deepEqual(replay, first);
    assert.equal(service.getPendingSyncCommands().length, 0);
  });

  it("TEST-023 creates one traceable administrator work item when the oldest sync exceeds 30 minutes", () => {
    const service = createDispatchService({
      idFactory: (prefix) => `${prefix}-backlog`,
      clock: () => "2026-08-25T02:00:00.000Z",
    });
    const draft = service.createDraft(baseDraft).dispatch;
    service.evaluateCandidate(draft.id, availableCandidate);
    service.selectCandidate(draft.id, availableCandidate.candidateId);
    const confirmed = service.confirmDispatch({
      tenantId: baseDraft.tenantId,
      dispatchId: draft.id,
      expectedVersion: 2,
      idempotencyKey: "confirm-backlog",
      existingAssignments: [],
      requestId: "request-backlog",
      traceId: "trace-backlog",
    });
    service.recordSyncFailure({
      tenantId: baseDraft.tenantId,
      commandId: confirmed.syncCommand.id,
      attemptedAt: "2026-08-25T02:05:00.000Z",
      errorCode: "G7_TIMEOUT",
      message: "G7 请求超时",
      retryable: true,
      upstreamReference: "g7-backlog-001",
    });

    assert.equal(
      service.inspectSyncBacklog({
        tenantId: baseDraft.tenantId,
        now: "2026-08-25T02:29:59.000Z",
        thresholdMinutes: 30,
      }).length,
      0,
    );
    const first = service.inspectSyncBacklog({
      tenantId: baseDraft.tenantId,
      now: "2026-08-25T02:30:01.000Z",
      thresholdMinutes: 30,
    });
    const replay = service.inspectSyncBacklog({
      tenantId: baseDraft.tenantId,
      now: "2026-08-25T02:45:00.000Z",
      thresholdMinutes: 30,
    });

    assert.equal(first.length, 1);
    assert.equal(first[0]?.dispatchId, draft.id);
    assert.equal(first[0]?.requestId, "request-backlog");
    assert.equal(first[0]?.traceId, "trace-backlog");
    assert.equal(first[0]?.upstreamReference, "g7-backlog-001");
    assert.equal(replay.length, 1);
    assert.equal(replay[0]?.id, first[0]?.id);
    assert.equal(
      service.inspectSyncBacklog({
        tenantId: "tenant-other",
        now: "2026-08-25T02:45:00.000Z",
        thresholdMinutes: 30,
      }).length,
      0,
    );
  });
});
