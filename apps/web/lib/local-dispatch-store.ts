import "server-only";

import { AppError } from "../../../packages/contracts/src/index.ts";
import {
  createDispatchService,
  type CandidateEvaluation,
  type CreateDispatchDraftInput,
  type Dispatch,
  type DispatchCandidate,
  type DispatchFollowUpWork,
  type DispatchSyncCommand,
  type DispatchTimelineFact,
  type InTransitTimelineProjection,
} from "../../../packages/dispatch-domain/src/index.ts";
import { assertLocalApiRuntime } from "./local-api.ts";
import { canRoleDispatch, createLocalWorkbenchContext } from "./local-session.ts";

const service = createDispatchService();

const CANDIDATES: readonly DispatchCandidate[] = Object.freeze([
  {
    candidateId: "candidate-su-e8m52",
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
  },
  {
    candidateId: "candidate-zhe-a7k91",
    vehicleId: "vehicle-zhe-a7k91",
    vehicleLabel: "浙A·7K91",
    driverId: "driver-wang",
    driverLabel: "王师傅",
    identity: "PRIMARY",
    organizationInScope: true,
    qualificationsValid: true,
    availability: "WARNING",
    availabilityReason: "距计划起点 42 公里",
    conflicts: [],
    freshness: {
      status: "DELAYED",
      observedAt: "2026-08-25T02:02:00.000Z",
      source: "G7_SANDBOX_SYNTHETIC_FIXTURE",
    },
    distanceKm: 42,
  },
  {
    candidateId: "candidate-hu-a2f18",
    vehicleId: "vehicle-hu-a2f18",
    vehicleLabel: "沪A·2F18",
    driverId: "driver-chen",
    driverLabel: "陈师傅",
    identity: "PRIMARY",
    organizationInScope: true,
    qualificationsValid: false,
    availability: "BLOCKED",
    availabilityReason: "司机从业资格将在任务期间到期",
    conflicts: [
      {
        kind: "DRIVER",
        objectLabel: "陈师傅",
        startsAt: "2026-08-25T03:00:00.000Z",
        endsAt: "2026-08-25T05:00:00.000Z",
      },
    ],
    freshness: {
      status: "FRESH",
      observedAt: "2026-08-25T02:19:00.000Z",
      source: "G7_SANDBOX_SYNTHETIC_FIXTURE",
    },
    distanceKm: 8,
  },
]);

function assertDispatchRole(roleId: string): void {
  createLocalWorkbenchContext(roleId);
  if (!canRoleDispatch(roleId)) {
    throw new AppError({
      code: "DISPATCH_PERMISSION_DENIED",
      category: "AUTHORIZATION",
      message: "当前角色没有派车写权限",
      retryable: false,
    });
  }
}

export function createLocalDispatch(
  roleId: string,
  input: Omit<CreateDispatchDraftInput, "tenantId" | "ownerId">,
): { readonly dispatch: Dispatch; readonly candidates: readonly CandidateEvaluation[] } {
  assertLocalApiRuntime();
  assertDispatchRole(roleId);
  const context = createLocalWorkbenchContext(roleId);
  const result = service.createDraft({
    ...input,
    tenantId: context.tenantScope.tenantId,
    ownerId: context.tenantScope.userId,
  });
  for (const candidate of CANDIDATES) {
    service.evaluateCandidate(result.dispatch.id, candidate);
  }
  return Object.freeze({
    dispatch: result.dispatch,
    candidates: service.getCandidateEvaluations(result.dispatch.id),
  });
}

export function selectLocalDispatchCandidate(
  roleId: string,
  dispatchId: string,
  candidateId: string,
  overrideReason?: string,
): { readonly dispatch: Dispatch; readonly candidates: readonly CandidateEvaluation[] } {
  assertLocalApiRuntime();
  assertDispatchRole(roleId);
  service.selectCandidate(dispatchId, candidateId, overrideReason);
  return Object.freeze({
    dispatch: service.getDispatch(dispatchId),
    candidates: service.getCandidateEvaluations(dispatchId),
  });
}

export function confirmLocalDispatch(
  roleId: string,
  dispatchId: string,
  expectedVersion: number,
  idempotencyKey: string,
) {
  assertLocalApiRuntime();
  assertDispatchRole(roleId);
  const context = createLocalWorkbenchContext(roleId);
  const result = service.confirmDispatch({
    tenantId: context.tenantScope.tenantId,
    dispatchId,
    expectedVersion,
    idempotencyKey,
    existingAssignments: [],
    requestId: context.requestId,
    traceId: context.traceId,
  });
  const timelineFacts: readonly DispatchTimelineFact[] = [
    {
      sourceEventId: `${dispatchId}:plan-departure`,
      type: "PLAN",
      source: "LOCAL_DISPATCH_PLAN",
      happenedAt: result.dispatch.plannedStart,
      receivedAt: result.dispatch.updatedAt,
      summary: `计划从${result.dispatch.origin}发车`,
      location: result.dispatch.origin,
    },
    {
      sourceEventId: `${dispatchId}:location-kunshan`,
      type: "LOCATION",
      source: "G7_SANDBOX_SYNTHETIC_FIXTURE",
      happenedAt: new Date(Date.parse(result.dispatch.plannedStart) + 30 * 60_000).toISOString(),
      receivedAt: new Date(
        Date.parse(result.dispatch.plannedStart) + 30 * 60_000 + 4_000,
      ).toISOString(),
      summary: "车辆进入昆山花桥路段",
      location: "G2 京沪高速 · 昆山花桥附近",
    },
    {
      sourceEventId: `${dispatchId}:geofence-kunshan`,
      type: "GEOFENCE",
      source: "G7_SANDBOX_SYNTHETIC_FIXTURE",
      happenedAt: new Date(Date.parse(result.dispatch.plannedStart) + 42 * 60_000).toISOString(),
      receivedAt: new Date(
        Date.parse(result.dispatch.plannedStart) + 42 * 60_000 + 5_000,
      ).toISOString(),
      summary: "进入昆山中转围栏",
      location: "昆山中转围栏",
    },
    {
      sourceEventId: `${dispatchId}:exception-delay`,
      type: "EXCEPTION",
      source: "LOCAL_SANDBOX_RULE",
      happenedAt: new Date(Date.parse(result.dispatch.plannedStart) + 55 * 60_000).toISOString(),
      receivedAt: new Date(
        Date.parse(result.dispatch.plannedStart) + 55 * 60_000 + 8_000,
      ).toISOString(),
      summary: "预计晚到 42 分钟，客户时窗存在风险",
      location: "G2 京沪高速 · 昆山花桥附近",
    },
  ];
  for (const fact of timelineFacts) service.appendTimelineFact(dispatchId, fact);
  return result;
}

export function getLocalDispatchTimeline(
  roleId: string,
  dispatchId: string,
): InTransitTimelineProjection {
  assertLocalApiRuntime();
  const context = createLocalWorkbenchContext(roleId);
  return service.getInTransitTimeline({
    tenantId: context.tenantScope.tenantId,
    dispatchId,
    tripSegmentSearchEnabled: false,
  });
}

export function createLocalTimelineWork(
  roleId: string,
  dispatchId: string,
  sourceEventId: string,
  dueAt: string,
  closureCriteria: string,
): {
  readonly work: DispatchFollowUpWork;
  readonly dispatch: Dispatch;
  readonly sourceFact: DispatchTimelineFact;
} {
  assertLocalApiRuntime();
  assertDispatchRole(roleId);
  const context = createLocalWorkbenchContext(roleId);
  const work = service.createWorkFromTimelineFact({
    tenantId: context.tenantScope.tenantId,
    dispatchId,
    sourceEventId,
    ownerId: context.tenantScope.userId,
    dueAt,
    closureCriteria,
  });
  const sourceFact = service
    .getInTransitTimeline({
      tenantId: context.tenantScope.tenantId,
      dispatchId,
      tripSegmentSearchEnabled: false,
    })
    .events.find((fact) => fact.sourceEventId === sourceEventId);
  if (sourceFact === undefined) {
    throw new AppError({
      code: "EXCEPTION_FACT_NOT_FOUND",
      category: "NOT_FOUND",
      message: "未找到处置工作的来源事实",
      retryable: false,
    });
  }
  return Object.freeze({ work, dispatch: service.getDispatch(dispatchId), sourceFact });
}

export interface LocalTodayWorkProjection {
  readonly id: string;
  readonly category: "异常";
  readonly urgency: "warning";
  readonly dueAt: string;
  readonly objectId: string;
  readonly route: string;
  readonly summary: string;
  readonly source: string;
  readonly happenedAt: string;
  readonly location: string;
  readonly owner: string;
  readonly nextAction: "查看处置工作";
}

export function listLocalTodayWork(
  roleId: string,
  windowStart: string,
  windowEnd: string,
): readonly LocalTodayWorkProjection[] {
  assertLocalApiRuntime();
  const context = createLocalWorkbenchContext(roleId);
  const workItems = service.listTodayWork({
    tenantId: context.tenantScope.tenantId,
    windowStart,
    windowEnd,
  });
  return Object.freeze(
    workItems.map((work) => {
      const dispatch = service.getDispatch(work.dispatchId);
      const sourceFact = service
        .getInTransitTimeline({
          tenantId: context.tenantScope.tenantId,
          dispatchId: dispatch.id,
          tripSegmentSearchEnabled: false,
        })
        .events.find((fact) => fact.sourceEventId === work.sourceEventId);
      if (sourceFact === undefined) {
        throw new AppError({
          code: "WORK_SOURCE_FACT_NOT_FOUND",
          category: "NOT_FOUND",
          message: "今日工作缺少来源事实",
          retryable: false,
        });
      }
      return Object.freeze({
        id: work.id,
        category: "异常" as const,
        urgency: "warning" as const,
        dueAt: work.dueAt,
        objectId: dispatch.businessNo,
        route: `${dispatch.origin} → ${dispatch.destination}`,
        summary: work.title,
        source: sourceFact.source,
        happenedAt: sourceFact.happenedAt,
        location: sourceFact.location ?? "未提供文字位置",
        owner: "周贺龙",
        nextAction: "查看处置工作" as const,
      });
    }),
  );
}

export type LocalDispatchSyncAction =
  | "SIMULATE_RETRYABLE_FAILURE"
  | "RETRY"
  | "SIMULATE_ALREADY_EXISTS"
  | "REVOKE";

export function updateLocalDispatchSync(
  roleId: string,
  dispatchId: string,
  commandId: string,
  action: LocalDispatchSyncAction,
  reason?: string,
): { readonly dispatch: Dispatch; readonly syncCommand: DispatchSyncCommand } {
  assertLocalApiRuntime();
  assertDispatchRole(roleId);
  const context = createLocalWorkbenchContext(roleId);
  const command = service.getSyncCommand(context.tenantScope.tenantId, commandId);
  if (command.dispatchId !== dispatchId) {
    throw new AppError({
      code: "SYNC_COMMAND_NOT_FOUND",
      category: "NOT_FOUND",
      message: "未找到该派车的同步命令",
      retryable: false,
    });
  }
  const now = new Date().toISOString();
  if (action === "SIMULATE_RETRYABLE_FAILURE") {
    return service.recordSyncFailure({
      tenantId: context.tenantScope.tenantId,
      commandId,
      attemptedAt: now,
      errorCode: "G7_LOCAL_STUB_TIMEOUT",
      message: "受控本地适配器返回暂时超时；本地派车已保留",
      retryable: true,
      upstreamReference: `local-g7-stub:${commandId}`,
    });
  }
  if (action === "RETRY") {
    return service.retrySyncCommand({
      tenantId: context.tenantScope.tenantId,
      commandId,
      requestedAt: now,
    });
  }
  if (action === "SIMULATE_ALREADY_EXISTS") {
    return service.completeSyncCommand({
      tenantId: context.tenantScope.tenantId,
      commandId,
      completedAt: now,
      outcome: "ALREADY_EXISTS",
      upstreamReference: `local-g7-stub:${commandId}:existing`,
    });
  }
  return service.revokeSyncCommand({
    tenantId: context.tenantScope.tenantId,
    commandId,
    revokedAt: now,
    reason: reason ?? "",
  });
}
