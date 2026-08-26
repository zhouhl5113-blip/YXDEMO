import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { AppError, createTenantScope } from "../../packages/contracts/src/index.ts";
import {
  assertPermissionAllowed,
  assertResourceTenant,
  assertRiskTierAvailable,
  assertRoleSwitchDoesNotExpand,
  intersectDataScopes,
  isScopeIdAllowed,
} from "../../packages/identity-policy/src/index.ts";

describe("local authorization policy", () => {
  it("TEST-001 policy prerequisite rejects a tenant outside trusted server claims", () => {
    const trustedScope = createTenantScope({
      tenantId: "tenant-a",
      userId: "user-1",
      roleIds: ["dispatcher"],
      organizationIds: ["org-1"],
      tagIds: [],
    });

    assert.throws(
      () => assertResourceTenant(trustedScope, "tenant-b"),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === "TENANT_SCOPE_MISMATCH" &&
        error.category === "AUTHORIZATION",
    );
  });

  it("TEST-002 policy prerequisite gives explicit deny precedence over a role grant", () => {
    assert.throws(
      () =>
        assertPermissionAllowed({
          requiredPermission: "shipment.assign",
          grantedPermissions: ["shipment.read", "shipment.assign"],
          deniedPermissions: ["shipment.assign"],
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "PERMISSION_EXPLICITLY_DENIED",
    );
  });

  it("OQ-008 intersects every applicable scope layer and applies deny last", () => {
    const effective = intersectDataScopes([
      {
        source: "TENANT_MEMBERSHIP",
        organizations: { allow: ["org-a", "org-b"], deny: ["org-b"] },
        tags: { allow: "ALL" },
        fleets: { allow: ["fleet-a", "fleet-b"] },
      },
      {
        source: "SELECTED_ROLE",
        organizations: { allow: ["org-b", "org-c"] },
        tags: { allow: ["priority", "cold-chain"] },
        fleets: { allow: ["fleet-b"] },
        assignments: { allow: ["assignment-1"] },
      },
      {
        source: "SHIFT",
        tags: { allow: ["cold-chain"] },
        assignments: { allow: "ALL", deny: ["assignment-2"] },
      },
    ]);

    assert.deepEqual(effective.organizations, {
      allowAll: false,
      allowedIds: [],
      deniedIds: ["org-b"],
    });
    assert.deepEqual(effective.tags, {
      allowAll: false,
      allowedIds: ["cold-chain"],
      deniedIds: [],
    });
    assert.deepEqual(effective.fleets, {
      allowAll: false,
      allowedIds: ["fleet-b"],
      deniedIds: [],
    });
    assert.equal(isScopeIdAllowed(effective.assignments, "assignment-1"), true);
    assert.equal(isScopeIdAllowed(effective.assignments, "assignment-2"), false);
    assert.equal(Object.isFrozen(effective), true);
  });

  it("treats a missing layer constraint as ALL, never as accidental empty access", () => {
    const effective = intersectDataScopes([
      {
        source: "TENANT_MEMBERSHIP",
        organizations: { allow: ["org-a"] },
      },
      {
        source: "SELECTED_ROLE",
        tags: { allow: ["tag-a"] },
      },
    ]);

    assert.equal(isScopeIdAllowed(effective.organizations, "org-a"), true);
    assert.equal(isScopeIdAllowed(effective.organizations, "org-b"), false);
    assert.equal(isScopeIdAllowed(effective.tags, "tag-a"), true);
    assert.equal(effective.fleets.allowAll, true);
  });

  it("fails closed when no trusted scope layer is supplied", () => {
    assert.throws(
      () => intersectDataScopes([]),
      (error: unknown) =>
        error instanceof AppError && error.code === "AUTHORIZATION_SCOPE_REQUIRED",
    );
  });

  it("TEST-003 policy prerequisite permits a role switch that only narrows scope", () => {
    const current = intersectDataScopes([
      {
        source: "CURRENT_ROLE",
        organizations: { allow: ["org-a", "org-b"] },
        tags: { allow: "ALL", deny: ["restricted"] },
      },
    ]);
    const next = intersectDataScopes([
      {
        source: "NEXT_ROLE",
        organizations: { allow: ["org-a"] },
        tags: { allow: ["priority"] },
      },
    ]);

    assert.doesNotThrow(() => assertRoleSwitchDoesNotExpand(current, next));
  });

  it("TEST-003 policy prerequisite rejects a role switch that expands scope", () => {
    const current = intersectDataScopes([
      {
        source: "CURRENT_ROLE",
        organizations: { allow: ["org-a"] },
      },
    ]);
    const next = intersectDataScopes([
      {
        source: "NEXT_ROLE",
        organizations: { allow: ["org-a", "org-b"] },
      },
    ]);

    assert.throws(
      () => assertRoleSwitchDoesNotExpand(current, next),
      (error: unknown) => error instanceof AppError && error.code === "ROLE_SWITCH_SCOPE_EXPANSION",
    );
  });

  it("rejects a role switch that removes an existing explicit deny", () => {
    const current = intersectDataScopes([
      {
        source: "CURRENT_ROLE",
        organizations: { allow: "ALL", deny: ["restricted"] },
      },
    ]);
    const next = intersectDataScopes([
      {
        source: "NEXT_ROLE",
        organizations: { allow: "ALL" },
      },
    ]);

    assert.throws(
      () => assertRoleSwitchDoesNotExpand(current, next),
      (error: unknown) => error instanceof AppError && error.code === "ROLE_SWITCH_SCOPE_EXPANSION",
    );
  });

  it("rejects switching from an explicit scope to ALL", () => {
    const current = intersectDataScopes([
      {
        source: "CURRENT_ROLE",
        organizations: { allow: ["org-a"] },
      },
    ]);
    const next = intersectDataScopes([
      {
        source: "NEXT_ROLE",
        organizations: { allow: "ALL" },
      },
    ]);

    assert.throws(
      () => assertRoleSwitchDoesNotExpand(current, next),
      (error: unknown) => error instanceof AppError && error.code === "ROLE_SWITCH_SCOPE_EXPANSION",
    );
  });

  it("rejects an action that was never granted", () => {
    assert.throws(
      () =>
        assertPermissionAllowed({
          requiredPermission: "shipment.assign",
          grantedPermissions: ["shipment.read"],
          deniedPermissions: [],
        }),
      (error: unknown) => error instanceof AppError && error.code === "PERMISSION_NOT_GRANTED",
    );
  });

  it("keeps R3 actions unavailable without a distinct second approver", () => {
    assert.throws(
      () => assertRiskTierAvailable("R3"),
      (error: unknown) => error instanceof AppError && error.code === "R3_ACTIONS_DISABLED",
    );
  });

  it("matches the action-specific approval boundary without enabling runtime features", async () => {
    const raw = await readFile(
      new URL(
        "../../docs/delivery/yixing-logistics-workbench-2026-08-24/evidence/local-design-approval.json",
        import.meta.url,
      ),
      "utf8",
    );
    const approval = JSON.parse(raw) as {
      scope: string;
      approved: { oq008ScopeRule: string; authorizationPolicyContracts: boolean };
      mandatoryDisabledControls: Record<string, boolean>;
    };

    assert.equal(approval.scope, "LOCAL_DEVELOPMENT_AND_TEST_ONLY");
    assert.equal(approval.approved.oq008ScopeRule, "INTERSECTION_WITH_EXPLICIT_DENY_PRECEDENCE");
    assert.equal(approval.approved.authorizationPolicyContracts, true);
    assert.deepEqual(approval.mandatoryDisabledControls, {
      rawLocationHistoryPersistence: false,
      agent: false,
      r3Actions: false,
      liveG7Writes: false,
      productionDeployment: false,
      secretChanges: false,
    });
  });
});
