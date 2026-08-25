import "server-only";

import { randomUUID } from "node:crypto";

import {
  deriveWorkbenchSessionContext,
  type TrustedWorkbenchSession,
  type WorkbenchSessionContext,
} from "../../../packages/workbench-session/src/index.ts";

export const LOCAL_ROLE_OPTIONS = Object.freeze([
  { id: "dispatcher", label: "调度员", workspace: "调度工作台" },
  { id: "fleet_lead", label: "车队长", workspace: "班次控制台" },
] as const);

function assertLocalDevelopmentRuntime(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Synthetic local identity is disabled in production runtime");
  }
}

function trustedLocalSession(selectedRoleId: string): TrustedWorkbenchSession {
  assertLocalDevelopmentRuntime();
  return {
    claims: {
      tenantId: "tenant-yixing-local",
      userId: "user-zhou-helong",
      roleIds: LOCAL_ROLE_OPTIONS.map((role) => role.id),
      organizationIds: ["org-east-china"],
      tagIds: ["fleet-owned", "local-synthetic"],
    },
    selectedRoleId,
    authorization: {
      sessionAuthorizationVersion: 1,
      currentAuthorizationVersion: 1,
      revokedAt: null,
    },
  };
}

export function createLocalWorkbenchContext(
  selectedRoleId: string = "dispatcher",
  requestId: string = randomUUID(),
  traceId: string = randomUUID().replaceAll("-", ""),
  browserTenantId?: string,
): WorkbenchSessionContext {
  return deriveWorkbenchSessionContext({
    trustedSession: trustedLocalSession(selectedRoleId),
    request: {
      requestId,
      traceId,
      ...(browserTenantId === undefined ? {} : { browserTenantId }),
    },
  });
}
