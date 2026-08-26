import { randomUUID } from "node:crypto";

import { AppError } from "../../contracts/src/index.ts";

export type SafetyEventType =
  | "SPEEDING"
  | "HARSH_ACCELERATION"
  | "HARSH_BRAKING"
  | "FATIGUE_DRIVING";

export interface SafetyEventFeedRecord {
  readonly sourceEventId: string;
  readonly payloadHash: string;
  readonly eventType: SafetyEventType;
  readonly vehicleId: string;
  readonly driverId?: string;
  readonly happenedAt: string;
  readonly receivedAt: string;
  readonly summary: string;
  readonly source: string;
}

export interface StoredSafetyEvent extends SafetyEventFeedRecord {
  readonly id: string;
  readonly tenantId: string;
}

export interface FeedCursorGap {
  readonly invalidCursor: string;
  readonly start: string;
  readonly end: string;
  readonly detectedAt: string;
  readonly status: "OPEN" | "RECOVERED";
  readonly recoveredAt?: string;
  readonly recoveredRecords?: number;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly upstreamReference?: string;
}

export interface FeedPartitionState {
  readonly tenantId: string;
  readonly status: "ACTIVE" | "PAUSED_CURSOR_GAP" | "THROTTLED";
  readonly cursor?: string;
  readonly nextRetryAt?: string;
  readonly gap?: FeedCursorGap;
}

export interface SafetyFeedAuditEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly action: "CURSOR_GAP_DETECTED" | "CURSOR_GAP_RECOVERED" | "RATE_LIMITED";
  readonly occurredAt: string;
  readonly detail: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly upstreamReference?: string;
}

export interface SafetyFeedMetrics {
  readonly acceptedRecords: number;
  readonly duplicateRecords: number;
  readonly cursorGapsDetected: number;
  readonly cursorGapsRecovered: number;
  readonly rateLimitEvents: number;
}

export interface ConsumeFeedPageInput {
  readonly tenantId: string;
  readonly startCursor?: string;
  readonly nextCursor: string;
  readonly records: readonly SafetyEventFeedRecord[];
}

export interface ConsumeFeedPageResult {
  readonly accepted: number;
  readonly duplicates: number;
  readonly cursor: string;
}

export interface SafetyEventFeedService {
  consumeFeedPage(input: ConsumeFeedPageInput): ConsumeFeedPageResult;
  recordCursorInvalid(input: {
    readonly tenantId: string;
    readonly invalidCursor: string;
    readonly gapStart: string;
    readonly gapEnd: string;
    readonly detectedAt: string;
    readonly requestId?: string;
    readonly traceId?: string;
    readonly upstreamReference?: string;
  }): FeedPartitionState;
  recoverCursorGap(input: {
    readonly tenantId: string;
    readonly resumeCursor: string;
    readonly recoveredAt: string;
    readonly records: readonly SafetyEventFeedRecord[];
    readonly requestId?: string;
    readonly traceId?: string;
  }): FeedPartitionState;
  processFeedCycle(input: {
    readonly now: string;
    readonly partitions: readonly FeedCyclePartition[];
  }): FeedCycleResult;
  getPartitionState(tenantId: string): FeedPartitionState;
  listEvents(tenantId: string): readonly StoredSafetyEvent[];
  listAuditEvents(tenantId: string): readonly SafetyFeedAuditEvent[];
  getMetrics(tenantId: string): SafetyFeedMetrics;
}

export type FeedCyclePartition =
  | {
      readonly tenantId: string;
      readonly outcome: {
        readonly kind: "PAGE";
        readonly startCursor?: string;
        readonly nextCursor: string;
        readonly records: readonly SafetyEventFeedRecord[];
      };
    }
  | {
      readonly tenantId: string;
      readonly outcome: {
        readonly kind: "RATE_LIMIT";
        readonly retryAfterSeconds: number;
        readonly attempt: number;
        readonly upstreamReference?: string;
      };
    };

export interface FeedCycleResult {
  readonly results: readonly {
    readonly tenantId: string;
    readonly status: "PROCESSED" | "THROTTLED";
    readonly accepted?: number;
    readonly duplicates?: number;
    readonly cursor?: string;
    readonly nextRetryAt?: string;
  }[];
}

export interface SafetyEventFeedServiceOptions {
  readonly idFactory?: (prefix: string) => string;
}

const eventTypes = new Set<SafetyEventType>([
  "SPEEDING",
  "HARSH_ACCELERATION",
  "HARSH_BRAKING",
  "FATIGUE_DRIVING",
]);

function feedError(
  code: string,
  message: string,
  category: "CONFLICT" | "NOT_FOUND" | "UPSTREAM" | "VALIDATION",
  retryable = false,
): AppError {
  return new AppError({ code, message, category, retryable });
}

function requireText(value: string, code: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw feedError(code, `${label}不能为空`, "VALIDATION");
  return normalized;
}

function parseTimestamp(value: string, code = "INVALID_FEED_TIMESTAMP"): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw feedError(code, "时间必须是有效的 RFC 3339 格式", "VALIDATION");
  }
  return parsed;
}

function validateRecord(record: SafetyEventFeedRecord): SafetyEventFeedRecord {
  const sourceEventId = requireText(
    record.sourceEventId,
    "SOURCE_EVENT_ID_REQUIRED",
    "来源事件 ID",
  );
  const payloadHash = record.payloadHash.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(payloadHash)) {
    throw feedError("INVALID_PAYLOAD_HASH", "payload hash 必须是 SHA-256", "VALIDATION");
  }
  if (!eventTypes.has(record.eventType)) {
    throw feedError("INVALID_SAFETY_EVENT_TYPE", "安全事件类型不受支持", "VALIDATION");
  }
  parseTimestamp(record.happenedAt);
  parseTimestamp(record.receivedAt);
  return Object.freeze({
    ...record,
    sourceEventId,
    payloadHash,
    vehicleId: requireText(record.vehicleId, "VEHICLE_ID_REQUIRED", "车辆 ID"),
    ...(record.driverId === undefined
      ? {}
      : { driverId: requireText(record.driverId, "DRIVER_ID_REQUIRED", "司机 ID") }),
    summary: requireText(record.summary, "EVENT_SUMMARY_REQUIRED", "事件摘要"),
    source: requireText(record.source, "EVENT_SOURCE_REQUIRED", "事件来源"),
  });
}

function freezeGap(gap: FeedCursorGap): FeedCursorGap {
  return Object.freeze({ ...gap });
}

function freezeState(state: FeedPartitionState): FeedPartitionState {
  return Object.freeze({
    ...state,
    ...(state.gap === undefined ? {} : { gap: freezeGap(state.gap) }),
  });
}

function emptyMetrics(): SafetyFeedMetrics {
  return {
    acceptedRecords: 0,
    duplicateRecords: 0,
    cursorGapsDetected: 0,
    cursorGapsRecovered: 0,
    rateLimitEvents: 0,
  };
}

export function createSafetyEventFeedService(
  options: SafetyEventFeedServiceOptions = {},
): SafetyEventFeedService {
  const idFactory = options.idFactory ?? ((prefix: string) => `${prefix}-${randomUUID()}`);
  const partitions = new Map<string, FeedPartitionState>();
  const events = new Map<string, Map<string, StoredSafetyEvent>>();
  const audits = new Map<string, SafetyFeedAuditEvent[]>();
  const metrics = new Map<string, SafetyFeedMetrics>();

  function tenantId(value: string): string {
    return requireText(value, "TENANT_REQUIRED", "租户");
  }

  function currentState(value: string): FeedPartitionState {
    const normalizedTenantId = tenantId(value);
    return (
      partitions.get(normalizedTenantId) ??
      freezeState({ tenantId: normalizedTenantId, status: "ACTIVE" })
    );
  }

  function currentMetrics(value: string): SafetyFeedMetrics {
    return metrics.get(value) ?? emptyMetrics();
  }

  function updateMetrics(value: string, changes: Partial<SafetyFeedMetrics>): void {
    const current = currentMetrics(value);
    metrics.set(
      value,
      Object.freeze({
        acceptedRecords: current.acceptedRecords + (changes.acceptedRecords ?? 0),
        duplicateRecords: current.duplicateRecords + (changes.duplicateRecords ?? 0),
        cursorGapsDetected: current.cursorGapsDetected + (changes.cursorGapsDetected ?? 0),
        cursorGapsRecovered: current.cursorGapsRecovered + (changes.cursorGapsRecovered ?? 0),
        rateLimitEvents: current.rateLimitEvents + (changes.rateLimitEvents ?? 0),
      }),
    );
  }

  function appendAudit(event: Omit<SafetyFeedAuditEvent, "id">): void {
    const tenantAudits = audits.get(event.tenantId) ?? [];
    tenantAudits.push(Object.freeze({ ...event, id: idFactory("safety-feed-audit") }));
    audits.set(event.tenantId, tenantAudits);
  }

  function stageRecords(value: string, inputRecords: readonly SafetyEventFeedRecord[]) {
    const normalizedTenantId = tenantId(value);
    const tenantEvents = events.get(normalizedTenantId) ?? new Map<string, StoredSafetyEvent>();
    const stagedKeys = new Set<string>();
    const accepted: StoredSafetyEvent[] = [];
    let duplicates = 0;
    for (const inputRecord of inputRecords) {
      const record = validateRecord(inputRecord);
      const key = `${record.sourceEventId}:${record.payloadHash}`;
      if (tenantEvents.has(key) || stagedKeys.has(key)) {
        duplicates += 1;
        continue;
      }
      stagedKeys.add(key);
      accepted.push(
        Object.freeze({
          ...record,
          id: idFactory("safety-event"),
          tenantId: normalizedTenantId,
        }),
      );
    }
    return { normalizedTenantId, tenantEvents, accepted, duplicates };
  }

  function commitRecords(value: ReturnType<typeof stageRecords>): void {
    for (const record of value.accepted) {
      value.tenantEvents.set(`${record.sourceEventId}:${record.payloadHash}`, record);
    }
    events.set(value.normalizedTenantId, value.tenantEvents);
    updateMetrics(value.normalizedTenantId, {
      acceptedRecords: value.accepted.length,
      duplicateRecords: value.duplicates,
    });
  }

  function consumeFeedPage(input: ConsumeFeedPageInput): ConsumeFeedPageResult {
    const normalizedTenantId = tenantId(input.tenantId);
    const state = currentState(normalizedTenantId);
    if (state.status === "PAUSED_CURSOR_GAP") {
      throw feedError(
        "FEED_PARTITION_PAUSED",
        "Feed 分区因游标缺口暂停，必须完成历史回补后恢复",
        "CONFLICT",
      );
    }
    if (state.status === "THROTTLED") {
      throw feedError("FEED_PARTITION_THROTTLED", "Feed 分区正在按租户退避", "UPSTREAM", true);
    }
    const nextCursor = requireText(input.nextCursor, "NEXT_CURSOR_REQUIRED", "下一游标");
    if (state.cursor !== undefined && input.startCursor !== state.cursor) {
      throw feedError("FEED_CURSOR_MISMATCH", "Feed 起始游标与已提交游标不一致", "CONFLICT");
    }
    const staged = stageRecords(normalizedTenantId, input.records);
    commitRecords(staged);
    const nextState = freezeState({
      tenantId: normalizedTenantId,
      status: "ACTIVE",
      cursor: nextCursor,
    });
    partitions.set(normalizedTenantId, nextState);
    return Object.freeze({
      accepted: staged.accepted.length,
      duplicates: staged.duplicates,
      cursor: nextCursor,
    });
  }

  return {
    consumeFeedPage,

    recordCursorInvalid(input) {
      const normalizedTenantId = tenantId(input.tenantId);
      const state = currentState(normalizedTenantId);
      const invalidCursor = requireText(input.invalidCursor, "INVALID_CURSOR_REQUIRED", "失效游标");
      if (state.cursor !== undefined && state.cursor !== invalidCursor) {
        throw feedError("FEED_CURSOR_MISMATCH", "失效游标与已提交游标不一致", "CONFLICT");
      }
      const gapStart = parseTimestamp(input.gapStart, "INVALID_GAP_WINDOW");
      const gapEnd = parseTimestamp(input.gapEnd, "INVALID_GAP_WINDOW");
      parseTimestamp(input.detectedAt, "INVALID_GAP_DETECTED_AT");
      if (gapEnd < gapStart) {
        throw feedError("INVALID_GAP_WINDOW", "游标缺口结束时间不能早于开始时间", "VALIDATION");
      }
      const gap: FeedCursorGap = {
        invalidCursor,
        start: input.gapStart,
        end: input.gapEnd,
        detectedAt: input.detectedAt,
        status: "OPEN",
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
        ...(input.traceId === undefined ? {} : { traceId: input.traceId }),
        ...(input.upstreamReference === undefined
          ? {}
          : { upstreamReference: input.upstreamReference }),
      };
      const paused = freezeState({
        tenantId: normalizedTenantId,
        status: "PAUSED_CURSOR_GAP",
        ...(state.cursor === undefined ? {} : { cursor: state.cursor }),
        gap,
      });
      partitions.set(normalizedTenantId, paused);
      updateMetrics(normalizedTenantId, { cursorGapsDetected: 1 });
      appendAudit({
        tenantId: normalizedTenantId,
        action: "CURSOR_GAP_DETECTED",
        occurredAt: input.detectedAt,
        detail: `暂停分区并记录缺口 ${input.gapStart} 至 ${input.gapEnd}`,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
        ...(input.traceId === undefined ? {} : { traceId: input.traceId }),
        ...(input.upstreamReference === undefined
          ? {}
          : { upstreamReference: input.upstreamReference }),
      });
      return paused;
    },

    recoverCursorGap(input) {
      const normalizedTenantId = tenantId(input.tenantId);
      const state = currentState(normalizedTenantId);
      if (state.status !== "PAUSED_CURSOR_GAP" || state.gap?.status !== "OPEN") {
        throw feedError("CURSOR_GAP_NOT_OPEN", "当前租户没有待恢复的游标缺口", "CONFLICT");
      }
      parseTimestamp(input.recoveredAt, "INVALID_GAP_RECOVERED_AT");
      const resumeCursor = requireText(input.resumeCursor, "RESUME_CURSOR_REQUIRED", "恢复游标");
      const staged = stageRecords(normalizedTenantId, input.records);
      for (const record of staged.accepted) {
        const happenedAt = parseTimestamp(record.happenedAt);
        if (
          happenedAt < parseTimestamp(state.gap.start) ||
          happenedAt > parseTimestamp(state.gap.end)
        ) {
          throw feedError("BACKFILL_OUTSIDE_GAP", "历史回补事实超出已记录缺口窗口", "VALIDATION");
        }
      }
      commitRecords(staged);
      const recoveredGap: FeedCursorGap = {
        ...state.gap,
        status: "RECOVERED",
        recoveredAt: input.recoveredAt,
        recoveredRecords: staged.accepted.length,
      };
      const recovered = freezeState({
        tenantId: normalizedTenantId,
        status: "ACTIVE",
        cursor: resumeCursor,
        gap: recoveredGap,
      });
      partitions.set(normalizedTenantId, recovered);
      updateMetrics(normalizedTenantId, { cursorGapsRecovered: 1 });
      appendAudit({
        tenantId: normalizedTenantId,
        action: "CURSOR_GAP_RECOVERED",
        occurredAt: input.recoveredAt,
        detail: `历史回补 ${staged.accepted.length} 条，恢复游标 ${resumeCursor}`,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
        ...(input.traceId === undefined ? {} : { traceId: input.traceId }),
        ...(state.gap.upstreamReference === undefined
          ? {}
          : { upstreamReference: state.gap.upstreamReference }),
      });
      return recovered;
    },

    processFeedCycle(input) {
      const now = parseTimestamp(input.now, "INVALID_FEED_CYCLE_TIME");
      const results: FeedCycleResult["results"][number][] = [];
      for (const partition of input.partitions) {
        const normalizedTenantId = tenantId(partition.tenantId);
        if (partition.outcome.kind === "RATE_LIMIT") {
          if (partition.outcome.retryAfterSeconds <= 0 || partition.outcome.attempt < 1) {
            throw feedError("INVALID_RATE_LIMIT", "限流退避参数无效", "VALIDATION");
          }
          const state = currentState(normalizedTenantId);
          const exponentialSeconds = Math.min(300, 2 ** partition.outcome.attempt);
          const delaySeconds = Math.max(partition.outcome.retryAfterSeconds, exponentialSeconds);
          const nextRetryAt = new Date(now + delaySeconds * 1000).toISOString();
          partitions.set(
            normalizedTenantId,
            freezeState({
              tenantId: normalizedTenantId,
              status: "THROTTLED",
              ...(state.cursor === undefined ? {} : { cursor: state.cursor }),
              nextRetryAt,
            }),
          );
          updateMetrics(normalizedTenantId, { rateLimitEvents: 1 });
          appendAudit({
            tenantId: normalizedTenantId,
            action: "RATE_LIMITED",
            occurredAt: input.now,
            detail: `租户分区退避至 ${nextRetryAt}`,
            ...(partition.outcome.upstreamReference === undefined
              ? {}
              : { upstreamReference: partition.outcome.upstreamReference }),
          });
          results.push(
            Object.freeze({ tenantId: normalizedTenantId, status: "THROTTLED", nextRetryAt }),
          );
          continue;
        }

        const state = currentState(normalizedTenantId);
        if (state.status === "THROTTLED") {
          const retryAt = parseTimestamp(state.nextRetryAt ?? "", "INVALID_RETRY_TIME");
          if (now < retryAt) {
            throw feedError(
              "FEED_PARTITION_THROTTLED",
              "Feed 分区尚未到达租户退避重试时间",
              "UPSTREAM",
              true,
            );
          }
          partitions.set(
            normalizedTenantId,
            freezeState({
              tenantId: normalizedTenantId,
              status: "ACTIVE",
              ...(state.cursor === undefined ? {} : { cursor: state.cursor }),
            }),
          );
        }
        const page = consumeFeedPage({
          tenantId: normalizedTenantId,
          ...(partition.outcome.startCursor === undefined
            ? {}
            : { startCursor: partition.outcome.startCursor }),
          nextCursor: partition.outcome.nextCursor,
          records: partition.outcome.records,
        });
        results.push(
          Object.freeze({
            tenantId: normalizedTenantId,
            status: "PROCESSED",
            accepted: page.accepted,
            duplicates: page.duplicates,
            cursor: page.cursor,
          }),
        );
      }
      return Object.freeze({ results: Object.freeze(results) });
    },

    getPartitionState(value) {
      return currentState(value);
    },

    listEvents(value) {
      const normalizedTenantId = tenantId(value);
      const tenantEvents = [...(events.get(normalizedTenantId)?.values() ?? [])];
      return Object.freeze(
        tenantEvents.sort(
          (left, right) =>
            parseTimestamp(left.happenedAt) - parseTimestamp(right.happenedAt) ||
            parseTimestamp(left.receivedAt) - parseTimestamp(right.receivedAt),
        ),
      );
    },

    listAuditEvents(value) {
      const normalizedTenantId = tenantId(value);
      return Object.freeze([...(audits.get(normalizedTenantId) ?? [])]);
    },

    getMetrics(value) {
      const normalizedTenantId = tenantId(value);
      return Object.freeze({ ...currentMetrics(normalizedTenantId) });
    },
  };
}
