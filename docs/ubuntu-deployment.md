# Ubuntu Deployment

Production is `https://slacord.cloud`, served by the existing `ubuntu-slacord`
container. Nginx forwards the web app to port 3002 and the API/Socket.IO to 8082.
MongoDB remains on the existing local port and volume. Deployment preserves the
running application's MongoDB, JWT, and MinIO configuration.

## Automatic Deployment

1. Merge application changes into `main`.
2. The `ci` workflow runs server, web, desktop, and browser checks.
3. `deploy-ubuntu` runs only after successful push CI on the current `main` SHA.
4. A checksum-verified source archive is sent over pinned SSH to `ubuntu-slacord`.
5. Dependencies and web/API artifacts build in a separate release directory on
   the Ubuntu ARM64 target. The active application continues running during build.
6. Both PM2 processes switch to the release. Local/public health, login HTML,
   and the served frontend revision are checked before `pm2 save`.
7. Failed activation restores the previous PM2 commands and environment.

PRs, failed CI, and superseded revisions do not deploy. A failed deployment is
reported as a failed GitHub Actions run. Deployments are serialized in Actions
and by a remote `flock`; in-progress deployment jobs are not cancelled by pushes.

## Initial Setup

From the Mac host that manages the existing Docker container:

```bash
node scripts/deploy/setup-ubuntu.mjs
```

This installs the deployment handler, creates a dedicated SSH key restricted to
`check`, `prepare`, and `deploy`, pins the container's existing SSH host key, and
sets these GitHub Actions secrets in the `production` environment:

- `SLACORD_SSH_HOST`
- `SLACORD_SSH_PORT`
- `SLACORD_SSH_USER`
- `SLACORD_SSH_PRIVATE_KEY`
- `SLACORD_SSH_KNOWN_HOSTS`

The private key stays in the host's `~/.ssh/slacord-actions-deploy` and GitHub
Secrets. The setup command checks readiness without restarting services.
Repository administrators can run it again after changing the remote handler.

Setup installs the exact pnpm version from `packageManager`. Every release uses
`pnpm install --frozen-lockfile --prod=false`; the source archive must include
both `pnpm-lock.yaml` and `pnpm-workspace.yaml`. No Yarn runtime is used.

Dedicated storage credentials can be staged in
`/app/slacord-deploy/private/server.env` (directory 0700, file 0600).
Only `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_ENDPOINT`, and `MINIO_BUCKET`
are accepted. Overrides apply only to the new backend, not the frontend, and
do not replace the existing MongoDB or JWT settings. Never commit this file.

Before making `slacord` private, deploy the authenticated `/api/files` reader
and verify existing inline references. The first startup snapshots legacy
document references into `legacy_file_bindings` in the existing database;
objects are not moved and a separate database is not created. The application
cannot modify bucket policies. Blog and other tenant policies are out of scope.

On the existing MinIO host, use the scoped provisioning helper in this order:

```bash
node scripts/deploy/provision-gadoc-storage.mjs prepare
node scripts/deploy/provision-gadoc-storage.mjs install
# Deploy main, then verify authorized upload/read and existing inline attachments.
node scripts/deploy/provision-gadoc-storage.mjs privatize <verified-main-sha>
```

`prepare` creates `gadoc-app` with only object Get/Put for `slacord/chat/*`
and `slacord/docs/*` in the `slacord` bucket. Its generated secret stays in
`~/.config/gadoc/minio-server.env` (0600). Existing accounts without that local
file are not silently rotated. `install` stages credentials without restarting
PM2. `privatize` requires the exact live release and an authenticated file reader;
it changes only the `slacord` anonymous policy. It does not itself prove that an
authorized user can read files: complete that check before running it.

Do not roll back to code that automatically makes the bucket public after this
transition. A safe rollback must preserve the authenticated reader and dedicated
account. Anonymous shared links intentionally stop working; orphaned legacy
inline files fail closed until their ownership is resolved explicitly.

For a pipeline-only bootstrap commit, set the `production` environment variable
`SLACORD_PREPARE_ONLY_SHA` to that commit before pushing it. That one SHA builds
but does not activate. Later main commits deploy normally, without another toggle.

```bash
gh variable set SLACORD_PREPARE_ONLY_SHA --repo kscold/slacord \
  --env production --body "$(git rev-parse HEAD)"
```

## Checks And Recovery

Use **Actions > deploy-ubuntu > Run workflow** on `main`:

- `check`: SSH, runtime settings, and local/public health only.
- `prepare`: build the CI-verified main revision without restarting applications.
- `deploy`: retry deployment of the current main revision after successful CI.

Runtime files live under `/app/slacord-deploy`: `current` identifies the last
successful release, `last-success.json` records its SHA, and
`rollback.config.json` retains the previous PM2 configuration. These files can
contain credentials and must stay private. Old release directories can be
removed after confirming neither the current nor rollback PM2 configuration
references them.

This deploys application code and runs its startup migrations inside the existing
database. It does not provision a separate database, rebuild the runtime image,
recreate the container, or change Nginx. Docker container
restart uses the saved PM2 configuration. Recreating the container from its old
image loses application releases and SSH setup: rerun setup and deploy from main
after such an infrastructure change. The existing MongoDB volume is independent.

CI uses disposable MongoDB and MinIO on the GitHub runner; production data and
storage are never used for automated browser fixtures.
