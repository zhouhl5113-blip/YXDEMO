import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AppError,
  createEventEnvelope,
  createTenantScope,
} from "../../packages/contracts/src/index.ts";

describe("shared contracts", () => {
  it("normalizes and freezes trusted TenantScope claims without deciding scope semantics", () => {
    const scope = createTenantScope({
      tenantId: " tenant-a ",
      userId: " user-1 ",
      roleIds: ["dispatcher", "dispatcher", "operator"],
      organizationIds: ["org-b", "org-a"],
      tagIds: [],
    });

    assert.deepEqual(scope, {
      tenantId: "tenant-a",
      userId: "user-1",
      roleIds: ["dispatcher", "operator"],
      organizationIds: ["org-a", "org-b"],
      tagIds: [],
    });
    assert.equal(Object.isFrozen(scope), true);
    assert.equal(Object.isFrozen(scope.roleIds), true);
  });

  it("rejects an empty trusted tenant or user claim", () => {
    assert.throws(
      () =>
        createTenantScope({
          tenantId: " ",
          userId: "user-1",
          roleIds: [],
          organizationIds: [],
          tagIds: [],
        }),
      (error: unknown) => error instanceof AppError && error.code === "INVALID_TENANT_SCOPE",
    );
  });

  it("serializes structured errors without leaking their cause", () => {
    const error = new AppError({
      code: "UPSTREAM_UNAVAILABLE",
      category: "UPSTREAM",
      message: "G7 is unavailable",
      retryable: true,
      requestId: "req-1",
      upstreamReference: "upstream-ref",
      cause: new Error("secret transport detail"),
    });

    assert.deepEqual(error.toJSON(), {
      code: "UPSTREAM_UNAVAILABLE",
      category: "UPSTREAM",
      message: "G7 is unavailable",
      retryable: true,
      requestId: "req-1",
      upstreamReference: "upstream-ref",
    });
    assert.equal(JSON.stringify(error.toJSON()).includes("secret transport detail"), false);
  });

  it("creates an immutable event envelope with ordered timestamps", () => {
    const envelope = createEventEnvelope({
      eventId: "evt-1",
      eventType: "foundation.contract.verified",
      tenantId: "tenant-a",
      source: "foundation-tests",
      happenedAt: "2026-08-24T10:00:00.000Z",
      receivedAt: "2026-08-24T10:00:01.000Z",
      traceId: "trace-1",
      payload: { result: "PASS" },
    });

    assert.equal(envelope.schemaVersion, 1);
    assert.equal(Object.isFrozen(envelope), true);
    assert.equal(Object.isFrozen(envelope.payload), true);
  });

  it("rejects invalid or reversed event timestamps", () => {
    const baseInput = {
      eventId: "evt-2",
      eventType: "foundation.contract.rejected",
      tenantId: "tenant-a",
      source: "foundation-tests",
      traceId: "trace-2",
      payload: { result: "REJECTED" },
    };

    assert.throws(
      () =>
        createEventEnvelope({
          ...baseInput,
          happenedAt: "not-a-timestamp",
          receivedAt: "2026-08-24T10:00:01.000Z",
        }),
      (error: unknown) => error instanceof AppError && error.code === "INVALID_EVENT_ENVELOPE",
    );
    assert.throws(
      () =>
        createEventEnvelope({
          ...baseInput,
          happenedAt: "2026-08-24T10:00:02.000Z",
          receivedAt: "2026-08-24T10:00:01.000Z",
        }),
      (error: unknown) => error instanceof AppError && error.code === "INVALID_EVENT_ENVELOPE",
    );
  });
});
