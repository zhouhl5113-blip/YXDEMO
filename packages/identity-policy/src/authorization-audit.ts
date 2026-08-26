import { AppError } from "../../contracts/src/index.ts";

export type AuthorizationDecision = "ALLOW" | "DENY";
export type AuthorizationSourceApp = "WEB_BFF" | "DRIVER_BFF" | "WORKER";

export interface AuthorizationAuditInput {
  readonly decision: AuthorizationDecision;
  readonly actorId: string;
  readonly roleId: string;
  readonly tenantId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceIdHash?: string;
  readonly reasonCode: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly sourceApp: AuthorizationSourceApp;
  readonly recordedAt: string;
}

export interface AuthorizationAuditRecord extends AuthorizationAuditInput {
  readonly schemaVersion: 1;
}

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;
const NAME_PATTERN = /^[a-z][a-z0-9_.:-]{0,127}$/;
const HASH_PATTERN = /^[a-fA-F0-9]{64}$/;
const DECISIONS = new Set<AuthorizationDecision>(["ALLOW", "DENY"]);
const SOURCE_APPS = new Set<AuthorizationSourceApp>(["WEB_BFF", "DRIVER_BFF", "WORKER"]);

function invalidAuditRecord(message: string): never {
  throw new AppError({
    code: "INVALID_AUTHORIZATION_AUDIT_RECORD",
    category: "VALIDATION",
    message,
    retryable: false,
  });
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    invalidAuditRecord(`${field} is required`);
  }
  return normalized;
}

function normalizedTimestamp(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    invalidAuditRecord("recordedAt must be a canonical UTC timestamp");
  }
  return value;
}

export function createAuthorizationAuditRecord(
  input: AuthorizationAuditInput,
): AuthorizationAuditRecord {
  if (!DECISIONS.has(input.decision)) {
    invalidAuditRecord("decision is not approved");
  }
  const action = required(input.action, "action");
  const resourceType = required(input.resourceType, "resourceType");
  const reasonCode = required(input.reasonCode, "reasonCode");
  if (
    !NAME_PATTERN.test(action) ||
    !NAME_PATTERN.test(resourceType) ||
    !CODE_PATTERN.test(reasonCode)
  ) {
    invalidAuditRecord("Action, resource type or reason code has an invalid format");
  }
  if (input.resourceIdHash !== undefined && !HASH_PATTERN.test(input.resourceIdHash)) {
    invalidAuditRecord("resourceIdHash must be a SHA-256 hexadecimal digest");
  }
  if (!SOURCE_APPS.has(input.sourceApp)) {
    invalidAuditRecord("sourceApp is not approved");
  }

  return Object.freeze({
    schemaVersion: 1,
    decision: input.decision,
    actorId: required(input.actorId, "actorId"),
    roleId: required(input.roleId, "roleId"),
    tenantId: required(input.tenantId, "tenantId"),
    action,
    resourceType,
    ...(input.resourceIdHash === undefined
      ? {}
      : { resourceIdHash: input.resourceIdHash.toLowerCase() }),
    reasonCode,
    requestId: required(input.requestId, "requestId"),
    traceId: required(input.traceId, "traceId"),
    sourceApp: input.sourceApp,
    recordedAt: normalizedTimestamp(input.recordedAt),
  });
}
