import { AppError, type TenantScope } from "../../contracts/src/index.ts";

export type RiskTier = "R0" | "R1" | "R2" | "R3";
export type ScopeDimension = "organizations" | "tags" | "fleets" | "assignments";

export interface ScopeConstraint {
  readonly allow: "ALL" | readonly string[];
  readonly deny?: readonly string[];
}

export interface DataScopeLayer {
  readonly source: string;
  readonly organizations?: ScopeConstraint;
  readonly tags?: ScopeConstraint;
  readonly fleets?: ScopeConstraint;
  readonly assignments?: ScopeConstraint;
}

export interface EffectiveScopeDimension {
  readonly allowAll: boolean;
  readonly allowedIds: readonly string[];
  readonly deniedIds: readonly string[];
}

export interface EffectiveDataScope {
  readonly organizations: EffectiveScopeDimension;
  readonly tags: EffectiveScopeDimension;
  readonly fleets: EffectiveScopeDimension;
  readonly assignments: EffectiveScopeDimension;
}

export interface PermissionDecisionInput {
  readonly requiredPermission: string;
  readonly grantedPermissions: readonly string[];
  readonly deniedPermissions: readonly string[];
}

const SCOPE_DIMENSIONS: readonly ScopeDimension[] = Object.freeze([
  "organizations",
  "tags",
  "fleets",
  "assignments",
]);

function normalizedId(value: string): string {
  return value.trim();
}

function normalizedIds(values: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(values.map(normalizedId).filter((value) => value.length > 0))].sort(),
  );
}

function intersectDimension(
  layers: readonly DataScopeLayer[],
  dimension: ScopeDimension,
): EffectiveScopeDimension {
  let allowed: Set<string> | undefined;
  const denied = new Set<string>();

  for (const layer of layers) {
    const constraint = layer[dimension];
    if (constraint === undefined) {
      continue;
    }

    for (const deniedId of normalizedIds(constraint.deny ?? [])) {
      denied.add(deniedId);
    }

    if (constraint.allow === "ALL") {
      continue;
    }

    const layerAllowed = new Set(normalizedIds(constraint.allow));
    allowed =
      allowed === undefined
        ? layerAllowed
        : new Set([...allowed].filter((value) => layerAllowed.has(value)));
  }

  const deniedIds = normalizedIds([...denied]);
  const deniedLookup = new Set(deniedIds);
  const allowedIds =
    allowed === undefined
      ? Object.freeze([] as string[])
      : normalizedIds([...allowed].filter((value) => !deniedLookup.has(value)));

  return Object.freeze({
    allowAll: allowed === undefined,
    allowedIds,
    deniedIds,
  });
}

export function intersectDataScopes(layers: readonly DataScopeLayer[]): EffectiveDataScope {
  if (layers.length === 0) {
    throw new AppError({
      code: "AUTHORIZATION_SCOPE_REQUIRED",
      category: "AUTHORIZATION",
      message: "At least one trusted authorization scope layer is required",
      retryable: false,
    });
  }

  const effective = Object.fromEntries(
    SCOPE_DIMENSIONS.map((dimension) => [dimension, intersectDimension(layers, dimension)]),
  ) as unknown as EffectiveDataScope;

  return Object.freeze(effective);
}

export function isScopeIdAllowed(scope: EffectiveScopeDimension, candidateId: string): boolean {
  const normalized = normalizedId(candidateId);
  if (normalized.length === 0 || scope.deniedIds.includes(normalized)) {
    return false;
  }
  return scope.allowAll || scope.allowedIds.includes(normalized);
}

export function assertResourceTenant(trustedScope: TenantScope, resourceTenantId: string): void {
  if (trustedScope.tenantId !== normalizedId(resourceTenantId)) {
    throw new AppError({
      code: "TENANT_SCOPE_MISMATCH",
      category: "AUTHORIZATION",
      message: "The requested resource is outside the trusted tenant scope",
      retryable: false,
    });
  }
}

export function assertPermissionAllowed(input: PermissionDecisionInput): void {
  const required = normalizedId(input.requiredPermission);
  const denied = normalizedIds(input.deniedPermissions);
  if (denied.includes(required)) {
    throw new AppError({
      code: "PERMISSION_EXPLICITLY_DENIED",
      category: "AUTHORIZATION",
      message: "The requested action is explicitly denied",
      retryable: false,
    });
  }

  if (required.length === 0 || !normalizedIds(input.grantedPermissions).includes(required)) {
    throw new AppError({
      code: "PERMISSION_NOT_GRANTED",
      category: "AUTHORIZATION",
      message: "The requested action is not granted",
      retryable: false,
    });
  }
}

function scopeIsSubset(current: EffectiveScopeDimension, next: EffectiveScopeDimension): boolean {
  if (current.allowAll) {
    if (next.allowAll) {
      return current.deniedIds.every((deniedId) => next.deniedIds.includes(deniedId));
    }
    return next.allowedIds.every((allowedId) => isScopeIdAllowed(current, allowedId));
  }

  if (next.allowAll) {
    return false;
  }
  return next.allowedIds.every((allowedId) => current.allowedIds.includes(allowedId));
}

export function assertRoleSwitchDoesNotExpand(
  current: EffectiveDataScope,
  next: EffectiveDataScope,
): void {
  const expandedDimension = SCOPE_DIMENSIONS.find(
    (dimension) => !scopeIsSubset(current[dimension], next[dimension]),
  );
  if (expandedDimension !== undefined) {
    throw new AppError({
      code: "ROLE_SWITCH_SCOPE_EXPANSION",
      category: "AUTHORIZATION",
      message: `Role switch would expand ${expandedDimension} scope`,
      retryable: false,
    });
  }
}

export function assertRiskTierAvailable(riskTier: RiskTier): void {
  if (riskTier === "R3") {
    throw new AppError({
      code: "R3_ACTIONS_DISABLED",
      category: "SECURITY",
      message: "R3 actions require a distinct second approver and remain disabled",
      retryable: false,
    });
  }
}
