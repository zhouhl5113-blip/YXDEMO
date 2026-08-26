import { randomUUID } from "node:crypto";

import { AppError } from "../../contracts/src/index.ts";

export type DispatchStatus =
  | "DRAFT"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "IN_TRANSIT"
  | "COMPLETED"
  | "CANCELLED";

export type DispatchSyncStatus =
  | "NOT_QUEUED"
  | "PENDING"
  | "SYNCING"
  | "RETRYING"
  | "SYNCED"
  | "FAILED"
  | "REVOKED";

export type CandidateDecision = "AVAILABLE" | "AVAILABLE_WITH_WARNING" | "BLOCKED";

export interface DispatchConflict {
  readonly kind: "DRIVER" | "VEHICLE" | "VEHICLE_IDENTITY";
  readonly objectLabel: string;
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface DispatchCandidate {
  readonly candidateId: string;
  readonly vehicleId: string;
  readonly vehicleLabel: string;
  readonly driverId: string;
  readonly driverLabel: string;
  readonly identity: "PRIMARY" | "TRAILER" | "OTHER";
  readonly organizationInScope: boolean;
  readonly qualificationsValid: boolean;
  readonly availability: "AVAILABLE" | "WARNING" | "BLOCKED";
  readonly availabilityReason?: string;
  readonly conflicts: readonly DispatchConflict[];
  readonly freshness: {
    readonly status: "FRESH" | "DELAYED" | "STALE" | "UNKNOWN";
    readonly observedAt: string;
    readonly source: string;
  };
  readonly distanceKm: number;
}

export interface CandidateFinding {
  readonly code: string;
  readonly message: string;
}

export interface CandidateEvaluation {
  readonly candidate: DispatchCandidate;
  readonly decision: CandidateDecision;
  readonly blockers: readonly CandidateFinding[];
  readonly advisories: readonly CandidateFinding[];
}

export interface DispatchSelection {
  readonly candidateId: string;
  readonly selectedAt: string;
  readonly overrideReason?: string;
}

export interface Dispatch {
  readonly id: string;
  readonly tenantId: string;
  readonly businessNo: string;
  readonly origin: string;
  readonly destination: string;
  readonly plannedStart: string;
  readonly plannedEnd: string;
  readonly ownerId: string;
  readonly notes?: string;
  readonly status: DispatchStatus;
  readonly syncStatus: DispatchSyncStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly selection?: DispatchSelection;
}

export interface CreateDispatchDraftInput {
  readonly tenantId: string;
  readonly businessNo: string;
  readonly origin: string;
  readonly destination: string;
  readonly plannedStart: string;
  readonly plannedEnd: string;
  readonly ownerId: string;
  readonly notes?: string;
}

export interface ExistingAssignment {
  readonly dispatchId: string;
  readonly driverId: string;
  readonly vehicleId: string;
  readonly identity: DispatchCandidate["identity"];
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface ConfirmDispatchInput {
  readonly tenantId: string;
  readonly dispatchId: string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly existingAssignments: readonly ExistingAssignment[];
  readonly requestId?: string;
  readonly traceId?: string;
}

export interface DispatchSyncError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface DispatchSyncCommand {
  readonly id: string;
  readonly tenantId: string;
  readonly dispatchId: string;
  readonly type: "G7_DRIVER_VEHICLE_ASSIGNMENT_UPSERT";
  readonly status: "PENDING" | "RETRYING" | "FAILED" | "SYNCED" | "REVOKED";
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly attemptCount: number;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly lastAttemptAt?: string;
  readonly completedAt?: string;
  readonly upstreamReference?: string;
  readonly lastError?: DispatchSyncError;
  readonly result?: "CREATED" | "ALREADY_EXISTS";
  readonly revokedReason?: string;
  readonly payload: {
    readonly vehicleId: string;
    readonly driverId: string;
    readonly identity: DispatchCandidate["identity"];
    readonly startsAt: string;
    readonly endsAt: string;
  };
}

export interface AdministratorOperationsWork {
  readonly id: string;
  readonly tenantId: string;
  readonly dispatchId: string;
  readonly syncCommandId: string;
  readonly type: "G7_SYNC_BACKLOG";
  readonly status: "OPEN";
  readonly title: string;
  readonly impact: string;
  readonly generatedAt: string;
  readonly oldestAgeMinutes: number;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly upstreamReference?: string;
}

export interface RecordSyncFailureInput {
  readonly tenantId: string;
  readonly commandId: string;
  readonly attemptedAt: string;
  readonly errorCode: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly upstreamReference?: string;
}

export interface RetrySyncCommandInput {
  readonly tenantId: string;
  readonly commandId: string;
  readonly requestedAt: string;
}

export interface CompleteSyncCommandInput {
  readonly tenantId: string;
  readonly commandId: string;
  readonly completedAt: string;
  readonly outcome: "CREATED" | "ALREADY_EXISTS";
  readonly upstreamReference?: string;
}

export interface RevokeSyncCommandInput {
  readonly tenantId: string;
  readonly commandId: string;
  readonly revokedAt: string;
  readonly reason: string;
}

export interface DispatchTimelineFact {
  readonly sourceEventId: string;
  readonly type: "PLAN" | "GEOFENCE" | "LOCATION" | "STATUS" | "EXCEPTION" | "RECEIPT";
  readonly source: string;
  readonly happenedAt: string;
  readonly receivedAt: string;
  readonly summary: string;
  readonly location?: string;
}

export interface DispatchTimelineProjection {
  readonly events: readonly DispatchTimelineFact[];
  readonly latestLocation?: DispatchTimelineFact;
}

export interface InTransitTimelineProjection extends DispatchTimelineProjection {
  readonly tripSegmentSearchUsed: boolean;
}

export interface TripSegmentSearchPort {
  search(input: {
    readonly tenantId: string;
    readonly dispatchId: string;
  }): readonly DispatchTimelineFact[];
}

export interface DispatchFollowUpWork {
  readonly id: string;
  readonly tenantId: string;
  readonly dispatchId: string;
  readonly vehicleId: string;
  readonly driverId: string;
  readonly sourceEventId: string;
  readonly ownerId: string;
  readonly dueAt: string;
  readonly closureCriteria: string;
  readonly title: string;
  readonly status: "OPEN";
  readonly createdAt: string;
}

export interface CreateTimelineWorkInput {
  readonly tenantId: string;
  readonly dispatchId: string;
  readonly sourceEventId: string;
  readonly ownerId: string;
  readonly dueAt: string;
  readonly closureCriteria: string;
}

export interface DispatchServiceOptions {
  readonly idFactory?: (prefix: string) => string;
  readonly clock?: () => string;
  readonly tripSegmentSearch?: TripSegmentSearchPort;
}

export interface DispatchService {
  createDraft(input: CreateDispatchDraftInput): {
    readonly dispatch: Dispatch;
    readonly outboundCommands: readonly DispatchSyncCommand[];
  };
  evaluateCandidate(dispatchId: string, candidate: DispatchCandidate): CandidateEvaluation;
  selectCandidate(
    dispatchId: string,
    candidateId: string,
    overrideReason?: string,
  ): DispatchSelection;
  confirmDispatch(input: ConfirmDispatchInput): {
    readonly dispatch: Dispatch;
    readonly syncCommand: DispatchSyncCommand;
  };
  recordSyncFailure(input: RecordSyncFailureInput): {
    readonly dispatch: Dispatch;
    readonly syncCommand: DispatchSyncCommand;
  };
  retrySyncCommand(input: RetrySyncCommandInput): {
    readonly dispatch: Dispatch;
    readonly syncCommand: DispatchSyncCommand;
  };
  completeSyncCommand(input: CompleteSyncCommandInput): {
    readonly dispatch: Dispatch;
    readonly syncCommand: DispatchSyncCommand;
  };
  revokeSyncCommand(input: RevokeSyncCommandInput): {
    readonly dispatch: Dispatch;
    readonly syncCommand: DispatchSyncCommand;
  };
  inspectSyncBacklog(input: {
    readonly tenantId: string;
    readonly now: string;
    readonly thresholdMinutes: number;
  }): readonly AdministratorOperationsWork[];
  appendTimelineFact(dispatchId: string, fact: DispatchTimelineFact): DispatchTimelineFact;
  createWorkFromTimelineFact(input: CreateTimelineWorkInput): DispatchFollowUpWork;
  listTodayWork(input: {
    readonly tenantId: string;
    readonly windowStart: string;
    readonly windowEnd: string;
  }): readonly DispatchFollowUpWork[];
  getInTransitTimeline(input: {
    readonly tenantId: string;
    readonly dispatchId: string;
    readonly tripSegmentSearchEnabled: boolean;
  }): InTransitTimelineProjection;
  getDispatch(dispatchId: string): Dispatch;
  getSyncCommand(tenantId: string, commandId: string): DispatchSyncCommand;
  getCandidateEvaluations(dispatchId: string): readonly CandidateEvaluation[];
  getPendingSyncCommands(): readonly DispatchSyncCommand[];
  getTimeline(dispatchId: string): DispatchTimelineProjection;
}

function appError(
  code: string,
  message: string,
  category: "CONFLICT" | "NOT_FOUND" | "VALIDATION",
) {
  return new AppError({ code, category, message, retryable: false });
}

function requireText(value: string, code: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw appError(code, `${label}不能为空`, "VALIDATION");
  }
  return normalized;
}

function timestamp(value: string, code = "INVALID_TIMESTAMP"): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw appError(code, "时间必须是有效的 RFC 3339 格式", "VALIDATION");
  }
  return parsed;
}

function validateWindow(startsAt: string, endsAt: string): void {
  const start = timestamp(startsAt, "INVALID_DISPATCH_WINDOW");
  const end = timestamp(endsAt, "INVALID_DISPATCH_WINDOW");
  if (end <= start) {
    throw appError("INVALID_DISPATCH_WINDOW", "派车结束时间必须晚于开始时间", "VALIDATION");
  }
}

function overlaps(
  plannedStart: string,
  plannedEnd: string,
  existingStart: string,
  existingEnd: string,
): boolean {
  validateWindow(existingStart, existingEnd);
  return (
    timestamp(plannedStart) < timestamp(existingEnd) &&
    timestamp(existingStart) < timestamp(plannedEnd)
  );
}

function freezeCandidate(candidate: DispatchCandidate): DispatchCandidate {
  return Object.freeze({
    ...candidate,
    conflicts: Object.freeze(candidate.conflicts.map((conflict) => Object.freeze({ ...conflict }))),
    freshness: Object.freeze({ ...candidate.freshness }),
  });
}

export function createDispatchService(options: DispatchServiceOptions = {}): DispatchService {
  const idFactory = options.idFactory ?? ((prefix: string) => `${prefix}-${randomUUID()}`);
  const clock = options.clock ?? (() => new Date().toISOString());
  const dispatches = new Map<string, Dispatch>();
  const evaluations = new Map<string, Map<string, CandidateEvaluation>>();
  const commands = new Map<string, DispatchSyncCommand>();
  const idempotencyResults = new Map<
    string,
    { readonly dispatch: Dispatch; readonly syncCommand: DispatchSyncCommand }
  >();
  const timelineFacts = new Map<string, Map<string, DispatchTimelineFact>>();
  const operationsWork = new Map<string, AdministratorOperationsWork>();
  const followUpWork = new Map<string, DispatchFollowUpWork>();
  const followUpWorkBySource = new Map<string, string>();

  function getDispatch(dispatchId: string): Dispatch {
    const dispatch = dispatches.get(dispatchId);
    if (dispatch === undefined) {
      throw appError("DISPATCH_NOT_FOUND", "未找到派车记录", "NOT_FOUND");
    }
    return dispatch;
  }

  function getEvaluation(dispatchId: string, candidateId: string): CandidateEvaluation {
    getDispatch(dispatchId);
    const evaluation = evaluations.get(dispatchId)?.get(candidateId);
    if (evaluation === undefined) {
      throw appError("CANDIDATE_NOT_FOUND", "未找到派车候选", "NOT_FOUND");
    }
    return evaluation;
  }

  function getTenantDispatch(tenantId: string, dispatchId: string): Dispatch {
    const dispatch = getDispatch(dispatchId);
    if (dispatch.tenantId !== tenantId) {
      throw appError("DISPATCH_NOT_FOUND", "未找到派车记录", "NOT_FOUND");
    }
    return dispatch;
  }

  function timelineProjection(events: readonly DispatchTimelineFact[]): DispatchTimelineProjection {
    const orderedEvents = [...events].sort(
      (left, right) => timestamp(left.happenedAt) - timestamp(right.happenedAt),
    );
    const latestLocation = orderedEvents
      .filter((event) => event.type === "LOCATION" && event.location !== undefined)
      .reduce<DispatchTimelineFact | undefined>((latest, event) => {
        if (latest === undefined || timestamp(event.happenedAt) > timestamp(latest.happenedAt)) {
          return event;
        }
        return latest;
      }, undefined);
    return Object.freeze({
      events: Object.freeze(orderedEvents),
      ...(latestLocation === undefined ? {} : { latestLocation }),
    });
  }

  function getSyncCommand(tenantId: string, commandId: string): DispatchSyncCommand {
    const command = commands.get(commandId);
    if (command === undefined || command.tenantId !== tenantId) {
      throw appError("SYNC_COMMAND_NOT_FOUND", "未找到同步命令", "NOT_FOUND");
    }
    return command;
  }

  function updateSyncState(
    dispatchId: string,
    status: DispatchSyncStatus,
    updatedAt: string,
    businessStatus?: DispatchStatus,
  ): Dispatch {
    const dispatch = getDispatch(dispatchId);
    const updated: Dispatch = Object.freeze({
      ...dispatch,
      status: businessStatus ?? dispatch.status,
      syncStatus: status,
      version: dispatch.version + 1,
      updatedAt,
    });
    dispatches.set(dispatchId, updated);
    return updated;
  }

  return {
    createDraft(input) {
      validateWindow(input.plannedStart, input.plannedEnd);
      const now = clock();
      timestamp(now);
      const dispatch: Dispatch = Object.freeze({
        id: idFactory("dispatch"),
        tenantId: requireText(input.tenantId, "TENANT_REQUIRED", "租户"),
        businessNo: requireText(input.businessNo, "BUSINESS_NO_REQUIRED", "业务单号"),
        origin: requireText(input.origin, "ORIGIN_REQUIRED", "起点"),
        destination: requireText(input.destination, "DESTINATION_REQUIRED", "终点"),
        plannedStart: input.plannedStart,
        plannedEnd: input.plannedEnd,
        ownerId: requireText(input.ownerId, "OWNER_REQUIRED", "负责人"),
        ...(input.notes === undefined ? {} : { notes: input.notes.trim() }),
        status: "DRAFT",
        syncStatus: "NOT_QUEUED",
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      dispatches.set(dispatch.id, dispatch);
      return Object.freeze({ dispatch, outboundCommands: Object.freeze([]) });
    },

    evaluateCandidate(dispatchId, inputCandidate) {
      getDispatch(dispatchId);
      const candidate = freezeCandidate(inputCandidate);
      const blockers: CandidateFinding[] = [];
      const advisories: CandidateFinding[] = [];

      if (!candidate.organizationInScope) {
        blockers.push({
          code: "ORGANIZATION_OUT_OF_SCOPE",
          message: "候选资源不在当前授权组织范围内",
        });
      }
      if (!candidate.qualificationsValid) {
        blockers.push({
          code: "QUALIFICATION_INVALID",
          message: "司机或车辆资格无效",
        });
      }
      if (candidate.availability === "BLOCKED") {
        blockers.push({
          code: "RESOURCE_UNAVAILABLE",
          message: candidate.availabilityReason ?? "候选资源当前不可用",
        });
      }
      for (const conflict of candidate.conflicts) {
        blockers.push({
          code: `${conflict.kind}_TIME_CONFLICT`,
          message: `${conflict.objectLabel}存在时间重叠的任务`,
        });
      }
      if (candidate.availability === "WARNING") {
        advisories.push({
          code: "AVAILABILITY_WARNING",
          message: candidate.availabilityReason ?? "候选资源需要人工复核",
        });
      }
      if (candidate.freshness.status !== "FRESH") {
        advisories.push({
          code: "DATA_NOT_FRESH",
          message: `候选事实新鲜度为 ${candidate.freshness.status}`,
        });
      }

      const decision: CandidateDecision =
        blockers.length > 0
          ? "BLOCKED"
          : advisories.length > 0
            ? "AVAILABLE_WITH_WARNING"
            : "AVAILABLE";
      const evaluation: CandidateEvaluation = Object.freeze({
        candidate,
        decision,
        blockers: Object.freeze(blockers.map((finding) => Object.freeze(finding))),
        advisories: Object.freeze(advisories.map((finding) => Object.freeze(finding))),
      });
      const byCandidate = evaluations.get(dispatchId) ?? new Map<string, CandidateEvaluation>();
      byCandidate.set(candidate.candidateId, evaluation);
      evaluations.set(dispatchId, byCandidate);
      return evaluation;
    },

    selectCandidate(dispatchId, candidateId, overrideReason) {
      const dispatch = getDispatch(dispatchId);
      if (dispatch.status !== "DRAFT") {
        throw appError("DISPATCH_NOT_EDITABLE", "只有草稿状态的派车可以选择候选资源", "CONFLICT");
      }
      const evaluation = getEvaluation(dispatchId, candidateId);
      if (evaluation.decision === "BLOCKED") {
        throw appError("CANDIDATE_BLOCKED", "不可选择已阻断的候选资源", "CONFLICT");
      }
      const normalizedReason = overrideReason?.trim();
      if (evaluation.decision === "AVAILABLE_WITH_WARNING" && !normalizedReason) {
        throw appError(
          "OVERRIDE_REASON_REQUIRED",
          "选择存在建议项的候选资源时必须填写覆盖理由",
          "VALIDATION",
        );
      }
      const now = clock();
      const selection: DispatchSelection = Object.freeze({
        candidateId,
        selectedAt: now,
        ...(normalizedReason === undefined ? {} : { overrideReason: normalizedReason }),
      });
      const updated: Dispatch = Object.freeze({
        ...dispatch,
        selection,
        version: dispatch.version + 1,
        updatedAt: now,
      });
      dispatches.set(dispatchId, updated);
      return selection;
    },

    confirmDispatch(input) {
      const normalizedKey = requireText(input.idempotencyKey, "IDEMPOTENCY_KEY_REQUIRED", "幂等键");
      const replayKey = `${input.tenantId}:CONFIRM_DISPATCH:${normalizedKey}`;
      const replay = idempotencyResults.get(replayKey);
      if (replay !== undefined) {
        return replay;
      }

      const dispatch = getDispatch(input.dispatchId);
      if (dispatch.tenantId !== input.tenantId) {
        throw appError("DISPATCH_NOT_FOUND", "未找到派车记录", "NOT_FOUND");
      }
      if (dispatch.version !== input.expectedVersion) {
        throw appError(
          "DISPATCH_VERSION_CONFLICT",
          "派车记录已被其他操作更新，请刷新后重试",
          "CONFLICT",
        );
      }
      if (dispatch.status !== "DRAFT" || dispatch.selection === undefined) {
        throw appError(
          "DISPATCH_NOT_CONFIRMABLE",
          "确认派车需要草稿状态且已选择候选资源",
          "CONFLICT",
        );
      }
      validateWindow(dispatch.plannedStart, dispatch.plannedEnd);
      const evaluation = getEvaluation(dispatch.id, dispatch.selection.candidateId);
      if (evaluation.decision === "BLOCKED") {
        throw appError("CANDIDATE_BLOCKED", "不可确认已阻断的候选资源", "CONFLICT");
      }
      const candidate = evaluation.candidate;
      for (const assignment of input.existingAssignments) {
        if (
          !overlaps(
            dispatch.plannedStart,
            dispatch.plannedEnd,
            assignment.startsAt,
            assignment.endsAt,
          )
        ) {
          continue;
        }
        if (assignment.driverId === candidate.driverId) {
          throw appError("DRIVER_TIME_CONFLICT", "该司机已有时间重叠的人车绑定任务", "CONFLICT");
        }
        if (
          assignment.vehicleId === candidate.vehicleId &&
          assignment.identity === candidate.identity
        ) {
          throw appError(
            "VEHICLE_IDENTITY_TIME_CONFLICT",
            "该车辆身份已有时间重叠的任务",
            "CONFLICT",
          );
        }
      }

      const now = clock();
      const confirmed: Dispatch = Object.freeze({
        ...dispatch,
        status: "CONFIRMED",
        syncStatus: "PENDING",
        version: dispatch.version + 1,
        updatedAt: now,
      });
      const syncCommand: DispatchSyncCommand = Object.freeze({
        id: idFactory("sync-command"),
        tenantId: dispatch.tenantId,
        dispatchId: dispatch.id,
        type: "G7_DRIVER_VEHICLE_ASSIGNMENT_UPSERT",
        status: "PENDING",
        idempotencyKey: normalizedKey,
        createdAt: now,
        attemptCount: 0,
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
        ...(input.traceId === undefined ? {} : { traceId: input.traceId }),
        payload: Object.freeze({
          vehicleId: candidate.vehicleId,
          driverId: candidate.driverId,
          identity: candidate.identity,
          startsAt: dispatch.plannedStart,
          endsAt: dispatch.plannedEnd,
        }),
      });
      const result = Object.freeze({ dispatch: confirmed, syncCommand });
      dispatches.set(dispatch.id, confirmed);
      commands.set(syncCommand.id, syncCommand);
      idempotencyResults.set(replayKey, result);
      return result;
    },

    recordSyncFailure(input) {
      const command = getSyncCommand(input.tenantId, input.commandId);
      if (command.status === "SYNCED" || command.status === "REVOKED") {
        throw appError("SYNC_COMMAND_TERMINAL", "已同步或已撤销的命令不能记录失败", "CONFLICT");
      }
      timestamp(input.attemptedAt);
      const lastError: DispatchSyncError = Object.freeze({
        code: requireText(input.errorCode, "SYNC_ERROR_CODE_REQUIRED", "同步错误代码"),
        message: requireText(input.message, "SYNC_ERROR_MESSAGE_REQUIRED", "同步错误说明"),
        retryable: input.retryable,
      });
      const failedCommand: DispatchSyncCommand = Object.freeze({
        ...command,
        status: "FAILED",
        attemptCount: command.attemptCount + 1,
        lastAttemptAt: input.attemptedAt,
        lastError,
        ...(input.upstreamReference === undefined
          ? {}
          : { upstreamReference: input.upstreamReference }),
      });
      commands.set(command.id, failedCommand);
      const dispatch = updateSyncState(command.dispatchId, "FAILED", input.attemptedAt);
      return Object.freeze({ dispatch, syncCommand: failedCommand });
    },

    retrySyncCommand(input) {
      const command = getSyncCommand(input.tenantId, input.commandId);
      if (command.status === "RETRYING") {
        return Object.freeze({
          dispatch: getDispatch(command.dispatchId),
          syncCommand: command,
        });
      }
      if (command.status !== "FAILED") {
        throw appError("SYNC_COMMAND_NOT_RETRYABLE", "只有失败的同步命令可以重试", "CONFLICT");
      }
      if (command.lastError?.retryable !== true) {
        throw appError(
          "SYNC_ERROR_NOT_RETRYABLE",
          "该同步失败需要人工处理，不能自动重试",
          "CONFLICT",
        );
      }
      timestamp(input.requestedAt);
      const retryingCommand: DispatchSyncCommand = Object.freeze({
        ...command,
        status: "RETRYING",
        attemptCount: command.attemptCount + 1,
        lastAttemptAt: input.requestedAt,
      });
      commands.set(command.id, retryingCommand);
      const dispatch = updateSyncState(command.dispatchId, "RETRYING", input.requestedAt);
      return Object.freeze({ dispatch, syncCommand: retryingCommand });
    },

    completeSyncCommand(input) {
      const command = getSyncCommand(input.tenantId, input.commandId);
      if (command.status === "SYNCED") {
        return Object.freeze({
          dispatch: getDispatch(command.dispatchId),
          syncCommand: command,
        });
      }
      if (command.status === "REVOKED") {
        throw appError("SYNC_COMMAND_REVOKED", "已撤销的同步命令不能标记为成功", "CONFLICT");
      }
      timestamp(input.completedAt);
      const syncedCommand: DispatchSyncCommand = Object.freeze({
        ...command,
        status: "SYNCED",
        completedAt: input.completedAt,
        lastAttemptAt: input.completedAt,
        attemptCount:
          command.status === "PENDING" ? command.attemptCount + 1 : command.attemptCount,
        result: input.outcome,
        ...(input.upstreamReference === undefined
          ? {}
          : { upstreamReference: input.upstreamReference }),
      });
      commands.set(command.id, syncedCommand);
      const dispatch = updateSyncState(command.dispatchId, "SYNCED", input.completedAt);
      return Object.freeze({ dispatch, syncCommand: syncedCommand });
    },

    revokeSyncCommand(input) {
      const command = getSyncCommand(input.tenantId, input.commandId);
      if (command.status === "REVOKED") {
        return Object.freeze({
          dispatch: getDispatch(command.dispatchId),
          syncCommand: command,
        });
      }
      if (command.status === "SYNCED") {
        throw appError(
          "SYNCED_BINDING_REQUIRES_COMPENSATION",
          "已生效的 G7 绑定需要单独补偿流程，不能直接撤销本地命令",
          "CONFLICT",
        );
      }
      timestamp(input.revokedAt);
      const revokedCommand: DispatchSyncCommand = Object.freeze({
        ...command,
        status: "REVOKED",
        revokedReason: requireText(input.reason, "REVOKE_REASON_REQUIRED", "撤销原因"),
      });
      commands.set(command.id, revokedCommand);
      const dispatch = updateSyncState(command.dispatchId, "REVOKED", input.revokedAt, "CANCELLED");
      return Object.freeze({ dispatch, syncCommand: revokedCommand });
    },

    inspectSyncBacklog(input) {
      const now = timestamp(input.now);
      if (!Number.isFinite(input.thresholdMinutes) || input.thresholdMinutes <= 0) {
        throw appError("INVALID_BACKLOG_THRESHOLD", "积压阈值必须大于零", "VALIDATION");
      }
      for (const command of commands.values()) {
        if (command.tenantId !== input.tenantId) continue;
        if (command.status === "SYNCED" || command.status === "REVOKED") continue;
        const ageMinutes = Math.floor((now - timestamp(command.createdAt)) / 60_000);
        if (ageMinutes < input.thresholdMinutes) continue;
        const existing = operationsWork.get(command.id);
        if (existing !== undefined) continue;
        const work: AdministratorOperationsWork = Object.freeze({
          id: idFactory("operations-work"),
          tenantId: command.tenantId,
          dispatchId: command.dispatchId,
          syncCommandId: command.id,
          type: "G7_SYNC_BACKLOG",
          status: "OPEN",
          title: "处理超时的 G7 人车绑定同步",
          impact: "本地派车已确认，但 G7 人车绑定尚未确认生效",
          generatedAt: input.now,
          oldestAgeMinutes: ageMinutes,
          ...(command.requestId === undefined ? {} : { requestId: command.requestId }),
          ...(command.traceId === undefined ? {} : { traceId: command.traceId }),
          ...(command.upstreamReference === undefined
            ? {}
            : { upstreamReference: command.upstreamReference }),
        });
        operationsWork.set(command.id, work);
      }
      return Object.freeze(
        [...operationsWork.values()].filter((work) => work.tenantId === input.tenantId),
      );
    },

    appendTimelineFact(dispatchId, inputFact) {
      getDispatch(dispatchId);
      timestamp(inputFact.happenedAt);
      timestamp(inputFact.receivedAt);
      const bySource = timelineFacts.get(dispatchId) ?? new Map<string, DispatchTimelineFact>();
      const existing = bySource.get(inputFact.sourceEventId);
      if (existing !== undefined) {
        return existing;
      }
      const fact: DispatchTimelineFact = Object.freeze({ ...inputFact });
      bySource.set(fact.sourceEventId, fact);
      timelineFacts.set(dispatchId, bySource);
      return fact;
    },

    createWorkFromTimelineFact(input) {
      const dispatch = getTenantDispatch(input.tenantId, input.dispatchId);
      if (
        dispatch.selection === undefined ||
        (dispatch.status !== "CONFIRMED" && dispatch.status !== "IN_TRANSIT")
      ) {
        throw appError(
          "DISPATCH_NOT_ACTIVE",
          "只有已确认或在途派车可以从时间线创建工作",
          "CONFLICT",
        );
      }
      const sourceFact = timelineFacts.get(dispatch.id)?.get(input.sourceEventId);
      if (sourceFact === undefined || sourceFact.type !== "EXCEPTION") {
        throw appError("EXCEPTION_FACT_NOT_FOUND", "未找到可创建工作的异常来源事实", "NOT_FOUND");
      }
      const sourceKey = `${input.tenantId}:${input.dispatchId}:${input.sourceEventId}`;
      const existingId = followUpWorkBySource.get(sourceKey);
      if (existingId !== undefined) {
        const existing = followUpWork.get(existingId);
        if (existing !== undefined) return existing;
      }
      const dueAt = timestamp(input.dueAt, "INVALID_WORK_DUE_AT");
      if (dueAt <= timestamp(sourceFact.happenedAt)) {
        throw appError("INVALID_WORK_DUE_AT", "工作截止时间必须晚于异常发生时间", "VALIDATION");
      }
      const candidate = getEvaluation(dispatch.id, dispatch.selection.candidateId).candidate;
      const createdAt = clock();
      timestamp(createdAt);
      const work: DispatchFollowUpWork = Object.freeze({
        id: idFactory("dispatch-work"),
        tenantId: dispatch.tenantId,
        dispatchId: dispatch.id,
        vehicleId: candidate.vehicleId,
        driverId: candidate.driverId,
        sourceEventId: sourceFact.sourceEventId,
        ownerId: requireText(input.ownerId, "WORK_OWNER_REQUIRED", "工作责任人"),
        dueAt: input.dueAt,
        closureCriteria: requireText(
          input.closureCriteria,
          "WORK_CLOSURE_CRITERIA_REQUIRED",
          "关闭条件",
        ),
        title: `处置：${sourceFact.summary}`,
        status: "OPEN",
        createdAt,
      });
      followUpWork.set(work.id, work);
      followUpWorkBySource.set(sourceKey, work.id);
      return work;
    },

    listTodayWork(input) {
      const start = timestamp(input.windowStart, "INVALID_TODAY_WINDOW");
      const end = timestamp(input.windowEnd, "INVALID_TODAY_WINDOW");
      if (end <= start) {
        throw appError("INVALID_TODAY_WINDOW", "今日工作时间窗无效", "VALIDATION");
      }
      return Object.freeze(
        [...followUpWork.values()]
          .filter(
            (work) =>
              work.tenantId === input.tenantId &&
              timestamp(work.dueAt) >= start &&
              timestamp(work.dueAt) < end,
          )
          .sort((left, right) => timestamp(left.dueAt) - timestamp(right.dueAt)),
      );
    },

    getInTransitTimeline(input) {
      getTenantDispatch(input.tenantId, input.dispatchId);
      const localFacts = [...(timelineFacts.get(input.dispatchId)?.values() ?? [])];
      if (!input.tripSegmentSearchEnabled) {
        return Object.freeze({
          ...timelineProjection(localFacts),
          tripSegmentSearchUsed: false,
        });
      }
      if (options.tripSegmentSearch === undefined) {
        throw appError(
          "TRIP_SEGMENT_SEARCH_UNAVAILABLE",
          "trip-segment-search 已开启但 developing 端口未配置",
          "CONFLICT",
        );
      }
      const combined = new Map(localFacts.map((fact) => [fact.sourceEventId, fact]));
      for (const fact of options.tripSegmentSearch.search({
        tenantId: input.tenantId,
        dispatchId: input.dispatchId,
      })) {
        timestamp(fact.happenedAt);
        timestamp(fact.receivedAt);
        if (!combined.has(fact.sourceEventId))
          combined.set(fact.sourceEventId, Object.freeze(fact));
      }
      return Object.freeze({
        ...timelineProjection([...combined.values()]),
        tripSegmentSearchUsed: true,
      });
    },

    getDispatch,

    getSyncCommand,

    getCandidateEvaluations(dispatchId) {
      getDispatch(dispatchId);
      return Object.freeze([...(evaluations.get(dispatchId)?.values() ?? [])]);
    },

    getPendingSyncCommands() {
      return Object.freeze(
        [...commands.values()].filter(
          (command) => command.status !== "SYNCED" && command.status !== "REVOKED",
        ),
      );
    },

    getTimeline(dispatchId) {
      getDispatch(dispatchId);
      return timelineProjection([...(timelineFacts.get(dispatchId)?.values() ?? [])]);
    },
  };
}
