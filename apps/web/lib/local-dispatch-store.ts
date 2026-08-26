import "server-only";

import { AppError } from "../../../packages/contracts/src/index.ts";
import {
  createDispatchService,
  type CandidateEvaluation,
  type CreateDispatchDraftInput,
  type Dispatch,
  type DispatchCandidate,
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
  return service.confirmDispatch({
    tenantId: context.tenantScope.tenantId,
    dispatchId,
    expectedVersion,
    idempotencyKey,
    existingAssignments: [],
  });
}
