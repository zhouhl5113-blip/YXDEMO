import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { AppError } from "../../packages/contracts/src/index.ts";
import {
  G7_DOCUMENTED_PAGINATION,
  G7_REQUIRED_HEADERS,
  G7_SECRET_REFERENCES,
  assertG7OperationAllowed,
  normalizeG7PageLimit,
  type G7CredentialDecision,
} from "../../packages/integrations/g7/src/index.ts";

const decisionRaw = await readFile(
  new URL(
    "../../docs/delivery/yixing-logistics-workbench-2026-08-24/evidence/g7-credential-dependency-decision.json",
    import.meta.url,
  ),
  "utf8",
);
const decision = JSON.parse(decisionRaw) as G7CredentialDecision;

describe("G7 credentialless boundary", () => {
  it("allows synthetic offline contract verification", () => {
    assert.equal(decision.oldCredentialsUsedByOtherSystems, true);
    assert.equal(decision.rotateNow, false);
    assert.equal(decision.credentialUseAllowedForThisProject, false);
    assert.doesNotThrow(() =>
      assertG7OperationAllowed({
        operation: "OFFLINE_CONTRACT",
        target: "SANDBOX",
        decision,
      }),
    );
  });

  it("fails closed for a live SANDBOX read while shared credentials remain active", () => {
    assert.throws(
      () =>
        assertG7OperationAllowed({
          operation: "LIVE_READ",
          target: "SANDBOX",
          decision,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === "G7_LIVE_USE_BLOCKED" &&
        error.category === "SECURITY" &&
        error.retryable === false,
    );
  });

  it("fails closed for every production operation", () => {
    assert.throws(
      () =>
        assertG7OperationAllowed({
          operation: "LIVE_READ",
          target: "PROD",
          decision,
        }),
      (error: unknown) => error instanceof AppError && error.code === "G7_PROD_USE_BLOCKED",
    );
  });

  it("exposes only approved Harness Secret identifiers", () => {
    assert.deepEqual(G7_SECRET_REFERENCES, {
      tenantCode: "G7_TENANT_CODE",
      sandboxAccessKey: "G7_SANDBOX_ACCESS_KEY",
      sandboxSecretKey: "G7_SANDBOX_SECRET_KEY",
      prodAccessKey: "G7_PROD_ACCESS_KEY",
      prodSecretKey: "G7_PROD_SECRET_KEY",
    });
  });

  it("preserves the documented header and pagination contract", () => {
    assert.deepEqual(G7_REQUIRED_HEADERS, [
      "g7e6-tenant-code",
      "g7e6-user-code",
      "g7e6-dp-access-key",
      "g7e6-dp-timestamp",
      "g7e6-dp-signature",
    ]);
    assert.deepEqual(G7_DOCUMENTED_PAGINATION, { minimum: 1, maximum: 512 });
    assert.equal(normalizeG7PageLimit(1), 1);
    assert.equal(normalizeG7PageLimit(512), 512);
    assert.throws(() => normalizeG7PageLimit(0), /between 1 and 512/);
    assert.throws(() => normalizeG7PageLimit(513), /between 1 and 512/);
  });

  it("matches the sanitized workbench inventory without claiming behavioral evidence", async () => {
    const raw = await readFile(
      new URL(
        "../../docs/delivery/yixing-logistics-workbench-2026-08-24/evidence/g7-workbench-sandbox-inventory.json",
        import.meta.url,
      ),
      "utf8",
    );
    const inventory = JSON.parse(raw) as {
      sandbox: {
        supportedEndpointCount: number;
        unsupportedEndpointCount: number;
        messageSubscriptionScopeCount: number;
      };
      secretHygiene: {
        apiRequestAttempted: boolean;
        productionWriteAttempted: boolean;
      };
    };

    assert.equal(inventory.sandbox.supportedEndpointCount, 82);
    assert.equal(inventory.sandbox.unsupportedEndpointCount, 25);
    assert.equal(inventory.sandbox.messageSubscriptionScopeCount, 18);
    assert.equal(inventory.secretHygiene.apiRequestAttempted, false);
    assert.equal(inventory.secretHygiene.productionWriteAttempted, false);
  });
});
