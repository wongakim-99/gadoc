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

This deploys application code only. It does not create/migrate databases, rebuild
the runtime image, recreate the container, or change Nginx. Docker container
restart uses the saved PM2 configuration. Recreating the container from its old
image loses application releases and SSH setup: rerun setup and deploy from main
after such an infrastructure change. The existing MongoDB volume is independent.

CI uses disposable MongoDB and MinIO on the GitHub runner; production data and
storage are never used for automated browser fixtures.
