import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AppError, createTenantScope } from "../../packages/contracts/src/index.ts";
import {
  assertApprovalSeparation,
  assertAuthorizationSnapshotCurrent,
  assertSelectedRoleAssigned,
  createAuthorizationAuditRecord,
} from "../../packages/identity-policy/src/index.ts";

describe("session authorization contracts", () => {
  const trustedScope = createTenantScope({
    tenantId: "tenant-a",
    userId: "user-1",
    roleIds: ["dispatcher", "fleet_lead"],
    organizationIds: ["org-a"],
    tagIds: [],
  });

  it("TEST-001 prerequisite accepts only a server-assigned selected role", () => {
    assert.doesNotThrow(() => assertSelectedRoleAssigned(trustedScope, "dispatcher"));
  });

  it("TEST-001 prerequisite rejects a client-selected unassigned role", () => {
    assert.throws(
      () => assertSelectedRoleAssigned(trustedScope, "owner"),
      (error: unknown) => error instanceof AppError && error.code === "ROLE_NOT_ASSIGNED",
    );
  });

  it("TEST-003 prerequisite permits a current active authorization snapshot", () => {
    assert.doesNotThrow(() =>
      assertAuthorizationSnapshotCurrent({
        sessionAuthorizationVersion: 7,
        currentAuthorizationVersion: 7,
        revokedAt: null,
      }),
    );
  });

  it("TEST-003 prerequisite rejects a stale authorization snapshot", () => {
    assert.throws(
      () =>
        assertAuthorizationSnapshotCurrent({
          sessionAuthorizationVersion: 6,
          currentAuthorizationVersion: 7,
          revokedAt: null,
        }),
      (error: unknown) => error instanceof AppError && error.code === "SESSION_AUTHORIZATION_STALE",
    );
  });

  it("TEST-003 prerequisite rejects an explicitly revoked session", () => {
    assert.throws(
      () =>
        assertAuthorizationSnapshotCurrent({
          sessionAuthorizationVersion: 7,
          currentAuthorizationVersion: 7,
          revokedAt: "2026-08-24T12:00:00.000Z",
        }),
      (error: unknown) => error instanceof AppError && error.code === "SESSION_REVOKED",
    );
  });

  it("rejects an invalid authorization version instead of comparing loosely", () => {
    assert.throws(
      () =>
        assertAuthorizationSnapshotCurrent({
          sessionAuthorizationVersion: -1,
          currentAuthorizationVersion: 7,
          revokedAt: null,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_AUTHORIZATION_SNAPSHOT",
    );
  });

  it("rejects R2 self-approval", () => {
    assert.throws(
      () =>
        assertApprovalSeparation({
          riskTier: "R2",
          initiatorId: "user-1",
          approverIds: ["user-1"],
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "APPROVAL_SELF_REVIEW_FORBIDDEN",
    );
  });

  it("permits R2 review by a distinct approver", () => {
    assert.doesNotThrow(() =>
      assertApprovalSeparation({
        riskTier: "R2",
        initiatorId: "user-1",
        approverIds: ["security-approver-1"],
      }),
    );
  });

  it("rejects R2 execution when no approver is present", () => {
    assert.throws(
      () =>
        assertApprovalSeparation({
          riskTier: "R2",
          initiatorId: "user-1",
          approverIds: [],
        }),
      (error: unknown) => error instanceof AppError && error.code === "APPROVER_REQUIRED",
    );
  });

  it("keeps R3 disabled through the approval boundary", () => {
    assert.throws(
      () =>
        assertApprovalSeparation({
          riskTier: "R3",
          initiatorId: "user-1",
          approverIds: ["approver-1", "approver-2"],
        }),
      (error: unknown) => error instanceof AppError && error.code === "R3_ACTIONS_DISABLED",
    );
  });

  it("TEST-002 prerequisite creates a minimal immutable denial audit record", () => {
    const input = {
      decision: "DENY" as const,
      actorId: "user-1",
      roleId: "dispatcher",
      tenantId: "tenant-a",
      action: "shipment.assign",
      resourceType: "shipment",
      resourceIdHash: "A".repeat(64),
      reasonCode: "TENANT_SCOPE_MISMATCH",
      requestId: "request-1",
      traceId: "trace-1",
      sourceApp: "WEB_BFF" as const,
      recordedAt: "2026-08-24T12:00:00.000Z",
      objectName: "sensitive customer name",
      vehiclePlate: "sensitive plate",
      objectCount: 37,
    };

    const record = createAuthorizationAuditRecord(input);

    assert.deepEqual(record, {
      schemaVersion: 1,
      decision: "DENY",
      actorId: "user-1",
      roleId: "dispatcher",
      tenantId: "tenant-a",
      action: "shipment.assign",
      resourceType: "shipment",
      resourceIdHash: "a".repeat(64),
      reasonCode: "TENANT_SCOPE_MISMATCH",
      requestId: "request-1",
      traceId: "trace-1",
      sourceApp: "WEB_BFF",
      recordedAt: "2026-08-24T12:00:00.000Z",
    });
    assert.equal(Object.isFrozen(record), true);
    assert.equal(JSON.stringify(record).includes("sensitive"), false);
  });

  it("rejects a raw resource identifier in place of a SHA-256 reference", () => {
    assert.throws(
      () =>
        createAuthorizationAuditRecord({
          decision: "DENY",
          actorId: "user-1",
          roleId: "dispatcher",
          tenantId: "tenant-a",
          action: "shipment.assign",
          resourceType: "shipment",
          resourceIdHash: "plate-A-12345",
          reasonCode: "PERMISSION_NOT_GRANTED",
          requestId: "request-2",
          traceId: "trace-2",
          sourceApp: "WEB_BFF",
          recordedAt: "2026-08-24T12:00:00.000Z",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_AUTHORIZATION_AUDIT_RECORD",
    );
  });

  it("allows an audit record without an object reference", () => {
    const record = createAuthorizationAuditRecord({
      decision: "ALLOW",
      actorId: "user-1",
      roleId: "auditor",
      tenantId: "tenant-a",
      action: "workspace.open",
      resourceType: "workspace",
      reasonCode: "PERMISSION_GRANTED",
      requestId: "request-3",
      traceId: "trace-3",
      sourceApp: "WEB_BFF",
      recordedAt: "2026-08-24T12:00:00.000Z",
    });

    assert.equal("resourceIdHash" in record, false);
  });

  it("rejects an unknown authorization decision at runtime", () => {
    assert.throws(
      () =>
        createAuthorizationAuditRecord({
          decision: "UNKNOWN",
          actorId: "user-1",
          roleId: "dispatcher",
          tenantId: "tenant-a",
          action: "shipment.assign",
          resourceType: "shipment",
          reasonCode: "INVALID_DECISION",
          requestId: "request-4",
          traceId: "trace-4",
          sourceApp: "WEB_BFF",
          recordedAt: "2026-08-24T12:00:00.000Z",
        } as unknown as Parameters<typeof createAuthorizationAuditRecord>[0]),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_AUTHORIZATION_AUDIT_RECORD",
    );
  });

  it("rejects malformed required, code, timestamp and source fields", () => {
    const validInput = {
      decision: "DENY" as const,
      actorId: "user-1",
      roleId: "dispatcher",
      tenantId: "tenant-a",
      action: "shipment.assign",
      resourceType: "shipment",
      reasonCode: "PERMISSION_NOT_GRANTED",
      requestId: "request-5",
      traceId: "trace-5",
      sourceApp: "WEB_BFF" as const,
      recordedAt: "2026-08-24T12:00:00.000Z",
    };
    const invalidInputs = [
      { ...validInput, action: " " },
      { ...validInput, reasonCode: "raw reason text" },
      { ...validInput, recordedAt: "2026-08-24 12:00:00" },
      { ...validInput, sourceApp: "BROWSER" },
    ];

    for (const input of invalidInputs) {
      assert.throws(
        () =>
          createAuthorizationAuditRecord(
            input as unknown as Parameters<typeof createAuthorizationAuditRecord>[0],
          ),
        (error: unknown) =>
          error instanceof AppError && error.code === "INVALID_AUTHORIZATION_AUDIT_RECORD",
      );
    }
  });
});
