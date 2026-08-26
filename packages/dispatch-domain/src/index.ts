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
}

export interface DispatchSyncCommand {
  readonly id: string;
  readonly tenantId: string;
  readonly dispatchId: string;
  readonly type: "G7_DRIVER_VEHICLE_ASSIGNMENT_UPSERT";
  readonly status: "PENDING";
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly payload: {
    readonly vehicleId: string;
    readonly driverId: string;
    readonly identity: DispatchCandidate["identity"];
    readonly startsAt: string;
    readonly endsAt: string;
  };
}

export interface DispatchTimelineFact {
  readonly sourceEventId: string;
  readonly type: "LOCATION" | "STATUS" | "EXCEPTION" | "RECEIPT";
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

export interface DispatchServiceOptions {
  readonly idFactory?: (prefix: string) => string;
  readonly clock?: () => string;
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
  appendTimelineFact(dispatchId: string, fact: DispatchTimelineFact): DispatchTimelineFact;
  getDispatch(dispatchId: string): Dispatch;
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

    getDispatch,

    getCandidateEvaluations(dispatchId) {
      getDispatch(dispatchId);
      return Object.freeze([...(evaluations.get(dispatchId)?.values() ?? [])]);
    },

    getPendingSyncCommands() {
      return Object.freeze(
        [...commands.values()].filter((command) => command.status === "PENDING"),
      );
    },

    getTimeline(dispatchId) {
      getDispatch(dispatchId);
      const events = [...(timelineFacts.get(dispatchId)?.values() ?? [])].sort(
        (left, right) => timestamp(left.happenedAt) - timestamp(right.happenedAt),
      );
      const latestLocation = events
        .filter((event) => event.type === "LOCATION" && event.location !== undefined)
        .reduce<DispatchTimelineFact | undefined>((latest, event) => {
          if (latest === undefined || timestamp(event.happenedAt) > timestamp(latest.happenedAt)) {
            return event;
          }
          return latest;
        }, undefined);
      return Object.freeze({
        events: Object.freeze(events),
        ...(latestLocation === undefined ? {} : { latestLocation }),
      });
    },
  };
}
