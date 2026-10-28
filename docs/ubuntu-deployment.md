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
health 실패 시 기존 두 PM2 정의와 같은 release의 부팅용 `ecosystem.config.json` 원본 바이트를 복원한다.
원하는 server.env는 남겨 명시적 재시도/암호화 백업 복원을 지원한다.

apply 전 부팅용 파일은 소유자·0600·일반 파일·nlink=1·O_NOFOLLOW·256KiB 상한으로 검증한다.
원본은 고정 `private/env-apply-original.json`에 fsync와 디렉터리 fsync로 저장하고,
`env-apply-pending.json`을 같은 방식으로 영속화한 뒤에만 activation을 시작한다.
journal 계약은 `schema: "env-apply-v1"`, v4 `requestId`, 정확한 desired `version` SHA,
40자리 `revision`, 원본 부팅 파일의 `originalSHA`다. 입력 파일 경로는 포함하지 않는다.
정상 apply는 health·PM2 save 이후 desired 부팅 파일을 유지한다. 실패 시 원본 파일의 정확한 복원과
원래 PM2 정의·환경·health·save 확인이 모두 끝난 뒤에만 journal을 지운다.
종료 상태는 journal에 준비한 뒤 UUID 상태 파일로 원자 이동하여, 상태 공개와 기동 장벽 해제를 함께 확정한다.
이전 단계의 강제 종료에는 성공 상태를 공개하지 않는다. commit의 디렉터리 fsync 실패 시 journal을 되돌리고 복구를 요구한다.
복원/rollback 검증 실패나 SIGKILL·timeout·전원 중단으로 journal이 남으면 수동 복구가 필요하다.
남은 journal 또는 원본 snapshot은 다음 write/apply 및 CI prepare/deploy를 거절한다. read/status는 유지한다.

이 안전장치는 Control의 **새 guarded entrypoint와 함께** 설치해야 한다.
Control guard는 미완료 journal의 존재·깨진 symlink·잘못된 형태·검사 오류를 보수적으로 처리해
PM2 자동 기동만 보류하고 MongoDB·SSH는 유지한다. `/run/gadoc-env-apply-blocked`로 unhealthy를 표시한다.
기존 배포 handler와 새 KMS wrapper 두 forced command만 root key whitelist에서 허용한다.
기존 이미지/entrypoint에는 이 guard가 없으므로 도구만 먼저 설치하면 crash 안전성이 성립하지 않는다.

수동 복구는 infra 담당자의 기존 관리 경로에서만 수행하며, forced key에 셸 권한을 추가하지 않는다.
배포 잠금을 유지한 채 journal schema/UUID/두 SHA/revision과 현재 canonical release를 확인하고,
고정 private snapshot의 소유자·0600·일반 파일·nlink·크기·`originalSHA` 일치를 검증한다.
journal 안의 임의 경로나 다른 파일을 복원에 사용하지 않는다. snapshot이 불량하면 복구를 중단한다.
검증한 원본을 부팅 파일에 원자 복원하고 파일/디렉터리 fsync, 두 원래 PM2 정의·health·save를 확인한다.
해당 UUID 상태를 실패로 기록한 뒤 journal·snapshot을 제거하고 디렉터리를 fsync한다.
앱 기동 확인 후 blocked 신호를 해제한다. 비밀값을 로그에 출력하지 않으며 desired server.env는 별도로 판단한다.
자동 또는 원격 경로 지정 복구 명령은 제공하지 않는다. 운영 복구·설치는 현재 실행하지 않았다.

`env-requests/<UUID>.json`에 queued/running/succeeded/failed 상태와 환경 SHA·소스 revision·시각을
0600으로 남긴다. 적용은 SSH 세션과 분리되어 lock을 유지하며, worker는 최대 14분 후 종료된다.
15분 넘게 끝나지 않은 상태는 interrupted 실패로 조회한다. 같은 UUID/버전은 기존 상태를 반환하며 재실행하지 않는다.
UUID를 다른 버전에 재사용하면 충돌한다. 파일 SHA와 적용 성공 상태는 별도로 확인한다.

로컬 검증은 비밀이 없는 fixture와 실제 flock을 사용한다.

```bash
node --test scripts/test/env-management.test.mjs scripts/test/deploy-ubuntu.test.mjs
```
