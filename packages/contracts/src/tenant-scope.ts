import { AppError } from "./error-contract.ts";

export interface TrustedTenantClaims {
  readonly tenantId: string;
  readonly userId: string;
  readonly roleIds: readonly string[];
  readonly organizationIds: readonly string[];
  readonly tagIds: readonly string[];
}

export interface TenantScope {
  readonly tenantId: string;
  readonly userId: string;
  readonly roleIds: readonly string[];
  readonly organizationIds: readonly string[];
  readonly tagIds: readonly string[];
}

function requiredClaim(value: string, claim: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new AppError({
      code: "INVALID_TENANT_SCOPE",
      category: "AUTHENTICATION",
      message: `Trusted ${claim} claim is required`,
      retryable: false,
    });
  }
  return normalized;
}

function normalizedIds(values: readonly string[]): readonly string[] {
  const normalized = values.map((value) => value.trim()).filter((value) => value.length > 0);
  return Object.freeze([...new Set(normalized)].sort());
}

export function createTenantScope(claims: TrustedTenantClaims): TenantScope {
  return Object.freeze({
    tenantId: requiredClaim(claims.tenantId, "tenant"),
    userId: requiredClaim(claims.userId, "user"),
    roleIds: normalizedIds(claims.roleIds),
    organizationIds: normalizedIds(claims.organizationIds),
    tagIds: normalizedIds(claims.tagIds),
  });
}
