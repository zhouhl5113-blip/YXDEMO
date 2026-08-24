# ADR-0001: Local Windows Server Host for Development and Acceptance

## Status

`PROPOSED_LOCAL_ONLY`

This decision is approved by the project initiator for local development and testing. It is not approval to bind the Harness Production environment or to claim production readiness.

## Date

2026-08-24

## Context

The project currently has no external server or cloud runtime. The selected host is Windows Server 2025 Datacenter with 8 logical processors, 15.5 GB memory and 87.7 GB free on drive D. Hardware virtualization and SLAT are not exposed to the operating system. Docker Desktop is unsupported on Windows Server, and a WSL 2 Linux container runtime cannot operate without virtualization.

The PRD requires 99.9% monthly availability (NFR-002), recoverable local work during G7 degradation, traceable operations (NFR-005), and repeatable immutable promotion. A single workstation cannot demonstrate host redundancy, independent failure domains, production backup recovery or a safe canary rollback path.

## Decision

Use the current host as a temporary local development and acceptance host:

- Windows runs the Node.js application processes and local developer tooling.
- Ubuntu 24.04 on WSL 1 runs PostgreSQL and Redis for development and contract/integration testing.
- Harness `yixing_dev` and `yixing_preprod` may later receive separate local Infrastructure definitions only after the Service and deployment contract exist.
- Development and preproduction must use separate application processes, database roles/databases and Redis instances or ports. This is logical isolation, not a production failure-domain boundary.
- Harness `yixing_prod` remains an empty Environment with no Infrastructure definition or credentials.
- No public inbound firewall rule, production DNS, PROD G7 credential binding or production deployment is authorized by this ADR.

## Alternatives Considered

### Docker Desktop on this host

Rejected because Docker Desktop does not support Windows Server and the host does not expose the virtualization required by its Linux backends.

### Native Windows PostgreSQL plus an unverified Redis port

Rejected because it would introduce a nonstandard Redis implementation before Redis Streams compatibility and operational support are proven.

### Dedicated Linux VM or managed Kubernetes

Preferred for real production because it supports immutable Linux containers, stronger isolation, repeatable recovery and Harness deployment patterns. Deferred until a separate host or cloud account is available.

## Consequences

Positive:

- Foundation tooling and SANDBOX-only integration tests can run without purchasing infrastructure immediately.
- The host remains usable despite unavailable nested virtualization.
- PostgreSQL and Redis stay on their supported Linux packages.

Negative:

- WSL 1 is not the release container runtime and cannot prove OCI deployment behavior.
- Dev and preproduction share a physical failure domain.
- Host restart, user session, disk failure and local network outage affect every local environment.
- Performance results are indicative only and cannot satisfy the production 10,000-vehicle capacity evidence.

## Validation Criteria

- WSL feature and Ubuntu package installation are recorded without secrets.
- PostgreSQL `pg_isready` and Redis `PING` succeed after restart.
- Services bind locally until a reviewed network exposure decision exists.
- Separate dev/preproduction data identities are tested before either Harness Infrastructure is created.
- Product and Design gates remain blocked until G7 SANDBOX evidence, gap approvals and remaining governance decisions are complete.
- Production Infrastructure remains absent until an independent runtime, backup/restore evidence, monitoring, approval owner and rollback target are approved.

## Related Requirements and Evidence

- NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, NFR-008
- `docs/delivery/yixing-logistics-workbench-2026-08-24/open-decisions.md`
- `docs/delivery/yixing-logistics-workbench-2026-08-24/evidence/local-runtime-discovery.json`
