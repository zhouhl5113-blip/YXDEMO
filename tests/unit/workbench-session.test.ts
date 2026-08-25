import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AppError } from "../../packages/contracts/src/index.ts";
import {
  createMaskedObjectDenial,
  deriveWorkbenchSessionContext,
} from "../../packages/workbench-session/src/index.ts";

describe("workbench BFF session boundary", () => {
  const trustedSession = {
    claims: {
      tenantId: "tenant-yixing-local",
      userId: "user-zhou-helong",
      roleIds: ["fleet_owner", "dispatcher"],
      organizationIds: ["org-east-china"],
      tagIds: ["fleet-owned"],
    },
    selectedRoleId: "dispatcher",
    authorization: {
      sessionAuthorizationVersion: 4,
      currentAuthorizationVersion: 4,
      revokedAt: null,
    },
  } as const;

  it("TEST-001 derives TenantScope from trusted claims and ignores browser tenant_id", () => {
    const context = deriveWorkbenchSessionContext({
      trustedSession,
      request: {
        requestId: "req-test-001",
        traceId: "trace-test-001",
        browserTenantId: "tenant-attacker-controlled",
      },
    });

    assert.equal(context.tenantScope.tenantId, "tenant-yixing-local");
    assert.equal(context.selectedRoleId, "dispatcher");
    assert.equal(context.requestId, "req-test-001");
    assert.equal(context.traceId, "trace-test-001");
    assert.equal(JSON.stringify(context).includes("tenant-attacker-controlled"), false);
    assert.equal(Object.isFrozen(context), true);
  });

  it("TEST-002 masks inaccessible objects and emits a minimal denial audit record", () => {
    const context = deriveWorkbenchSessionContext({
      trustedSession,
      request: {
        requestId: "req-test-002",
        traceId: "trace-test-002",
        browserTenantId: "tenant-yixing-local",
      },
    });

    const denial = createMaskedObjectDenial({
      context,
      action: "shipment.read",
      resourceType: "shipment",
      resourceId: "shipment-secret-42",
      reasonCode: "PERMISSION_NOT_GRANTED",
      recordedAt: "2026-08-25T08:00:00.000Z",
    });

    assert.deepEqual(denial.publicError, {
      code: "OBJECT_NOT_ACCESSIBLE",
      category: "NOT_FOUND",
      message: "对象不存在或无权访问",
      retryable: false,
      requestId: "req-test-002",
    });
    assert.equal(denial.auditRecord.decision, "DENY");
    assert.match(denial.auditRecord.resourceIdHash ?? "", /^[a-f0-9]{64}$/);
    const serialized = JSON.stringify(denial);
    assert.equal(serialized.includes("shipment-secret-42"), false);
    assert.equal(Object.isFrozen(denial), true);
  });

  it("TEST-003 rejects a stale authorization snapshot before creating a context", () => {
    assert.throws(
      () =>
        deriveWorkbenchSessionContext({
          trustedSession: {
            ...trustedSession,
            authorization: {
              sessionAuthorizationVersion: 3,
              currentAuthorizationVersion: 4,
              revokedAt: null,
            },
          },
          request: {
            requestId: "req-test-003",
            traceId: "trace-test-003",
          },
        }),
      (error: unknown) => error instanceof AppError && error.code === "SESSION_AUTHORIZATION_STALE",
    );
  });
});
