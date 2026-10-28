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

## Control KMS 전용 환경 관리

`env-management.mjs`와 `env-ssh-entrypoint.sh`는 새 전용 forced SSH 키를 위한 도구다.
기존 `slacord-ci` 키·`ssh-entrypoint.sh`의 check/prepare/deploy 권한은 보존한다.
운영 도구 설치, 키 provision, Control runtime 연결과 target 등록은 infra 담당자와 배포 순서를 합의한 후 진행한다.
이 소스 변경만으로 운영 연결이나 설치는 이루어지지 않는다.

관리 범위는 `/app/slacord-deploy/private/server.env`의 `MINIO_ACCESS_KEY`,
`MINIO_SECRET_KEY`, `MINIO_ENDPOINT`, `MINIO_BUCKET` 네 키이며 네 키 모두 필요하다.
HTTP(S) storage endpoint와 bucket 이름을 검증한다. `public.env`의 `GADOC_PUBLIC_ORIGIN`은 별도 설정이다.
DB URI·JWT·전체 PM2 환경과 임의 실행 환경 키는 외부 프로토콜로 읽거나 쓰지 않는다.

전용 wrapper를 `/usr/local/sbin/gadoc-kms-env`에 설치하고 새 키에만
`restrict,command="/usr/local/sbin/gadoc-kms-env"`를 지정한다. 실제 서버의
`/usr/local/bin/node`, `/usr/bin/flock`, `/usr/bin/timeout`, `/usr/local/bin/pm2`와 `/root/.pm2`를 사용한다.
이 경로는 infra 담당자가 현재 운영 컨테이너에서 확인했다. 재설치 시에도 같은 경로인지 확인해야 한다.
wrapper는 Node 시작 전에 환경을 비워 실행 환경 주입을 막는다. root 소유 tools 디렉터리에는
검토된 `env-management.mjs`와 `deploy-ubuntu.mjs`를 함께 설치한다.
state와 private 디렉터리는 소유자만 변경할 수 있어야 하며 환경·manifest·상태·rollback 파일과
공유 `deploy.lock`은 0600의 일반 파일이어야 한다. symlink 및 hardlink 환경 파일은 거절한다.

허용 명령은 `env-v1 read`, `env-v1 write <expectedSHA> <desiredSHA>`,
`env-v1 apply <v4-UUID> <exactSHA>`, `env-v1 status <v4-UUID>`다.
write 본문은 stdin으로만 전송한다. 서버 파일과 stdin은 256KiB로 제한한다.
응답은 `protocol: "env-v1"`, `ok`를 가진 JSON 한 개이며 오류는 고정 코드만 포함한다.
read는 환경 본문을 반환하므로 Control의 비밀 조회 내부 API에서만 사용하고 터미널·CI 로그에 출력하지 않는다.

Control은 원본을 암호화해 DB에 저장한 후 write를 호출한다. 백업 실패 시 write를 호출하지 않는다.
write와 apply worker는 기존 CI의 영구 `deploy.lock`으로 직렬화되고 충돌 시 즉시 실패한다.
apply는 current release와 성공 manifest, 실제 PM2 실행 경로 및 환경 SHA를 확인한 뒤
같은 소스를 기존 `activateRelease`로 재적용한다. 소스를 가져오거나 새로 빌드하지 않는다.
health 실패 시 기존 두 PM2 정의를 복원한다. 원하는 server.env는 남겨 명시적 재시도/암호화 백업 복원을 지원한다.

`env-requests/<UUID>.json`에 queued/running/succeeded/failed 상태와 환경 SHA·소스 revision·시각을
0600으로 남긴다. 적용은 SSH 세션과 분리되어 lock을 유지하며, worker는 최대 14분 후 종료된다.
15분 넘게 끝나지 않은 상태는 interrupted 실패로 조회한다. 같은 UUID/버전은 기존 상태를 반환하며 재실행하지 않는다.
UUID를 다른 버전에 재사용하면 충돌한다. 파일 SHA와 적용 성공 상태는 별도로 확인한다.

로컬 검증은 비밀이 없는 fixture와 실제 flock을 사용한다.

```bash
node --test scripts/test/env-management.test.mjs scripts/test/deploy-ubuntu.test.mjs
```
