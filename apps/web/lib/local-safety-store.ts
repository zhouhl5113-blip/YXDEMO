import "server-only";

import {
  createSafetyEventFeedService,
  type SafetyEventFeedRecord,
  type StoredSafetyEvent,
} from "../../../packages/safety-domain/src/index.ts";
import { createLocalWorkbenchContext } from "./local-session.ts";

const service = createSafetyEventFeedService({
  idFactory: (() => {
    let sequence = 0;
    return (prefix) => `${prefix}-local-${++sequence}`;
  })(),
});

function record(
  sourceEventId: string,
  payloadHashCharacter: string,
  eventType: SafetyEventFeedRecord["eventType"],
  vehicleId: string,
  driverId: string,
  happenedAt: string,
  receivedAt: string,
  summary: string,
): SafetyEventFeedRecord {
  return {
    sourceEventId,
    payloadHash: payloadHashCharacter.repeat(64),
    eventType,
    vehicleId,
    driverId,
    happenedAt,
    receivedAt,
    summary,
    source: "G7_SANDBOX_SYNTHETIC_FIXTURE",
  };
}

service.consumeFeedPage({
  tenantId: "tenant-yixing-local",
  nextCursor: "local-feed-cursor-004",
  records: [
    record(
      "g7-safety-speeding-001",
      "a",
      "SPEEDING",
      "沪A·2F18",
      "李师傅",
      "2026-08-25T02:48:00.000Z",
      "2026-08-25T02:48:03.000Z",
      "G2 京沪高速持续超速，峰值 96 km/h",
    ),
    record(
      "g7-safety-braking-001",
      "b",
      "HARSH_BRAKING",
      "苏E·8M52",
      "王师傅",
      "2026-08-25T02:42:00.000Z",
      "2026-08-25T02:49:00.000Z",
      "青浦匝道急减速 0.42g，事件乱序到达",
    ),
    record(
      "g7-safety-acceleration-001",
      "c",
      "HARSH_ACCELERATION",
      "浙A·7K91",
      "陈师傅",
      "2026-08-25T02:51:00.000Z",
      "2026-08-25T02:51:04.000Z",
      "杭州绕城入口急加速 0.38g",
    ),
  ],
});

service.consumeFeedPage({
  tenantId: "tenant-yixing-local",
  startCursor: "local-feed-cursor-004",
  nextCursor: "local-feed-cursor-006",
  records: [
    record(
      "g7-safety-speeding-001",
      "a",
      "SPEEDING",
      "沪A·2F18",
      "李师傅",
      "2026-08-25T02:48:00.000Z",
      "2026-08-25T02:48:03.000Z",
      "G2 京沪高速持续超速，峰值 96 km/h",
    ),
    record(
      "g7-safety-speeding-001",
      "d",
      "SPEEDING",
      "沪A·2F18",
      "李师傅",
      "2026-08-25T02:53:00.000Z",
      "2026-08-25T02:53:02.000Z",
      "超速持续 5 分钟，最新峰值 101 km/h",
    ),
  ],
});

service.recordCursorInvalid({
  tenantId: "tenant-yixing-local",
  invalidCursor: "local-feed-cursor-006",
  gapStart: "2026-08-25T02:54:00.000Z",
  gapEnd: "2026-08-25T03:02:00.000Z",
  detectedAt: "2026-08-25T03:03:00.000Z",
  requestId: "request-local-feed-gap-001",
  traceId: "trace-local-feed-gap-001",
  upstreamReference: "synthetic-cursor-invalid-001",
});

service.recoverCursorGap({
  tenantId: "tenant-yixing-local",
  resumeCursor: "local-feed-cursor-008",
  recoveredAt: "2026-08-25T03:04:00.000Z",
  records: [
    record(
      "g7-safety-fatigue-001",
      "e",
      "FATIGUE_DRIVING",
      "皖L·6P27",
      "赵师傅",
      "2026-08-25T02:58:00.000Z",
      "2026-08-25T03:03:30.000Z",
      "连续驾驶时长达到本地风险阈值",
    ),
  ],
  requestId: "request-local-feed-gap-001",
  traceId: "trace-local-feed-gap-001",
});

function latestRevisions(events: readonly StoredSafetyEvent[]) {
  const bySource = new Map<string, StoredSafetyEvent[]>();
  for (const event of events) {
    const revisions = bySource.get(event.sourceEventId) ?? [];
    revisions.push(event);
    bySource.set(event.sourceEventId, revisions);
  }
  return [...bySource.values()]
    .map((revisions) => {
      const latest = [...revisions].sort(
        (left, right) => Date.parse(right.happenedAt) - Date.parse(left.happenedAt),
      )[0];
      if (latest === undefined) throw new Error("Synthetic safety revision unexpectedly missing");
      return Object.freeze({ ...latest, revisionCount: revisions.length });
    })
    .sort((left, right) => Date.parse(right.happenedAt) - Date.parse(left.happenedAt));
}

export function getLocalSafetyInbox(roleId: string) {
  const context = createLocalWorkbenchContext(roleId);
  const tenantId = context.tenantScope.tenantId;
  return Object.freeze({
    mode: "LOCAL_SYNTHETIC" as const,
    events: Object.freeze(latestRevisions(service.listEvents(tenantId))),
    partition: service.getPartitionState(tenantId),
    metrics: service.getMetrics(tenantId),
    auditEvents: service.listAuditEvents(tenantId),
    requestId: context.requestId,
    traceId: context.traceId,
  });
}
