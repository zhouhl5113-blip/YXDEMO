# Artifact Manifest Amendment

Observed: 2026-08-24.

The source manifest marked `user-voice` as required but omitted its
`sha256` field. The source asset existed and its SHA-256 was:

```text
4591b89643823d860941ff3eef469e39f584942e8c6e7109b46edb88608a4f3c
```

The other seven required assets matched their declared hashes exactly. Under
the project initiator's explicit authorization in this task, the repository
import manifest at `D:\Harness\YXDEMO\artifact-manifest.yaml` was amended
with this missing value. The original source manifest under the product-design
workspace was retained unchanged.

This amendment authorizes only integrity verification of the existing
`problem-catalog.md`; it does not approve any product, data-ownership,
infrastructure, secret, G7 gap, or production-release decision.

## Prototype credential sanitization

The imported prototype contained a hard-coded AMap Web Key. Before any Git
commit, the repository copy was sanitized to keep an empty `AMAP_KEY`
placeholder. The source prototype hash was
`a5839567e6ee756fbfcdd1d6d48ed9a4244d1d738b20703c037e31540443afb1`;
the sanitized repository asset hash is
`2275438ca379109804c018ce8560de96ff8e798b681f3aca64041b728b95c5ac`.

The target manifest was amended to the sanitized hash. The original design
workspace remains read-only. The exposed AMap credential is considered
compromised and must be rotated before any real map integration; no value was
copied into production code, delivery evidence, tests, or a Git commit.

## Story acceptance ID amendment

After the initial 8/8 verification, the product owner instructed the project to
resolve the remaining development blockers. `STORY-001` was corrected by adding
`TEST-146..163` to `US-069..074` without renumbering `TEST-001..145`, and the
obsolete Build Ready count was corrected from 68 to 82 FR. The Story asset hash
changed from `0b96a2d0535c5eb8d787f1d640e4010fdd614caa59e49e2500375e7a154d3f07`
to `b473e2675d60cac077682deb4fd974beeb2a14f84ff3977068fcebf27ed12fa1`.
The target manifest and asset-verification record were updated together; details
are in `evidence/story-acceptance-amendment.json`.
