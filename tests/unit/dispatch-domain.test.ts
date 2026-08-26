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
});
