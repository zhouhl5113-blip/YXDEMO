import "server-only";

import { randomUUID } from "node:crypto";

import {
  deriveWorkbenchSessionContext,
  type TrustedWorkbenchSession,
  type WorkbenchSessionContext,
} from "../../../packages/workbench-session/src/index.ts";

export const LOCAL_ROLE_OPTIONS = Object.freeze([
  { id: "owner", label: "物流老板", workspace: "经营总览", canDispatch: false },
  { id: "fleet_lead", label: "车队长", workspace: "班次控制台", canDispatch: true },
  {
    id: "operations_manager",
    label: "运营管理者",
    workspace: "履约管理台",
    canDispatch: false,
  },
  {
    id: "logistics_specialist",
    label: "物流专员",
    workspace: "订单协同台",
    canDispatch: false,
  },
  { id: "dispatcher", label: "调度员", workspace: "调度工作台", canDispatch: true },
  { id: "driver", label: "司机", workspace: "司机任务台", canDispatch: false },
] as const);

export type LocalRoleId = (typeof LOCAL_ROLE_OPTIONS)[number]["id"];

export function canRoleDispatch(roleId: string): boolean {
  return LOCAL_ROLE_OPTIONS.some((role) => role.id === roleId && role.canDispatch);
}

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
