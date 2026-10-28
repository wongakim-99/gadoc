import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  activateRelease,
  readServerOverrides,
} from "../deploy/deploy-ubuntu.mjs";
import {
  checksum,
  environmentManager,
  lockedWorker,
  MANAGED_KEYS,
  MAX_ENV_BYTES,
  parseCommand,
  readInput,
  validateOverrides,
} from "../deploy/env-management.mjs";

const original =
  "MINIO_ACCESS_KEY=synthetic-access\nMINIO_SECRET_KEY=synthetic-old\nMINIO_ENDPOINT=http://127.0.0.1:9000\nMINIO_BUCKET=gadoc-test\n";
const desired = original.replace("synthetic-old", "synthetic-new");
const requestId = "11111111-1111-4111-8111-111111111111";

function fixture(t, dependencies = {}) {
  const state = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "gadoc-env-test-")),
  );
  fs.chmodSync(state, 0o700);
  t.after(() => fs.rmSync(state, { recursive: true, force: true }));
  fs.mkdirSync(path.join(state, "private"), { mode: 0o700 });
  const file = path.join(state, "private/server.env");
  fs.writeFileSync(file, original, { mode: 0o600 });
  const release = path.join(state, "releases", "current-release");
  fs.mkdirSync(release, { recursive: true });
  fs.symlinkSync(release, path.join(state, "current"));
  const revision = "a".repeat(40);
  fs.writeFileSync(
    path.join(state, "last-success.json"),
    JSON.stringify({ release, revision }),
    { mode: 0o600 },
  );
  const apps = ["slacord-backend", "slacord-frontend"].map((name, index) => ({
    name,
    pm2_env: {
      pm_cwd: path.join(release, index ? "packages/web" : "packages/server"),
      pm_exec_path: path.join(
        release,
        index
          ? "node_modules/next/dist/bin/next"
          : "packages/server/dist/main.js",
      ),
      env: {
        MONGODB_URI: "mongodb://synthetic:27017/test",
        JWT_SECRET: "synthetic-jwt",
        ...validateOverrides(original),
      },
    },
  }));
  const manager = environmentManager(state, {
    readApps: () => apps,
    readOrigin: () => "https://example.test",
    ...dependencies,
  });
  return { state, file, release, revision, apps, manager };
}

test("env-v1 accepts only exact verbs, SHA-256 and v4 UUID; no paths or shell input", () => {
  assert.deepEqual(parseCommand("env-v1 read"), { action: "read" });
  assert.equal(
    parseCommand(`env-v1 write ${checksum(original)} ${checksum(desired)}`)
      .action,
    "write",
  );
  assert.equal(
    parseCommand(`env-v1 apply ${requestId} ${checksum(desired)}`).action,
    "apply",
  );
  assert.equal(parseCommand(`env-v1 status ${requestId}`).requestId, requestId);
  for (const command of [
    "bash",
    "env-v1 read /etc/passwd",
    "env-v1 read; id",
    "env-v1 read\nid",
    "env-v1 read\n",
    "env-v1  read",
    "env-v2 read",
    "env-v1 status ../../x",
    `env-v1 apply ${requestId} 1`,
    `env-v1 apply ${requestId} ${"a".repeat(64)} extra`,
    `env-v1 write main ${checksum(desired)}`,
    "env-v1 --locked",
    "env-v1 status ABCDEF01-1111-4111-8111-111111111111",
  ])
    assert.throws(() => parseCommand(command), /invalid_command/, command);
});

test("forced CLI rejects arbitrary commands without emitting input or stack traces", () => {
  const script = fileURLToPath(
    new URL("../deploy/env-management.mjs", import.meta.url),
  );
  for (const command of [
    "id",
    "env-v1 read; echo synthetic-secret",
    "env-v1 --locked",
  ]) {
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: { ...process.env, SSH_ORIGINAL_COMMAND: command },
    });
    assert.deepEqual(JSON.parse(result.stdout), {
      protocol: "env-v1",
      ok: false,
      code: "invalid_command",
    });
    assert.equal(result.stderr, "");
    assert.ok(!result.stdout.includes("synthetic-secret"));
  }
});

test("only the four typed storage overrides are accepted; executable/runtime/public/DB keys are rejected", () => {
  assert.deepEqual(
    Object.keys(validateOverrides(original)).sort(),
    [...MANAGED_KEYS].sort(),
  );
  for (const extra of [
    "NODE_OPTIONS=--require=/tmp/a",
    "LD_PRELOAD=/tmp/a",
    "PATH=/tmp",
    "MONGODB_URI=mongodb://test",
    "GADOC_PUBLIC_ORIGIN=https://example.test",
  ])
    assert.throws(
      () => validateOverrides(`${original}${extra}\n`),
      /unsupported/,
    );
  for (const payload of [
    original.replace("http://127.0.0.1:9000", "file:///tmp/a"),
    original.replace(
      "http://127.0.0.1:9000",
      "http://user:password@example.test",
    ),
    original.replace("http://127.0.0.1:9000", "https://example.test/path"),
    original.replace("gadoc-test", "../bucket"),
    original.replace("synthetic-old", ""),
    `${original}MINIO_SECRET_KEY=duplicate\n`,
    original.replace("synthetic-old", '"line\\nnext"'),
    original.replace("synthetic-old", "`shell`"),
    original.replace("synthetic-old", "line\0next"),
    original.replace("MINIO_ACCESS_KEY=synthetic-access\n", ""),
  ])
    assert.throws(() => validateOverrides(payload));
});

test("read returns only the fixed server override file with a content hash", (t) => {
  const { manager } = fixture(t);
  const current = manager.read();
  assert.equal(current.version, checksum(original));
  assert.equal(current.payload, original);
  assert.ok(Number.isFinite(Date.parse(current.createdAt)));
  assert.ok(!current.payload.includes("MONGODB_URI"));
});

test("write enforces expected and desired SHA and keeps a private atomic file", (t) => {
  const { manager, file } = fixture(t);
  assert.throws(
    () => manager.write("b".repeat(64), checksum(desired), desired),
    /version_conflict/,
  );
  assert.throws(
    () => manager.write(checksum(original), "b".repeat(64), desired),
    /checksum_mismatch/,
  );
  assert.equal(fs.readFileSync(file, "utf8"), original);
  const result = manager.write(checksum(original), checksum(desired), desired);
  assert.equal(result.version, checksum(desired));
  assert.equal(fs.readFileSync(file, "utf8"), desired);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.throws(
    () => manager.write(checksum(original), checksum(desired), desired),
    /version_conflict/,
  );
});

test("unsafe file permissions, hardlinks and symlinks fail before any replacement", (t) => {
  const { manager, state, file } = fixture(t);
  fs.chmodSync(file, 0o644);
  assert.throws(() => manager.read(), /unsafe_permissions/);
  assert.throws(() =>
    manager.write(checksum(original), checksum(desired), desired),
  );
  fs.chmodSync(file, 0o600);
  const outside = path.join(state, "outside");
  fs.linkSync(file, outside);
  assert.throws(() => manager.read(), /unsafe_permissions/);
  fs.unlinkSync(file);
  fs.symlinkSync(outside, file);
  assert.throws(() => manager.read());
  assert.throws(() => readServerOverrides(state));
  assert.equal(fs.readFileSync(outside, "utf8"), original);
});

test("unsafe parent directory is rejected even if the env file is private", (t) => {
  const { manager, state } = fixture(t);
  fs.chmodSync(path.join(state, "private"), 0o777);
  assert.throws(() => manager.read(), /unsafe_permissions/);
});

test("stdin and existing files have a 256KiB limit and reject invalid UTF-8", async (t) => {
  await assert.rejects(
    readInput(Readable.from([Buffer.alloc(MAX_ENV_BYTES + 1)])),
    /input_too_large/,
  );
  await assert.rejects(
    readInput(Readable.from([Buffer.from([0xff])])),
    /invalid_environment/,
  );
  assert.equal(await readInput(Readable.from([original])), original);
  const { manager, file } = fixture(t);
  fs.writeFileSync(file, Buffer.alloc(MAX_ENV_BYTES + 1));
  assert.throws(() => manager.read());
});

test("apply refuses a stale environment version before activating PM2", async (t) => {
  let activations = 0;
  const { manager } = fixture(t, {
    activate: async () => {
      activations++;
    },
  });
  await assert.rejects(
    manager.apply(requestId, checksum(desired)),
    /version_conflict/,
  );
  assert.equal(activations, 0);
  assert.equal(manager.status(requestId), null);
});

test("apply reuses the current source and UUID status; duplicates never restart again", async (t) => {
  const calls = [];
  const { manager, release, revision, state } = fixture(t, {
    activate: async (input) => calls.push(input),
  });
  const acknowledgements = [];
  const first = await manager.apply(requestId, checksum(original), (record) =>
    acknowledgements.push(record),
  );
  const second = await manager.apply(requestId, checksum(original));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].release, release);
  assert.equal(calls[0].revision, revision);
  assert.equal(acknowledgements[0].state, "queued");
  assert.equal(first.state, "succeeded");
  assert.deepEqual(second, first);
  assert.deepEqual(manager.status(requestId), first);
  await assert.rejects(
    manager.apply(requestId, checksum(desired)),
    /request_conflict/,
  );
  const saved = fs.readFileSync(
    path.join(state, "env-requests", `${requestId}.json`),
    "utf8",
  );
  assert.ok(!saved.includes("synthetic"));
  assert.equal(
    fs.statSync(path.join(state, "env-requests", `${requestId}.json`)).mode &
      0o777,
    0o600,
  );
});

test("source manifest and actual PM2 paths must match the current release", async (t) => {
  const { manager, state, apps } = fixture(t, {
    activate: async () => assert.fail("must not activate"),
  });
  apps[0].pm2_env.pm_exec_path = "/different/server.js";
  await assert.rejects(
    manager.apply(requestId, checksum(original)),
    /invalid_release/,
  );
  fs.chmodSync(path.join(state, "last-success.json"), 0o644);
  await assert.rejects(
    manager.apply(requestId, checksum(original)),
    /unsafe_permissions/,
  );
});

test("real activation applies storage only to backend and verifies the unchanged source", async (t) => {
  const events = [];
  const { manager, file, revision, release } = fixture(t, {
    activate: (input) =>
      activateRelease(input, {
        preparePaths: () => {},
        replace: (config) => events.push(JSON.parse(fs.readFileSync(config))),
        verify: async (_origin, sha, directory) => {
          assert.equal(sha, revision);
          assert.equal(directory, release);
        },
        run: () => {},
      }),
  });
  manager.write(checksum(original), checksum(desired), desired);
  const result = await manager.apply(requestId, checksum(desired));
  assert.equal(result.state, "succeeded");
  assert.equal(events[0].apps[0].env.MINIO_SECRET_KEY, "synthetic-new");
  assert.equal(events[0].apps[1].env.MINIO_SECRET_KEY, undefined);
  assert.equal(fs.readFileSync(file, "utf8"), desired);
});

test("failed health restores both PM2 definitions and records a failed application", async (t) => {
  const configs = [];
  const { manager, state, release, apps } = fixture(t, {
    activate: (input) =>
      activateRelease(input, {
        preparePaths: () => {},
        replace: (file) => configs.push(JSON.parse(fs.readFileSync(file))),
        verify: async (_origin, sha) => {
          if (sha) throw new Error("synthetic-health-failure");
        },
        run: () => {},
      }),
  });
  manager.write(checksum(original), checksum(desired), desired);
  const result = await manager.apply(requestId, checksum(desired));
  assert.equal(result.state, "failed");
  assert.equal(result.conclusion, "activation_failed");
  assert.equal(configs.length, 2);
  assert.deepEqual(
    configs[1].apps.map((app) => app.env),
    apps.map((app) => app.pm2_env.env),
  );
  assert.equal(fs.realpathSync(path.join(state, "current")), release);
  assert.equal(manager.status(requestId).state, "failed");
});

test("rollback snapshot failure stops before restarting PM2 or overwriting an unsafe backup", async (t) => {
  let restarts = 0;
  const { state, manager } = fixture(t, {
    activate: (input) =>
      activateRelease(input, {
        preparePaths: () => {},
        replace: () => {
          restarts++;
        },
      }),
  });
  const rollback = path.join(state, "rollback.config.json");
  fs.writeFileSync(rollback, "synthetic-original", { mode: 0o644 });
  assert.equal(
    (await manager.apply(requestId, checksum(original))).state,
    "failed",
  );
  assert.equal(restarts, 0);
  assert.equal(fs.readFileSync(rollback, "utf8"), "synthetic-original");
});

test("CI's deployment lock blocks env writes and apply workers", async (t) => {
  const { state, file } = fixture(t);
  const flock =
    process.platform === "darwin"
      ? "/opt/homebrew/bin/flock"
      : "/usr/bin/flock";
  const holder = spawn(
    flock,
    [
      "-n",
      path.join(state, "deploy.lock"),
      process.execPath,
      "-e",
      'process.stdout.write("ready\\n"); setInterval(() => {}, 1000)',
    ],
    {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  t.after(() => {
    try {
      process.kill(-holder.pid, "SIGKILL");
    } catch {}
  });
  await new Promise((resolve, reject) => {
    holder.once("error", reject);
    holder.stdout.once("data", resolve);
    holder.once("exit", () => reject(new Error("lock holder exited")));
  });
  // The CI entrypoint creates the same permanent lock with umask 077.
  fs.chmodSync(path.join(state, "deploy.lock"), 0o600);
  for (const command of [
    `env-v1 write ${checksum(original)} ${checksum(desired)}`,
    `env-v1 apply ${requestId} ${checksum(original)}`,
  ]) {
    const result = await lockedWorker(state, command, desired, false, {
      flock,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "deployment_busy");
  }
  assert.equal(fs.readFileSync(file, "utf8"), original);
});

test("detached apply survives its SSH launcher exit and owns the shared lock until finished", async (t) => {
  const { state, apps, manager } = fixture(t);
  const moduleUrl = new URL("../deploy/env-management.mjs", import.meta.url)
    .href;
  const flock =
    process.platform === "darwin"
      ? "/opt/homebrew/bin/flock"
      : "/usr/bin/flock";
  const gate = path.join(state, "finish-activation");
  const count = path.join(state, "activations");
  const worker = `
    import fs from 'node:fs';
    import { environmentManager } from ${JSON.stringify(moduleUrl)};
    const manager = environmentManager(${JSON.stringify(state)}, {
      readApps: () => ${JSON.stringify(apps)},
      readOrigin: () => 'https://example.test',
      activate: async () => {
        fs.appendFileSync(${JSON.stringify(count)}, 'activated\\n');
        const deadline = Date.now() + 5000;
        while (!fs.existsSync(${JSON.stringify(gate)})) {
          if (Date.now() > deadline) throw new Error('test timeout');
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      },
    });
    await manager.apply(${JSON.stringify(requestId)}, ${JSON.stringify(checksum(original))}, record => {
      fs.writeSync(3, JSON.stringify({protocol:'env-v1', ok:true, record}) + '\\n');
      fs.closeSync(3);
    });
  `;
  const options = {
    flock,
    runner: [process.execPath, "--input-type=module", "-e", worker],
  };
  const launcherSource = `
    import { lockedWorker } from ${JSON.stringify(moduleUrl)};
    const result = await lockedWorker(${JSON.stringify(state)}, 'env-v1 apply', undefined, true, ${JSON.stringify(options)});
    process.stdout.write(JSON.stringify(result) + '\\n');
  `;
  // This process exits naturally after ack, like the short-lived forced SSH command.
  const launcher = spawn(
    process.execPath,
    ["--input-type=module", "-e", launcherSource],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(() => {
    if (fs.existsSync(state)) fs.writeFileSync(gate, "finish");
  });
  let output = "";
  launcher.stdout.on("data", (chunk) => {
    output += chunk;
  });
  await new Promise((resolve, reject) => {
    launcher.once("error", reject);
    launcher.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`launcher exit ${code}`)),
    );
  });
  assert.equal(JSON.parse(output).record.state, "queued");
  const runningDeadline = Date.now() + 5000;
  while (manager.status(requestId).state === "queued") {
    assert.ok(
      Date.now() < runningDeadline,
      "detached worker reaches activation",
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(manager.status(requestId).state, "running");
  assert.equal(
    (await lockedWorker(state, "env-v1 apply", undefined, true, options)).code,
    "deployment_busy",
  );
  fs.writeFileSync(gate, "finish");
  const deadline = Date.now() + 5000;
  while (manager.status(requestId).state === "running") {
    assert.ok(Date.now() < deadline, "detached apply finishes");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(manager.status(requestId).state, "succeeded");
  assert.equal(fs.readFileSync(count, "utf8"), "activated\n");
});
