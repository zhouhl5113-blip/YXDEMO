# Harness Read-only Discovery

Status: `TARGET_SCOPE_NOT_BOUND`

Observed at `2026-08-24T06:10:00Z`. `harness_describe` was called for Organization, Project, Service, Environment, Infrastructure, Connector, Secret and Pipeline before live list operations. No create, update, delete, execution, secret read or deployment operation was attempted.

| Scope/resource | Read-only result | Delivery decision |
| --- | --- | --- |
| Account | `VR3gJDjcRkq7ocR7ywpT-Q` | Authenticated account; not yet approved as this product's target |
| Organization | Only `default` | Not bound to this delivery |
| Project | Only `default/default_project` | Contains another product; not bound to this delivery |
| Service | `word_realm_card_journey` | Unrelated; must not be reused |
| Environment | `word_realm_staging` | Unrelated; must not be reused |
| Infrastructure | 0 under `word_realm_staging` | No target infrastructure found |
| Pipeline | `word_realm_delivery` | Unrelated; must not be reused |
| Project/account secrets | 0 / 0 | All required product Secret references are absent |
| Project connector | `harnessSecretManager` (`SUCCESS`) | Platform default; target binding still unapproved |
| Account connectors | `harnessImage` and `harnessSecretManager` succeed; `harnessOpenAI` and `harnessAnthropic` fail validation | No approved source, runtime, registry or observability connector identified |

The Infrastructure list was repeated with required environment filter `word_realm_staging`; it returned zero items. The earlier unfiltered API error therefore does not count as absence evidence by itself.

## Required Administrator Binding

The Harness project administrator must provide or approve: target `accountId`, `orgId`, `projectId`, `serviceId`; dev/preprod/prod `environmentId`; one `infrastructureId` per target; source, artifact registry, runtime, observability and approved Secret Manager connector references; pipeline identifier; approval group; freeze-window policy; and Continuous Verification/SLO references.

Until those identifiers exist, local review artifacts may continue, but Harness resource creation and every real-environment deployment remain blocked.
