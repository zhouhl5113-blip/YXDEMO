import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AppError } from "../../packages/contracts/src/index.ts";
import {
  createSafetyEventFeedService,
  type SafetyEventFeedRecord,
} from "../../packages/safety-domain/src/index.ts";

const tenantA = "tenant-yixing-local";
const tenantB = "tenant-yixing-branch";

function safetyEvent(overrides: Partial<SafetyEventFeedRecord> = {}): SafetyEventFeedRecord {
  return {
    sourceEventId: "g7-safety-001",
    payloadHash: "a".repeat(64),
    eventType: "SPEEDING",
    vehicleId: "vehicle-su-e8m52",
    driverId: "driver-li",
    happenedAt: "2026-08-25T03:02:00.000Z",
    receivedAt: "2026-08-25T03:02:03.000Z",
    summary: "持续超速 92 km/h",
    source: "G7_SANDBOX_SYNTHETIC_FIXTURE",
    ...overrides,
  };
}

describe("safety event feed domain", () => {
  it("TEST-024 deduplicates by tenant, source event and payload hash before advancing the cursor", () => {
    const service = createSafetyEventFeedService();

    const first = service.consumeFeedPage({
      tenantId: tenantA,
      nextCursor: "cursor-002",
      records: [
        safetyEvent(),
        safetyEvent({
          sourceEventId: "g7-safety-002",
          payloadHash: "b".repeat(64),
          eventType: "HARSH_BRAKING",
          happenedAt: "2026-08-25T03:01:00.000Z",
          receivedAt: "2026-08-25T03:04:00.000Z",
          summary: "急减速 0.42g",
        }),
      ],
    });
    const second = service.consumeFeedPage({
      tenantId: tenantA,
      startCursor: "cursor-002",
      nextCursor: "cursor-003",
      records: [
        safetyEvent(),
        safetyEvent({
          payloadHash: "c".repeat(64),
          happenedAt: "2026-08-25T03:05:00.000Z",
          receivedAt: "2026-08-25T03:05:02.000Z",
          summary: "持续超速 96 km/h",
        }),
      ],
    });

    assert.deepEqual(
      { accepted: first.accepted, duplicates: first.duplicates, cursor: first.cursor },
      { accepted: 2, duplicates: 0, cursor: "cursor-002" },
    );
    assert.deepEqual(
      { accepted: second.accepted, duplicates: second.duplicates, cursor: second.cursor },
      { accepted: 1, duplicates: 1, cursor: "cursor-003" },
    );
    assert.deepEqual(
      service.listEvents(tenantA).map((event) => event.happenedAt),
      ["2026-08-25T03:01:00.000Z", "2026-08-25T03:02:00.000Z", "2026-08-25T03:05:00.000Z"],
    );
    assert.equal(service.listEvents(tenantB).length, 0);

    assert.throws(
      () =>
        service.consumeFeedPage({
          tenantId: tenantA,
          startCursor: "cursor-003",
          nextCursor: "cursor-004",
          records: [safetyEvent({ sourceEventId: "invalid", payloadHash: "not-a-sha256" })],
        }),
      (error: unknown) => error instanceof AppError && error.code === "INVALID_PAYLOAD_HASH",
    );
    assert.equal(service.getPartitionState(tenantA).cursor, "cursor-003");
    assert.equal(service.listEvents(tenantA).length, 3);
  });

  it("TEST-025 pauses an invalid cursor gap, audits history backfill and resumes the partition", () => {
    const service = createSafetyEventFeedService();
    service.consumeFeedPage({
      tenantId: tenantA,
      nextCursor: "cursor-010",
      records: [safetyEvent()],
    });

    const paused = service.recordCursorInvalid({
      tenantId: tenantA,
      invalidCursor: "cursor-010",
      gapStart: "2026-08-25T03:00:00.000Z",
      gapEnd: "2026-08-25T03:15:00.000Z",
      detectedAt: "2026-08-25T03:16:00.000Z",
      requestId: "request-gap-001",
      traceId: "trace-gap-001",
      upstreamReference: "g7-cursor-error-001",
    });

    assert.equal(paused.status, "PAUSED_CURSOR_GAP");
    assert.equal(paused.gap?.status, "OPEN");
    assert.throws(
      () =>
        service.consumeFeedPage({
          tenantId: tenantA,
          startCursor: "cursor-010",
          nextCursor: "cursor-011",
          records: [],
        }),
      (error: unknown) => error instanceof AppError && error.code === "FEED_PARTITION_PAUSED",
    );

    const recovered = service.recoverCursorGap({
      tenantId: tenantA,
      resumeCursor: "cursor-015",
      recoveredAt: "2026-08-25T03:18:00.000Z",
      records: [
        safetyEvent({
          sourceEventId: "g7-safety-history-012",
          payloadHash: "d".repeat(64),
          eventType: "FATIGUE_DRIVING",
          happenedAt: "2026-08-25T03:12:00.000Z",
          receivedAt: "2026-08-25T03:17:30.000Z",
          summary: "连续驾驶时长达到风险阈值",
          source: "G7_HISTORICAL_SYNTHETIC_FIXTURE",
        }),
      ],
      requestId: "request-gap-001",
      traceId: "trace-gap-001",
    });

    assert.equal(recovered.status, "ACTIVE");
    assert.equal(recovered.cursor, "cursor-015");
    assert.equal(recovered.gap?.status, "RECOVERED");
    assert.equal(recovered.gap?.recoveredRecords, 1);
    assert.deepEqual(
      service.listAuditEvents(tenantA).map((event) => event.action),
      ["CURSOR_GAP_DETECTED", "CURSOR_GAP_RECOVERED"],
    );
    assert.deepEqual(service.getMetrics(tenantA), {
      acceptedRecords: 2,
      duplicateRecords: 0,
      cursorGapsDetected: 1,
      cursorGapsRecovered: 1,
      rateLimitEvents: 0,
    });
  });

  it("TEST-026 throttles one tenant partition without blocking another tenant", () => {
    const service = createSafetyEventFeedService();

    const cycle = service.processFeedCycle({
      now: "2026-08-25T04:00:00.000Z",
      partitions: [
        {
          tenantId: tenantA,
          outcome: {
            kind: "RATE_LIMIT",
            retryAfterSeconds: 60,
            attempt: 2,
            upstreamReference: "g7-rate-limit-a-001",
          },
        },
        {
          tenantId: tenantB,
          outcome: {
            kind: "PAGE",
            nextCursor: "cursor-b-001",
            records: [
              safetyEvent({
                sourceEventId: "g7-safety-b-001",
                payloadHash: "e".repeat(64),
                eventType: "HARSH_ACCELERATION",
              }),
            ],
          },
        },
      ],
    });

    assert.deepEqual(
      cycle.results.map((result) => [result.tenantId, result.status]),
      [
        [tenantA, "THROTTLED"],
        [tenantB, "PROCESSED"],
      ],
    );
    assert.equal(service.getPartitionState(tenantA).status, "THROTTLED");
    assert.equal(service.getPartitionState(tenantA).nextRetryAt, "2026-08-25T04:01:00.000Z");
    assert.equal(service.getPartitionState(tenantB).cursor, "cursor-b-001");
    assert.equal(service.listEvents(tenantB).length, 1);
    assert.throws(
      () =>
        service.processFeedCycle({
          now: "2026-08-25T04:00:30.000Z",
          partitions: [
            {
              tenantId: tenantA,
              outcome: { kind: "PAGE", nextCursor: "cursor-a-001", records: [] },
            },
          ],
        }),
      (error: unknown) => error instanceof AppError && error.code === "FEED_PARTITION_THROTTLED",
    );

    const retry = service.processFeedCycle({
      now: "2026-08-25T04:01:00.000Z",
      partitions: [
        {
          tenantId: tenantA,
          outcome: { kind: "PAGE", nextCursor: "cursor-a-001", records: [] },
        },
      ],
    });
    assert.equal(retry.results[0]?.status, "PROCESSED");
    assert.equal(service.getPartitionState(tenantA).status, "ACTIVE");
    assert.equal(service.getPartitionState(tenantA).cursor, "cursor-a-001");
    assert.equal(service.getMetrics(tenantA).rateLimitEvents, 1);
  });
});
