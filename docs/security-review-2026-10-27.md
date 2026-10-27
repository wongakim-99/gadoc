# GaDoc Security Review: 2026-10-27

## Scope And Release Status

Reviewed the application source, dependency graph, file-storage boundary,
authentication, integration requests, and deployment configuration. Tests use
synthetic data and disposable local MongoDB/MinIO, not production workspaces.
This is a targeted code review and regression suite, not a complete penetration
test or a claim that every possible vulnerability has been eliminated.

The changes below are implemented and locally verified. They are **not yet
deployed**. Shared Docker/Colima I/O errors blocked earlier commands; the
infrastructure owner recovered the VM at 16:18 KST with user approval and
without replacing data volumes. The production `slacord` bucket still permits
anonymous reads until the new authenticated application is active. The dedicated
`gadoc-app` account and private backend override are staged, but are not used by
the running backend yet.

Blog public access remains public, blog private documents remain private, and
Pawpong is outside this change. No production MongoDB is split off or replaced.

## Findings And Remediation

Priorities below describe this review's assessment, not formal CVSS ratings.

| Priority | Finding                                                                                                                         | Implemented remediation                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | Attachment URLs bypassed application permissions through a public bucket; upload initialization could restore public policy.    | Authenticated `/api/files` checks team, channel/DM, or document access on every read. Removed policy writes from the app. Production anonymous policy removal remains pending deployment.            |
| High     | Root/default MinIO credentials gave the app excessive authority.                                                                | Production rejects missing/default credentials. `gadoc-app` only has GetObject/PutObject on the GaDoc chat/docs prefixes; no list, delete, bucket administration, or policy changes.                 |
| High     | Old inline keys lacked a document identifier, making team-only or current-link matching unsafe.                                 | Startup snapshots current and historical references once in the existing DB. Reads require access to all original bound documents; copied links, missing originals, and orphans cannot grant access. |
| High     | Regex-only HTML cleaning and Markdown attribute interpolation could permit stored XSS.                                          | Parser-based HTML allowlist, safe URL protocols, escaped attributes, and regression tests for active markup.                                                                                         |
| High     | Claimed upload MIME types could serve active HTML/SVG as trusted content.                                                       | Magic-byte classification, conservative binary fallback, forced attachment for unsafe types, nosniff and sandbox headers, and bounded multipart/file limits.                                         |
| High     | A known JWT fallback and permissive socket origins weakened authentication boundaries.                                          | Production fails on default/short signing secrets; HS256 is explicit. HTTP and socket origins use an exact allowlist.                                                                                |
| High     | Arbitrary integration hosts, redirects, or pagination links could send requests and credentials outside their intended service. | Confluence Cloud origin/path restrictions, same-origin pagination, official Slack/Discord webhook hosts, no redirects, time/body/page limits, and test-only loopback exceptions.                     |
| Medium   | Webhook signature handling did not consistently authenticate the exact request bytes.                                           | GitHub HMAC verifies the raw body with constant-time comparison and rejects malformed/missing signatures.                                                                                            |
| Medium   | Login lacked bounded attempt controls and explicit production cookie transport protection.                                      | Per-process IP/credential rate limits, input length limits, secure production cookies, and state-changing Origin checks. Successful login resets only its credential bucket.                         |
| Medium   | Query strings and server exception details could cross logging/client boundaries.                                               | Request-path logging excludes query strings; client 5xx responses are generic. Baseline web security headers and production Swagger opt-in were added.                                               |
| High     | The dependency tree included reported vulnerable versions; the packager separately pinned an old Electron runtime.              | pnpm lockfile, updated dependencies, official S3 SDK against the same MinIO, Electron 45, and removal of the stale packager override.                                                                |
| Medium   | Legacy PM2 environments could pass backend credentials to the frontend.                                                         | Server-only private credential overrides, frontend secret stripping, and rollback/configuration regression tests. Existing MongoDB and JWT settings are retained.                                    |

## Verification

- `pnpm install --frozen-lockfile`: successful with pnpm 10.34.9 and Node 22.
- `pnpm audit --audit-level high`: no known advisories across the installed workspace dependency graph at review time. Audit databases change; this is not a security guarantee.
- Server: 41 suites, 144 passing tests. Web: 25 suites, 95 passing tests.
- Document core: 17 passing tests. Desktop: 10 suites, 33 passing tests, including a real local Electron launch smoke test and packaging-version regression.
- Browser E2E: 38 passing tests, including private attachment permissions, inline rendering, ranges, and mobile/desktop brand navigation.
- Live surface: 78 passing checks, no failures/skips; Discord import mock passed.
- Actual isolated MongoDB migration test covers historical references, restarts, copied links, permission revocation, and deleted originals. Its temporary database is removed afterward.
- Dedicated account against the existing MinIO: allowed-prefix Put/Head/Range Get succeeded; ListBuckets, ListObjects, out-of-prefix Put, DeleteObject, and PutBucketPolicy returned AccessDenied. Only a synthetic verification object was created and then removed by an administrator.
- Gitleaks history scan covered 206 existing commits with no findings. Generated browser traces/build outputs contain synthetic test tokens and are excluded from version control; production credentials stay outside the repository.

## Remaining Gates

1. Confirm recovered runtime health and at least 15 GiB free on the Mac host before builds; remove only owned regenerable caches, never data volumes.
2. Install the pnpm deployment handler and backend-only storage credentials before merging to main. Run the actual Actions pipeline and confirm the served revision.
3. Verify an authorized production upload/read and legacy inline rendering, then remove anonymous access from `slacord` only. Confirm direct/proxy anonymous GET, HEAD, and LIST denial and unchanged blog behavior.
4. Publish and validate a new signed desktop release separately. Existing downloaded installers are not upgraded merely by changing this branch.

Production MongoDB exposure/authentication, host/container vulnerabilities, and
physical multi-device/NAT WebRTC calls were not comprehensively validated here.
The login limiter is per-process and groups clients behind the same untrusted
proxy address; it is not a distributed identity-aware rate limiter. The web CSP
is a baseline, not a strict nonce-based script policy. Internal diagnostics and
third-party delivery logs still require operational access controls.

The Korean copy and visual design received a manual review, not an automated
AI-generated-content score. Brand-name availability/trademark clearance was not
part of this review.
