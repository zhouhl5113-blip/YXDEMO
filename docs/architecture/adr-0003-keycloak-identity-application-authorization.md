# ADR-0003: Keycloak Identity with Application-Owned Authorization

## Status

`ACCEPTED_FOR_LOCAL_DEVELOPMENT_AND_TEST`

On 2026-08-24, project initiator, Product approver, Security responsible person, Data owner and local Design Gate approver 周贺龙 explicitly accepted this ADR for local development and testing. The acceptance authorizes pure authorization-policy contracts and synthetic tests only. It does not authorize deploying Keycloak, creating identity tables or migrations, changing Secrets/RBAC, calling real G7 write APIs, enabling Agent/R3 capabilities or binding production infrastructure.

周贺龙 is now the named Product approver, Security responsible person and Data owner. Because all three responsibilities are held by one person, independent review is not demonstrated. No distinct second R3 approver exists, so R3 actions remain disabled.

## Date

2026-08-24

## Context

The product requires workforce and driver identities, six role-oriented workspaces, one-person multi-role switching, temporary delegation, driver substitution, revocable device sessions, tenant/organization/tag scope, R0-R3 approvals and complete audit evidence. The user confirmed that access is currently limited to the local computer, company network or VPN and that the project should own the account and permission system.

Building password storage, MFA, recovery, OIDC, token rotation and session administration directly inside the logistics application would create a high-risk security subsystem unrelated to logistics differentiation. Conversely, placing all authorization in an identity-provider role claim would be too coarse: authorization depends on tenant, organization, tag, fleet, assignment, shift, delegation, object, field and action state. A role switch must not expand the underlying data scope.

The current host is approved only for local development and testing under ADR-0001. Product and Design gates remain blocked because `G7-GAP-001` and `G7-GAP-008` are unapproved and other Product/Design evidence is absent. OQ-008 data-scope semantics are approved only for the local contract work covered by this ADR.

## Decision

Adopt a split identity and authorization architecture:

- Use a self-hosted Keycloak deployment as the identity provider for account credentials, MFA, OIDC login, account lifecycle, session administration and future optional AD/LDAP or upstream OIDC/SAML federation.
- Use OIDC Authorization Code flow with PKCE for workforce and Driver Companion interactive clients. Do not enable the implicit flow.
- Keep passwords, WebAuthn credentials, OTP secrets and recovery codes out of the logistics application database.
- Treat IdP roles as coarse identity attributes only. Every BFF derives a trusted subject and tenant membership server-side, then applies application-owned RBAC/ABAC policies.
- Ignore client-submitted `tenant_id`, role and scope. Compute effective access from the active tenant membership, selected business role, organization, tag, fleet, assignment, shift and delegation; explicit deny wins.
- Enforce the same tenant boundary in PostgreSQL transaction context and RLS as defense in depth. RLS does not replace BFF authorization.
- Maintain separate audiences and minimum endpoints for the workforce BFF and Driver BFF. Driver authorization binds the active driver, device, task, vehicle and time window.
- Separate identity administration, security approval and business operation duties. An identity administrator has no business-data access by default; an R2/R3 initiator cannot approve the same action.
- Require strong MFA for workforce users. Privileged administrators, security approvers and break-glass accounts require phishing-resistant WebAuthn/passkey or an approved equivalent.
- Store only a stable external subject mapping and application authorization state after the relevant G7 gaps and migrations are explicitly approved. Never copy IdP credential material.
- Keep the Keycloak admin console on a restricted management route/network. Runtime endpoints remain restricted to the approved local, intranet or VPN boundary and use TLS.
- Pin the exact Keycloak release, Java runtime, database schema and deployment digest at Build Gate. The evaluated official baseline is the Keycloak 26.x documentation and the current 26.7 release line as of this ADR date; no floating `latest` tag is permitted.

## Authorization Invariants

1. Authentication success does not imply access to any logistics tenant.
2. Tenant membership must be active and is resolved server-side from the immutable IdP subject.
3. A role switch can only retain or reduce the existing data range.
4. Delegation cannot exceed the delegator's permissions or its approved time window.
5. The effective data scope is the intersection of all applicable constraints; any explicit deny wins. OQ-008 approves this invariant for local development and testing.
6. Object and field authorization is re-evaluated on every request and before every tool or G7 call.
7. PostgreSQL RLS independently rejects a tenant mismatch.
8. Driver sessions become invalid on driver, device, task or vehicle reassignment and require lightweight reauthentication.
9. R2/R3 approvals bind the actor, plan hash, object scope, expiry and tool version; self-approval is rejected.
10. Account, role, scope, delegation, device and approval changes produce immutable audit evidence with request and trace IDs.

## Alternatives Considered

### Application-built authentication

Rejected. It would make the project responsible for secure password hashing, MFA enrollment and recovery, token issuance and rotation, session revocation, brute-force protection, federation and security patch response. None of these are product differentiators, and mistakes would directly expose every tenant.

### Cloud SaaS identity provider

Deferred. It could reduce operational work, but the provider, region, pricing, external connectivity and data-governance rules are unknown. The application authorization boundary remains reusable if this option is selected later.

### Identity-provider roles as the complete authorization system

Rejected. Static realm/client roles cannot safely express assignment, shift, delegation, device, task, object version and R0-R3 approval state. Pushing these facts into long-lived tokens would create stale authorization and oversized sensitive claims.

## Consequences

Positive:

- Authentication uses a dedicated, widely used identity platform instead of new password/token code.
- The project can stay inside the company network/VPN and later federate existing corporate identity without rewriting business authorization.
- Workforce and driver clients share authentication governance while retaining separate BFF audiences and minimum business surfaces.
- Tenant and object access remain testable in application policy and PostgreSQL RLS rather than being hidden in UI navigation or IdP administration.

Negative:

- Keycloak becomes a critical service that needs production TLS, a supported database, backup/restore, patching, monitoring and high availability.
- Identity and application authorization must be reconciled on account/role changes; token lifetime alone cannot guarantee immediate revocation.
- A dedicated management network and separate privileged administrators increase setup work.
- The current single Windows development host cannot satisfy production availability or disaster-recovery requirements for the identity service.

## Runtime Compatibility

| Concern | Requirement |
| --- | --- |
| Development | May use a pinned, non-production local instance only after the Design Gate authorizes implementation; synthetic accounts only |
| Preproduction | Separate realm/clients, database and secrets; no production users or G7 PROD data |
| Production | Independent supported runtime, TLS, production database, backup/restore test, monitoring and at least two identity service instances or an approved equivalent |
| Web/BFF | Server-side OIDC client; secure, HttpOnly, SameSite cookies; token values not exposed to browser storage |
| Driver Companion | Public-client PKCE or BFF-mediated flow with a separate audience; device/task session remains application-owned |
| Upgrade | Exact version and digest pinned; backup, compatibility test and rollback/export procedure required before upgrade |

## Validation Criteria

- TEST-001 proves client `tenant_id` is ignored and trusted membership is used.
- TEST-002 proves cross-tenant and unauthorized field access is denied without leaking object summaries and the denial is audited.
- TEST-003 proves permission removal and account/session revocation prevent reuse of an older session.
- Unit and integration tests cover explicit deny precedence, scope intersection, role switching, delegation expiry and self-approval rejection.
- RLS tests use separate tenants and demonstrate rejection even when an application query is intentionally under-filtered.
- Driver E2E covers shared device, replacement driver, replacement vehicle, revoked device, offline duplicate/expired command and responsibility handoff.
- Security tests cover authorization-code interception resistance through PKCE, CSRF/state/nonce, refresh reuse, MFA bypass, brute-force controls and management-route isolation.
- Logs, traces, screenshots, bundles and evidence contain no passwords, OTP seeds, recovery codes, access/refresh tokens or client secrets.
- Backup/restore, session revocation and Keycloak upgrade rollback are demonstrated before Acceptance Gate.

## Approval And Exit Conditions

Before identity runtime or persistence implementation:

- OQ-008 intersection and deny semantics are approved for local policy-contract implementation. Production use requires confirmation at the applicable Design/Release Gate.
- Product, Security and Data owners approve the minimum local identity mapping under `G7-GAP-001` and driver session state under `G7-GAP-008`.
- A Security architect accepts this ADR and the repository threat model.

## Named Governance Assignment

| Responsibility | Assignment | Effect |
| --- | --- | --- |
| Product approver | 周贺龙 | Named; action-specific Product approval is still recorded separately |
| Security responsible person | 周贺龙 | Named; independent security review is not available |
| Data owner | 周贺龙 | Named; data-retention and gap decisions still require explicit approval |
| Independent R3 second approver | `UNASSIGNED` | R3 actions are disabled |
| Local Design Gate approver | 周贺龙 | Assigned for the explicitly limited local development/test approval |
| Acceptance/Production approvers | `UNASSIGNED` | Corresponding gates remain pending; no production approval exists |

Evidence: `docs/delivery/yixing-logistics-workbench-2026-08-24/evidence/identity-governance-assignment.json` and `docs/delivery/yixing-logistics-workbench-2026-08-24/evidence/local-design-approval.json`.

Before production:

- Platform owner supplies independent production identity infrastructure, DNS/TLS, database HA, backup/restore, observability and patch ownership.
- Harness Service, Infrastructure, Secret references and Pipeline are created read-first and pass Security and Acceptance Gates.
- Production approval is explicit and applies to the exact immutable digest.

## Related Requirements And Evidence

- FR-002, FR-017, FR-057, FR-063..068
- NFR-003, NFR-005, NFR-009, NFR-019, NFR-021, NFR-023..025
- UJ-011..015, US-001, TEST-001..003
- AD-032, AD-033, AD-037
- `docs/security/YXDEMO-threat-model.md`
- `docs/security/identity-access-decision-brief.md`
- `docs/delivery/yixing-logistics-workbench-2026-08-24/g7-gap-decisions.md`
- `docs/delivery/yixing-logistics-workbench-2026-08-24/open-decisions.md`
