# Repository Read-only Discovery

Status: `SOURCE_BASELINE_PUBLISHED`

- Remote: `https://github.com/zhouhl5113-blip/YXDEMO.git`.
- Local checkout: `D:\Harness\YXDEMO`; verified source baseline commit `c94ca688b869a8cb7f624ccee845728d9bc3bd6b` remains in history, and the current audited head is `21d209fe970fef89dfe3ca8052efe4437796f48b`.
- `main` was created from that audited head, pushed, and made the GitHub default branch. The original `codex/product-assets-baseline` branch is retained as evidence history. Branch protection is intentionally pending until required CI checks exist.
- The eight required product assets were recovered from the local product-design source, copied with their original paths and verified against `artifact-manifest.yaml`.
- Seven supplied hashes matched. The source manifest omitted the required `user-voice` hash; the target manifest records the computed SHA-256 with amendment evidence.
- The prototype contained a hard-coded AMap key. The repository copy was sanitized before any commit, its target hash was updated, and the credential must be rotated before any real use.
- Current verified counts are 44 RQ, 15 UJ, 82 FR, 25 NFR, 45 AD, 12 EP, 74 US and 145 TEST IDs.
- No production application, tests, lock file, container definition or deployable Harness configuration exists yet. This is intentional while Product and Design gates are blocked.

The published `main` head is an evidence/source baseline only. It is not a runnable product or release candidate.
