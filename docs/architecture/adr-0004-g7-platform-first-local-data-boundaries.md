# ADR-0004: G7 Platform-First Local Data Boundaries

## Status

`PROPOSED_PENDING_G7_EVIDENCE_AND_APPROVAL`

This ADR is ready for Product, Security, Data and G7 integration review. It does
not authorize a migration, live G7 call, Agent execution, R3 action, Secret
change or deployment.

## Date

2026-08-25

## Dependencies

- ADR-0001 limits the current Windows host to local development and acceptance.
- ADR-0002 requires credentialless, synthetic G7 work until dedicated rotated
  SANDBOX credentials are bound through Harness Secret Manager.
- ADR-0003 owns authentication and application authorization boundaries; R3
  remains disabled until a distinct second approver exists.
- `g7-capability-matrix.csv` and `g7-gap-decisions.md` are the authoritative
  capability and gap inventories.

## Context

G7 provides asset, driver, assignment, telemetry, trip, site, geofence and
related platform facts. The product also needs work ownership, transport
fulfilment, approvals, audit, offline commands, maintenance, customer and
financial workflows that are absent or not yet contract-proven in the target
SANDBOX application. Treating every PRD object as a local aggregate would copy
G7 master data; refusing all local state would make the required workflows
impossible.

The decision must therefore define exactly what may be stored locally, who owns
each fact, and which evidence must exist before physical schema activation.

## Decision

Use three explicit data classes:

1. `G7_REFERENCE`: identifiers and current facts owned by G7. Local code stores
   only a source reference or an approved replayable read projection.
2. `PRODUCT_STATE`: workflow, authorization, approval, audit, idempotency and
   offline-operation state that exists specifically for this product.
3. `DERIVED_PROJECTION`: replayable search, queue, freshness, impact or metric
   results whose inputs and definition versions remain traceable.

Every local record must carry, as applicable:

- `tenant_id`, local immutable ID and the governing `G7-GAP-*` identifier;
- G7 source object type/ID/version and source tenant reference;
- `happened_at`, `received_at`, freshness classification and synchronization state;
- idempotency/request/trace IDs and optimistic version;
- origin, last readback result and replay/checkpoint reference;
- retention class, sensitivity class and audit actor.

G7 master facts are never overwritten from a local projection. Commands that
write G7 must use `integrations/g7`, be idempotent, pass the risk gate, and
perform write-after-readback before local completion is recorded.

Raw location history is not persisted in the approved local scope. Agent tables,
model calls and R3 execution remain absent until OQ-009 and independent R3
approval are resolved.

## Gap Boundaries

| Gap | Local candidate owned by this product | G7 remains owner of | Activation condition |
| --- | --- | --- | --- |
| G7-GAP-001 | Tenant membership mapping, work ownership, append-only audit, idempotency and Outbox | Asset, driver, assignment and telemetry objects | Signed SANDBOX object contracts plus Product/Security/Data approval |
| G7-GAP-002 | Replay checkpoint and freshness/search projection | G7 object and telemetry facts | Pagination, cursor expiry, replay, limit and scale evidence |
| G7-GAP-003 | Order, segment, stop, planning and dispatch workflow state keyed to G7 references | Vehicles, drivers, sites, geofences and released trip facts | Signed read contracts; controlled write/readback evidence for every enabled write |
| G7-GAP-004 | Agent thread, evidence and tool-run metadata | All operational facts exposed to tools | OQ-009, model governance and Agent Acceptance Gate; disabled before then |
| G7-GAP-005 | Customer SLA, case, claim and reconciliation workflow | G7 message and transport facts | V1.5 approval and finance/data retention decision |
| G7-GAP-006 | Versioned Playbook and knowledge governance metadata | G7 operational facts used as evidence | V1.5 AI governance approval and rollback test |
| G7-GAP-007 | Versioned semantic definitions and replayable derived metrics | G7 source facts | V2 metric owner, financial definition and performance acceptance |
| G7-GAP-008 | Role workspace, shift/handoff, resource lease, device session and offline-command ledger | G7 driver, assignment, asset and telemetry facts | ADR-0003 acceptance for runtime, device/offline tests and approved retention |
| G7-GAP-009 | Inspection defect, maintenance work linkage and derived vehicle availability | G7 asset, qualification and telemetry facts | Signed source contracts, fleet-maintenance approval and state-machine tests |
| G7-GAP-010 | Source-separated fuel/energy transaction references and derived cost projection | G7 mileage, location and telemetry facts | Finance/data approval, source reconciliation and retention rules |

## Schema Gate

Before any migration is executable, a machine-readable schema manifest must list
every table, queue, stream and state machine with:

```text
component | owner | g7_gap | adr | truth_class | source_mapping |
retention_class | migration | rollback | approver | evidence
```

The Build Gate fails when a local component has no accepted gap, ADR, named
approver, SANDBOX evidence required by its activation condition, backward-
compatible migration or rollback procedure. Draft migrations may be reviewed
but cannot run while the corresponding record is not accepted.

## Alternatives Considered

### Copy G7 master data into a complete local TMS

Rejected because it creates two lifecycle owners, stale data and unsafe reverse
write paths.

### Keep no local persistence

Rejected because approvals, audit, idempotency, offline commands and product
workflow state cannot be recovered or reconciled reliably.

### One generic document table for all workflows

Rejected because tenant isolation, state constraints, retention and migration
ownership would be opaque and difficult to test.

## Consequences

Positive:

- G7 remains the clear owner of platform facts and master objects.
- Product-specific workflows can be implemented without a second G7 lifecycle.
- Every local capability can be blocked, replayed, audited and removed by gap.

Negative:

- Delivery cannot start all domains at once; evidence and approvals are required
  gap by gap.
- Read projections require replay tooling and freshness monitoring.
- Cross-domain workflows need explicit version and compensation handling.

## Migration And Rollback

- Use expand/contract migrations and backward-compatible application releases.
- Create no irreversible destructive migration in the same release as a new
  workflow.
- Disable the governing feature flag, stop new writes, drain Outbox, reconcile
  G7 readback and restore the last approved digest before schema contraction.
- Rebuild derived projections from checkpoints; never restore them as an
  authoritative replacement for newer G7 facts.

## Validation Criteria

- A schema-manifest gate rejects every component without its gap and evidence.
- RLS tests demonstrate cross-tenant rejection independently of BFF filtering.
- Contract tests cover signing, pagination/cursor, error mapping, timeout,
  throttling and supported controlled writes in SANDBOX.
- Integration tests cover Outbox atomicity, idempotency, duplicate/out-of-order
  feeds, replay and write-after-readback.
- Raw location history, production credentials, Agent and R3 remain absent while
  their decisions are unresolved.

## Approval Required

Acceptance requires named Product, Security, Data and G7 integration approval,
an approval/review date for every `G7-GAP-*`, and signed SANDBOX evidence for
each activated source contract. Production requires a separate decision against
the exact release digest and production infrastructure.

## Related Requirements And Evidence

- FR-001..082, NFR-003..005, NFR-007, NFR-009, NFR-019..025
- `docs/delivery/yixing-logistics-workbench-2026-08-24/g7-capability-matrix.csv`
- `docs/delivery/yixing-logistics-workbench-2026-08-24/g7-gap-decisions.md`
- `docs/delivery/yixing-logistics-workbench-2026-08-24/open-decisions.md`
- `docs/security/YXDEMO-threat-model.md`
