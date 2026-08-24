# Harness Read-only Discovery

Status: `TARGET_SCOPE_PARTIALLY_BOUND`

Observed at `2026-08-24T07:30:29Z`. Initial discovery called `harness_describe` for Organization, Project, Service, Environment, Infrastructure, Connector, Secret and Pipeline before any list or create operation. After the user authorized setup, a one-shot write session created only the dedicated Project and three empty Environment boundaries. The normal Harness MCP connection remained read-only. A second independent read-only pass produced the results below.

| Scope/resource | Read-only result | Delivery decision |
| --- | --- | --- |
| Account | `VR3gJDjcRkq7ocR7ywpT-Q` | Bound to this delivery |
| Organization | `default` | Bound to this delivery |
| Project | `default/yixing_logistics_workbench` (`Yixing Logistics Workbench`) | Dedicated target Project created and read back |
| Service | 0 | Intentionally not created until the deployable runtime/artifact contract exists |
| Environment | `yixing_dev`, `yixing_preprod`, `yixing_prod` | Empty control-plane boundaries created; no infrastructure attached |
| Infrastructure | 0 in each target Environment | Runtime/region/namespace decision is still required |
| Pipeline | 0 | Must be generated only after Service, artifact and infrastructure contracts are known |
| Project secrets | 0 | No G7, AMap, database, Redis, session, KMS or model value has been stored |
| Project connector | `harnessSecretManager` (`SUCCESS`, Harness managed) | Available as the project Secret Manager; it currently contains no project secrets |
| Other required connectors | 0 approved | Source, artifact registry, runtime and observability connections remain unresolved |

Infrastructure was queried separately with the required environment filter for `yixing_dev`, `yixing_preprod` and `yixing_prod`; every query returned zero items. Existing Word Realm resources in `default/default_project` were left untouched.

## Required Administrator Binding

Resolved identifiers are Account `VR3gJDjcRkq7ocR7ywpT-Q`, Org `default`, Project `yixing_logistics_workbench`, and Environments `yixing_dev`, `yixing_preprod`, `yixing_prod`.

The administrator still needs to provide or approve the deployment runtime/region, one `infrastructureId` per target, source/artifact/runtime/observability connector references, `serviceId`, `pipelineId`, approval groups, freeze-window policy, and Continuous Verification/SLO references. Local review may continue, but every real-environment deployment remains blocked.
