# Delivery Rules

- Treat Harness as the delivery control plane and start discovery read-only.
- Preserve requirement-to-design-to-code-to-test-to-gate-to-evidence traceability.
- Verify `artifact-manifest.yaml` before using product assets.
- Keep the HTML prototype as read-only reference; never deploy it as the production application.
- Route every G7 call through server-side `integrations/g7`; clients and models never hold G7 credentials.
- Do not create a local table, queue, state machine or service without an approved `G7-GAP-*` record and ADR.
- Keep every credential out of Git, logs, screenshots, tests and artifacts; use approved Secret Manager references.
- Do not start production implementation until Product and Design gates pass.
- Promote the same immutable digest accepted in preproduction, with explicit human approval for production.
- Never bypass failed tests, policies, security scans, acceptance, freeze windows or Continuous Verification.
