# GaDoc Security Review: 2026-10-27

## Scope And Release Status

Reviewed the application source, dependency graph, file-storage boundary,
authentication, integration requests, and deployment configuration. Tests use
synthetic data and disposable local MongoDB/MinIO, not production workspaces.
This is a targeted code review and regression suite, not a complete penetration
test or a claim that every possible vulnerability has been eliminated.

The original file-permission and pnpm security changes have been deployed.
The infrastructure owner recovered Docker/Colima at 16:18 KST without replacing
data volumes. The MinIO owner subsequently migrated and verified all 189 source
objects to the private `gadoc` bucket, then deleted the old `slacord` bucket.
The running backend uses the dedicated `gadoc-app` account. A compatibility
policy temporarily permits old-prefix writes until the new upload-prefix code
is deployed; tightening those old prefixes to read-only remains a release gate.
MCP, document collaboration, cross-client notification claims and GaDoc 1.1.0
installers are the next release candidate, not yet a claimed production release.

Blog public access remains public, blog private documents remain private, and
Pawpong is outside this change. No production MongoDB is split off or replaced.

## Findings And Remediation

Priorities below describe this review's assessment, not formal CVSS ratings.

| Priority | Finding                                                                                                                         | Implemented remediation                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | Attachment URLs bypassed application permissions through a public bucket; upload initialization could restore public policy.    | Authenticated `/api/files` checks team, channel/DM, or document access on every read. Removed policy writes from the app. Production anonymous policy removal has been verified.            |
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
- Latest local server: 47 suites, 172 passing tests. Web: 28 suites, 105 passing tests.
- Document core: 17 passing tests. Desktop: 10 suites, 33 passing tests, including a real local Electron launch smoke test and packaging-version regression.
- Browser E2E: 77 passing tests, including two-user collaborative/offline merge, private attachments, database views/relations/rollups, real MCP clients, notification claim races and mobile/desktop navigation.
- Live surface: 78 passing checks, no failures/skips; Discord import mock passed.
- Actual isolated MongoDB migration test covers historical references, restarts, copied links, permission revocation, and deleted originals. Its temporary database is removed afterward.
- Dedicated account against the existing MinIO: allowed-prefix Put/Head/Range Get succeeded; ListBuckets, ListObjects, out-of-prefix Put, DeleteObject, and PutBucketPolicy returned AccessDenied. Only a synthetic verification object was created and then removed by an administrator.
- Gitleaks history scan covered 206 existing commits with no findings. Generated browser traces/build outputs contain synthetic test tokens and are excluded from version control; production credentials stay outside the repository.

## Remaining Gates

1. Confirm recovered runtime health and at least 15 GiB free on the Mac host before builds; remove only owned regenerable caches, never data volumes.
2. Run Actions for the new candidate and confirm the served SHA after main deployment.
3. Verify new `gadoc/` prefix uploads and old links in production, then tighten
   legacy `slacord/` object keys to read-only. Remove only recorded synthetic fixtures.
4. Publish all new unsigned desktop assets with explicit SmartScreen/Gatekeeper
   warnings and SHA256 checksums, as approved by the user. Existing downloaded
   installers are not replaced merely by changing this branch.

Production MongoDB exposure/authentication, host/container vulnerabilities, and
physical multi-device/NAT WebRTC calls were not comprehensively validated here.
The login limiter is per-process and groups clients behind the same untrusted
proxy address; it is not a distributed identity-aware rate limiter. The web CSP
is a baseline, not a strict nonce-based script policy. Internal diagnostics and
third-party delivery logs still require operational access controls.

The Korean copy and visual design received a manual review, not an automated
AI-generated-content score. Brand-name availability/trademark clearance was not
part of this review.

## AI And Collaboration Boundaries

MCP keys are scoped to one user/team, stored as SHA256 digests, expire, can be
revoked and are checked against current membership and document permissions.
Tool audits exclude content and credentials. Streamable HTTP uses Bearer headers;
OAuth is not implemented. Files use the same authenticated MinIO path.

Document Yjs updates and canonical JSON share one MongoDB document and use
compare-and-swap writes. REST/MCP body replacement requires the latest timestamp
after collaboration is initialized. Join, update, presence and each outbound
recipient recheck authorization. Presence names come from authenticated users,
not arbitrary client labels. Private document data is not published to team-wide
rooms. Pending offline edits are memory-only, not a durable offline store.

Notification delivery claims use opaque per-user keys with unique MongoDB IDs
and TTL cleanup. Claims affect OS alerts only, not inbox records or unread state.
