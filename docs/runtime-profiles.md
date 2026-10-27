# Runtime Profiles

GaDoc can run against the current-code local web/server pair while reusing
container-forwarded infrastructure like MongoDB and MinIO.

## Included Profiles

### `isolated-test` / `isolated-discord-mock`

`pnpm verify:full` defaults to these profiles. Start disposable MongoDB on
`127.0.0.1:27127` and MinIO on `127.0.0.1:19000` first. The verification database
and bucket are both `gadoc_verify` / `gadoc-verify`; credentials in this profile
are test-only, never production credentials. Bind both services to loopback.
The runtime uses web 3202, API 18094, and Discord mock API 18095. It starts and
stops its own app processes; it does not start or reset shared infrastructure.

Bridge and Confluence mock origins are fixed to loopback ports 19447/19448 and
are accepted only with `NODE_ENV=test`. Production cannot enable these exceptions.
Shared-data verification requires explicit `SLACORD_VERIFY_ALLOW_SHARED_DATA=1`.
Do not use that opt-in against production just to bypass a missing local service.

### `local-container`

- Current repo server runs on `127.0.0.1:18084`
- Current repo web runs on `127.0.0.1:3103`
- Forwarded MongoDB is expected on `127.0.0.1:27020`
- MinIO is expected on `http://127.0.0.1:9000`
- Mongo credentials are discovered from a running Docker container whose image
  contains `ubuntu-slacord`, unless a local override file provides them

### `local-container-discord-mock`

- Extends `local-container`
- Starts the server on `127.0.0.1:18085`
- Injects the Discord fetch mock automatically
- Used by `discord-import-mock-check.mjs`

## Local Override

Create `config/profiles/local-container.local.env` if Docker credential discovery
is unavailable or you want to pin credentials explicitly.

```env
SLACORD_MONGO_USERNAME=slacord
SLACORD_MONGO_PASSWORD=change-me
```

All `*.local.env` profile files are gitignored.

## Useful Commands

```bash
pnpm profile:print
pnpm dev:stack:profile
pnpm build:server
pnpm build:web:profile
pnpm start:stack:profile
pnpm verify:full
```

## What `verify:full` Runs

- `pnpm test:document-core`
- Playwright Chromium install check
- deployment rollback, backend-only credentials, and MinIO account policy checks
- `pnpm test:server`
- `pnpm build:server`
- legacy inline-file permission migration against a temporary test database
- `pnpm test:web`
- `pnpm build:web:profile`
- `pnpm test:desktop`
- `pnpm build:desktop`
- current-code server startup on the runtime profile
- current-code web startup on the runtime profile
- `pnpm test:e2e:web`
- `scripts/live-surface-check.mjs`
- mock server startup on the Discord mock profile
- `scripts/discord-import-mock-check.mjs`
