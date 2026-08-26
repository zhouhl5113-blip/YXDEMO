import { AppError, type TenantScope } from "../../contracts/src/index.ts";

export interface AuthorizationSnapshot {
  readonly sessionAuthorizationVersion: number;
  readonly currentAuthorizationVersion: number;
  readonly revokedAt: string | null;
}

export function assertSelectedRoleAssigned(
  trustedScope: TenantScope,
  selectedRoleId: string,
): void {
  const normalizedRoleId = selectedRoleId.trim();
  if (normalizedRoleId.length === 0 || !trustedScope.roleIds.includes(normalizedRoleId)) {
    throw new AppError({
      code: "ROLE_NOT_ASSIGNED",
      category: "AUTHORIZATION",
      message: "The selected role is not assigned to the trusted subject",
      retryable: false,
    });
  }
}

function validVersion(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function assertAuthorizationSnapshotCurrent(snapshot: AuthorizationSnapshot): void {
  if (
    !validVersion(snapshot.sessionAuthorizationVersion) ||
    !validVersion(snapshot.currentAuthorizationVersion)
  ) {
    throw new AppError({
      code: "INVALID_AUTHORIZATION_SNAPSHOT",
      category: "VALIDATION",
      message: "Authorization versions must be non-negative safe integers",
      retryable: false,
    });
  }

  if (snapshot.revokedAt !== null) {
    throw new AppError({
      code: "SESSION_REVOKED",
      category: "AUTHENTICATION",
      message: "The session has been revoked",
      retryable: false,
    });
  }

  if (snapshot.sessionAuthorizationVersion !== snapshot.currentAuthorizationVersion) {
    throw new AppError({
      code: "SESSION_AUTHORIZATION_STALE",
      category: "AUTHORIZATION",
      message: "The session authorization snapshot is stale",
      retryable: false,
    });
  }
}
