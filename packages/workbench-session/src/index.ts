import { createHash } from "node:crypto";

import {
  AppError,
  createTenantScope,
  type AppErrorContract,
  type TenantScope,
  type TrustedTenantClaims,
} from "../../contracts/src/index.ts";
import {
  assertAuthorizationSnapshotCurrent,
  assertSelectedRoleAssigned,
  createAuthorizationAuditRecord,
  type AuthorizationAuditRecord,
  type AuthorizationSnapshot,
} from "../../identity-policy/src/index.ts";

export interface TrustedWorkbenchSession {
  readonly claims: TrustedTenantClaims;
  readonly selectedRoleId: string;
  readonly authorization: AuthorizationSnapshot;
}

export interface WorkbenchRequestMetadata {
  readonly requestId: string;
  readonly traceId: string;
  readonly browserTenantId?: string;
}

export interface WorkbenchSessionContext {
  readonly tenantScope: TenantScope;
  readonly selectedRoleId: string;
  readonly requestId: string;
  readonly traceId: string;
}

export interface DeriveWorkbenchSessionInput {
  readonly trustedSession: TrustedWorkbenchSession;
  readonly request: WorkbenchRequestMetadata;
}

export interface MaskedObjectDenialInput {
  readonly context: WorkbenchSessionContext;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly reasonCode: string;
  readonly recordedAt: string;
}

export interface MaskedObjectDenial {
  readonly publicError: AppErrorContract;
  readonly auditRecord: AuthorizationAuditRecord;
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new AppError({
      code: "INVALID_WORKBENCH_REQUEST_METADATA",
      category: "VALIDATION",
      message: `${field} is required`,
      retryable: false,
    });
  }
  return normalized;
}

export function deriveWorkbenchSessionContext(
  input: DeriveWorkbenchSessionInput,
): WorkbenchSessionContext {
  const tenantScope = createTenantScope(input.trustedSession.claims);
  assertAuthorizationSnapshotCurrent(input.trustedSession.authorization);
  assertSelectedRoleAssigned(tenantScope, input.trustedSession.selectedRoleId);

  return Object.freeze({
    tenantScope,
    selectedRoleId: input.trustedSession.selectedRoleId.trim(),
    requestId: required(input.request.requestId, "requestId"),
    traceId: required(input.request.traceId, "traceId"),
  });
}

export function createMaskedObjectDenial(input: MaskedObjectDenialInput): MaskedObjectDenial {
  const resourceIdHash = createHash("sha256").update(input.resourceId, "utf8").digest("hex");
  const publicError = new AppError({
    code: "OBJECT_NOT_ACCESSIBLE",
    category: "NOT_FOUND",
    message: "对象不存在或无权访问",
    retryable: false,
    requestId: input.context.requestId,
  }).toJSON();
  const auditRecord = createAuthorizationAuditRecord({
    decision: "DENY",
    actorId: input.context.tenantScope.userId,
    roleId: input.context.selectedRoleId,
    tenantId: input.context.tenantScope.tenantId,
    action: input.action,
    resourceType: input.resourceType,
    resourceIdHash,
    reasonCode: input.reasonCode,
    requestId: input.context.requestId,
    traceId: input.context.traceId,
    sourceApp: "WEB_BFF",
    recordedAt: input.recordedAt,
  });

  return Object.freeze({ publicError: Object.freeze(publicError), auditRecord });
}
