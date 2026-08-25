import { existsSync, globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DELIVERY_ID = "yixing-logistics-workbench-2026-08-24";
const ALLOWED_REUSE_MODES = new Set([
  "DIRECT_REUSE",
  "COMPOSED_REUSE",
  "LOCAL_READ_PROJECTION",
  "LOCAL_EXTENSION",
  "LOCAL_GAP_IMPLEMENTATION",
]);
const LOCAL_DECISION_MODES = new Set(["LOCAL_EXTENSION", "LOCAL_GAP_IMPLEMENTATION"]);
const EXPECTED_TRACE_COUNTS = Object.freeze({
  RQ: 44,
  UJ: 15,
  FR: 82,
  NFR: 25,
  OQ: 4,
  AD: 45,
  EP: 12,
  US: 74,
  TEST: 163,
});
const REQUIRED_OPEN_DECISIONS = Object.freeze([
  "GIT-001",
  "HAR-001",
  "HAR-002",
  "HAR-003",
  "G7-001",
  "G7-002",
  "OQ-006",
  "OQ-007",
  "OQ-008",
  "OQ-009",
  "AUTH-001",
  "DATA-001",
  "MAP-001",
  "MODEL-001",
  "RELEASE-001",
  "STORY-001",
]);

type CsvRow = Record<string, string>;
type GateVerdict = "PASS" | "BLOCKED" | "FAIL";

interface DeliveryRecord {
  readonly deliveryId: string;
  readonly gates: readonly {
    readonly id: string;
    readonly status: string;
  }[];
}

export interface DeliveryEvidenceInput {
  readonly recordJson: string;
  readonly matrixCsv: string;
  readonly traceabilityCsv: string;
  readonly gapDecisionsMarkdown: string;
  readonly openDecisionsMarkdown: string;
  readonly prohibitedImplementationPaths: readonly string[];
  readonly threatModelPresent: boolean;
  readonly openDecisionsResolved: boolean;
  readonly signedSandboxEvidencePresent: boolean;
}

export interface DeliveryEvidenceReport {
  readonly deliveryId: string;
  readonly structureValid: boolean;
  readonly verdict: GateVerdict;
  readonly counts: {
    readonly matrixRows: number;
    readonly traceabilityRows: number;
    readonly pendingGapRecords: number;
    readonly localDecisionRows: number;
    readonly openDecisions: number;
  };
  readonly checks: readonly {
    readonly name: string;
    readonly status: "PASS" | "FAIL";
    readonly detail: string;
  }[];
  readonly failedChecks: readonly string[];
  readonly blockers: readonly string[];
}

export function parseCsv(input: string): CsvRow[] {
  const parsedRows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const finishField = () => {
    row.push(field);
    field = "";
  };
  const finishRow = () => {
    finishField();
    parsedRows.push(row);
    row = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) throw new SyntaxError("CSV quote must start an empty field");
      quoted = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\n") {
      finishRow();
    } else if (character === "\r") {
      if (input[index + 1] !== "\n") finishRow();
    } else {
      field += character;
    }
  }

  if (quoted) throw new SyntaxError("CSV contains an unterminated quoted field");
  if (field.length > 0 || row.length > 0) finishRow();
  if (parsedRows.length === 0) return [];

  const headers = parsedRows[0] ?? [];
  if (new Set(headers).size !== headers.length) throw new SyntaxError("CSV headers must be unique");

  return parsedRows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new SyntaxError(
        `CSV row ${index + 2} has ${values.length} fields, expected ${headers.length}`,
      );
    }
    return Object.fromEntries(
      headers.map((header, fieldIndex) => [header, values[fieldIndex] ?? ""]),
    );
  });
}

function expectedIds(prefix: string, count: number): Set<string> {
  return new Set(
    Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`),
  );
}

function matchesIdSet(rows: readonly CsvRow[], expected: ReadonlySet<string>): boolean {
  const actual = rows.map((row) => row.requirement_id ?? "");
  return (
    actual.length === expected.size &&
    new Set(actual).size === expected.size &&
    actual.every((id) => expected.has(id))
  );
}

function matchesExpectedIds(rows: readonly CsvRow[], prefix: string, count: number): boolean {
  return matchesIdSet(rows, expectedIds(prefix, count));
}

function markdownTableIds(markdown: string, pattern: RegExp): Set<string> {
  return new Set(Array.from(markdown.matchAll(pattern), (match) => match[1] ?? ""));
}

function fullyResolvedDecisionIds(markdown: string): Set<string> {
  return new Set(
    Array.from(markdown.matchAll(/^\|\s*([A-Z0-9]+-\d{3})\s*\|\s*([^|\r\n]*)\|/gm), (match) =>
      (match[2] ?? "").includes("`RESOLVED`") ? (match[1] ?? "") : "",
    ).filter(Boolean),
  );
}

export function evaluateDeliveryEvidence(input: DeliveryEvidenceInput): DeliveryEvidenceReport {
  const checks: { name: string; status: "PASS" | "FAIL"; detail: string }[] = [];
  const addCheck = (name: string, passed: boolean, detail: string) => {
    checks.push({ name, status: passed ? "PASS" : "FAIL", detail });
  };

  let record: DeliveryRecord;
  try {
    record = JSON.parse(input.recordJson) as DeliveryRecord;
    addCheck("delivery record JSON", true, "valid JSON");
  } catch {
    record = { deliveryId: "INVALID", gates: [] };
    addCheck("delivery record JSON", false, "invalid JSON");
  }

  let matrixRows: CsvRow[] = [];
  let traceRows: CsvRow[] = [];
  try {
    matrixRows = parseCsv(input.matrixCsv);
    addCheck("G7 capability matrix CSV", true, `${matrixRows.length} data rows parsed`);
  } catch (error) {
    addCheck(
      "G7 capability matrix CSV",
      false,
      error instanceof Error ? error.message : "parse failed",
    );
  }
  try {
    traceRows = parseCsv(input.traceabilityCsv);
    addCheck("traceability CSV", true, `${traceRows.length} data rows parsed`);
  } catch (error) {
    addCheck("traceability CSV", false, error instanceof Error ? error.message : "parse failed");
  }

  const matrixIdsValid = matchesExpectedIds(matrixRows, "FR", 82);
  addCheck("G7 capability matrix IDs", matrixIdsValid, "requires unique FR-001..FR-082");
  const reuseModesValid = matrixRows.every((row) => ALLOWED_REUSE_MODES.has(row.reuse_mode ?? ""));
  addCheck("G7 reuse modes", reuseModesValid, "all rows use an approved reuse_mode value");

  const traceCounts = new Map<string, number>();
  for (const row of traceRows) {
    const prefix = (row.requirement_id ?? "").split("-")[0] ?? "";
    traceCounts.set(prefix, (traceCounts.get(prefix) ?? 0) + 1);
  }
  const traceIdsValid = Object.entries(EXPECTED_TRACE_COUNTS).every(([prefix, count]) => {
    const prefixRows = traceRows.filter((row) =>
      (row.requirement_id ?? "").startsWith(`${prefix}-`),
    );
    const expected =
      prefix === "OQ"
        ? new Set(["OQ-006", "OQ-007", "OQ-008", "OQ-009"])
        : expectedIds(prefix, count);
    return traceCounts.get(prefix) === count && matchesIdSet(prefixRows, expected);
  });
  addCheck(
    "traceability stable ID counts",
    traceIdsValid && traceRows.length === 464,
    "requires 44 RQ, 15 UJ, 82 FR, 25 NFR, 4 OQ, 45 AD, 12 EP, 74 US and 163 TEST rows",
  );

  const gapIds = markdownTableIds(input.gapDecisionsMarkdown, /^\|\s*(G7-GAP-\d{3})\s*\|/gm);
  const gapsProposed = input.gapDecisionsMarkdown.includes("PROPOSED_NOT_APPROVED");
  addCheck("G7 gap records", gapIds.size === 10, "requires G7-GAP-001..G7-GAP-010");

  const localRows = matrixRows.filter((row) => LOCAL_DECISION_MODES.has(row.reuse_mode ?? ""));
  const localRowsSafelyGoverned = localRows.every((row) => {
    const rowGapIds = Array.from((row.identified_gap ?? "").matchAll(/G7-GAP-\d{3}/g), (match) =>
      String(match[0]),
    );
    const gapReferencesValid =
      rowGapIds.length > 0 && rowGapIds.every((gapId) => gapIds.has(gapId));
    const remainsBlocked =
      (row.decision ?? "").includes("BLOCKED") && (row.approver ?? "").startsWith("UNASSIGNED");
    const approved =
      (row.decision ?? "").includes("APPROVED") && !(row.approver ?? "").startsWith("UNASSIGNED");
    return gapReferencesValid && (gapsProposed ? remainsBlocked : approved);
  });
  addCheck(
    "local decisions follow gap approval state",
    localRowsSafelyGoverned,
    `${localRows.length} LOCAL_EXTENSION/LOCAL_GAP_IMPLEMENTATION rows inspected`,
  );

  const openDecisionIds = markdownTableIds(
    input.openDecisionsMarkdown,
    /^\|\s*([A-Z0-9]+-\d{3})\s*\|/gm,
  );
  const resolvedDecisionIds = fullyResolvedDecisionIds(input.openDecisionsMarkdown);
  const unresolvedDecisionIds = REQUIRED_OPEN_DECISIONS.filter(
    (id) => !resolvedDecisionIds.has(id),
  );
  const openDecisionsPresent = REQUIRED_OPEN_DECISIONS.every((id) => openDecisionIds.has(id));
  addCheck(
    "required open decisions",
    openDecisionsPresent,
    `${openDecisionIds.size} decision records found; ${unresolvedDecisionIds.length} remain open`,
  );

  const preGateBoundaryValid = input.prohibitedImplementationPaths.length === 0;
  addCheck(
    "pre-gate implementation boundary",
    preGateBoundaryValid,
    preGateBoundaryValid
      ? "no application, migration or SQL implementation path found"
      : input.prohibitedImplementationPaths.join(";"),
  );

  const productGate = record.gates.find((gate) => gate.id === "product")?.status ?? "missing";
  const designGate = record.gates.find((gate) => gate.id === "design")?.status ?? "missing";
  const blockers: string[] = [];
  if (productGate !== "passed") blockers.push(`Product Gate is ${productGate}`);
  if (designGate !== "passed") blockers.push(`Design Gate is ${designGate}`);
  if (gapsProposed) blockers.push(`${gapIds.size} G7 gap records remain proposed and unapproved`);
  if (!input.openDecisionsResolved && unresolvedDecisionIds.length > 0)
    blockers.push(`${unresolvedDecisionIds.length} administrator/product decisions remain open`);
  if (!input.threatModelPresent)
    blockers.push("Final repository threat model is pending context confirmation");
  if (!input.signedSandboxEvidencePresent)
    blockers.push("Signed G7 SANDBOX request/response evidence is absent by approved design");

  const failedChecks = checks.filter((check) => check.status === "FAIL").map((check) => check.name);
  const structureValid = failedChecks.length === 0 && record.deliveryId === DELIVERY_ID;
  if (record.deliveryId !== DELIVERY_ID) failedChecks.push("delivery identifier");

  return {
    deliveryId: record.deliveryId,
    structureValid,
    verdict: structureValid ? (blockers.length === 0 ? "PASS" : "BLOCKED") : "FAIL",
    counts: {
      matrixRows: matrixRows.length,
      traceabilityRows: traceRows.length,
      pendingGapRecords: gapsProposed ? gapIds.size : 0,
      localDecisionRows: localRows.length,
      openDecisions: input.openDecisionsResolved ? 0 : unresolvedDecisionIds.length,
    },
    checks,
    failedChecks,
    blockers,
  };
}

function readRequired(path: string): string {
  if (!existsSync(path)) throw new Error(`Required delivery artifact is missing: ${path}`);
  return readFileSync(path, "utf8");
}

function runCli(): void {
  const repositoryRoot = resolve(import.meta.dirname, "..");
  const requirePass = process.argv.includes("--require-pass");
  const requestedRoot = process.argv
    .slice(2)
    .find((argument) => !argument.startsWith("--") && argument !== process.argv[1]);
  const deliveryRoot = resolve(repositoryRoot, requestedRoot ?? `docs/delivery/${DELIVERY_ID}`);
  const prohibitedImplementationPaths = globSync(["apps/**/*", "**/migrations/**/*", "**/*.sql"], {
    cwd: repositoryRoot,
    exclude: [".git/**", "node_modules/**", "_bmad-output/**"],
  });

  const report = evaluateDeliveryEvidence({
    recordJson: readRequired(resolve(deliveryRoot, "delivery-record.json")),
    matrixCsv: readRequired(resolve(deliveryRoot, "g7-capability-matrix.csv")),
    traceabilityCsv: readRequired(resolve(deliveryRoot, "traceability.csv")),
    gapDecisionsMarkdown: readRequired(resolve(deliveryRoot, "g7-gap-decisions.md")),
    openDecisionsMarkdown: readRequired(resolve(deliveryRoot, "open-decisions.md")),
    prohibitedImplementationPaths,
    threatModelPresent: existsSync(resolve(repositoryRoot, "docs/security/YXDEMO-threat-model.md")),
    openDecisionsResolved: existsSync(
      resolve(deliveryRoot, "evidence/open-decisions-resolution.json"),
    ),
    signedSandboxEvidencePresent: existsSync(
      resolve(deliveryRoot, "evidence/g7-sandbox-contract-summary.json"),
    ),
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.structureValid) process.exitCode = 1;
  else if (requirePass && report.verdict !== "PASS") process.exitCode = 2;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) runCli();
