import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  evaluateDeliveryEvidence,
  parseCsv,
  type DeliveryEvidenceInput,
} from "../../scripts/verify-delivery-evidence.ts";

const deliveryRoot = new URL(
  "../../docs/delivery/yixing-logistics-workbench-2026-08-24/",
  import.meta.url,
);

async function readEvidence(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, deliveryRoot), "utf8");
}

async function actualInput(): Promise<DeliveryEvidenceInput> {
  const [record, matrixCsv, traceabilityCsv, gapDecisions, openDecisions] = await Promise.all([
    readEvidence("delivery-record.json"),
    readEvidence("g7-capability-matrix.csv"),
    readEvidence("traceability.csv"),
    readEvidence("g7-gap-decisions.md"),
    readEvidence("open-decisions.md"),
  ]);

  return {
    recordJson: record,
    matrixCsv,
    traceabilityCsv,
    gapDecisionsMarkdown: gapDecisions,
    openDecisionsMarkdown: openDecisions,
    prohibitedImplementationPaths: [],
    threatModelPresent: false,
    openDecisionsResolved: false,
    signedSandboxEvidencePresent: false,
  };
}

describe("delivery evidence gate", () => {
  it("parses quoted RFC 4180 fields without splitting embedded commas", () => {
    assert.deepEqual(parseCsv('id,description\r\n"FR-001","facts, evidence"\r\n'), [
      { id: "FR-001", description: "facts, evidence" },
    ]);
  });

  it("reports the current evidence as structurally valid but gate blocked", async () => {
    const report = evaluateDeliveryEvidence(await actualInput());

    assert.equal(report.structureValid, true);
    assert.equal(report.verdict, "BLOCKED");
    assert.equal(report.counts.matrixRows, 82);
    assert.equal(report.counts.traceabilityRows, 464);
    assert.equal(report.counts.pendingGapRecords, 10);
    assert.equal(report.counts.localDecisionRows, 31);
    assert.equal(report.counts.openDecisions, 15);
    assert.deepEqual(report.failedChecks, []);
    assert.ok(report.blockers.some((blocker) => blocker.includes("Product Gate")));
    assert.ok(report.blockers.some((blocker) => blocker.includes("Design Gate")));
    assert.ok(report.blockers.some((blocker) => blocker.includes("15 administrator/product")));
    assert.ok(report.blockers.some((blocker) => blocker.includes("threat model")));
  });

  it("keeps TEST-001..163 stable and closes the US-069..074 acceptance-ID gap", async () => {
    const input = await actualInput();
    const rows = parseCsv(input.traceabilityCsv);
    const testIds = rows
      .map((row) => row.requirement_id ?? "")
      .filter((requirementId) => requirementId.startsWith("TEST-"));
    const expectedTestIds = Array.from(
      { length: 163 },
      (_, index) => `TEST-${String(index + 1).padStart(3, "0")}`,
    );

    assert.deepEqual(testIds, expectedTestIds);
    for (const storyId of ["US-069", "US-070", "US-071", "US-072", "US-073", "US-074"]) {
      const story = rows.find((row) => row.requirement_id === storyId);
      assert.ok(story, `${storyId} traceability row is required`);
      assert.match(story.test_ref ?? "", /^TEST-\d{3}(;TEST-\d{3}){2}$/);
      assert.notEqual(story.status, "BLOCKED_TEST_CONTRACT_MISSING");
    }
  });

  it("fails structural validation if implementation appears before gap approval", async () => {
    const input = await actualInput();
    const report = evaluateDeliveryEvidence({
      ...input,
      prohibitedImplementationPaths: [
        "apps/web/package.json",
        "packages/orders/migrations/001.sql",
      ],
    });

    assert.equal(report.structureValid, false);
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.failedChecks.includes("pre-gate implementation boundary"));
  });

  it("rejects duplicate requirement IDs in the G7 capability matrix", async () => {
    const input = await actualInput();
    const rows = input.matrixCsv.trimEnd().split(/\r?\n/);
    const report = evaluateDeliveryEvidence({
      ...input,
      matrixCsv: `${rows.join("\n")}\n${rows[1]}\n`,
    });

    assert.equal(report.structureValid, false);
    assert.ok(report.failedChecks.includes("G7 capability matrix IDs"));
  });

  it("rejects a duplicate stable TEST ID even when the row count is unchanged", async () => {
    const input = await actualInput();
    const report = evaluateDeliveryEvidence({
      ...input,
      traceabilityCsv: input.traceabilityCsv.replace('"TEST-162"', '"TEST-163"'),
    });

    assert.equal(report.structureValid, false);
    assert.ok(report.failedChecks.includes("traceability stable ID counts"));
  });
});
