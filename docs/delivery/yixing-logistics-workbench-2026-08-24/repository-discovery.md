# Repository Read-only Discovery

Status: `SOURCE_BASELINE_READY_FOR_FIRST_COMMIT`

- Remote: `https://github.com/zhouhl5113-blip/YXDEMO.git`.
- Local checkout: `D:\Harness\YXDEMO`; branch `main` is unborn and the remote has no branch or commit.
- The eight required product assets were recovered from the local product-design source, copied with their original paths and verified against `artifact-manifest.yaml`.
- Seven supplied hashes matched. The source manifest omitted the required `user-voice` hash; the target manifest records the computed SHA-256 with amendment evidence.
- The prototype contained a hard-coded AMap key. The repository copy was sanitized before any commit, its target hash was updated, and the credential must be rotated before any real use.
- Current verified counts are 44 RQ, 15 UJ, 82 FR, 25 NFR, 45 AD, 12 EP, 74 US and 145 TEST IDs.
- No production application, tests, lock file, container definition or deployable Harness configuration exists yet. This is intentional while Product and Design gates are blocked.

The first Git commit may contain the sanitized product-reference assets and manifest. It must not be described as a runnable product or release candidate.
