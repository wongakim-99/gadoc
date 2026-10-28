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
  snapshotApps,
  assertNoPendingEnvironmentApply,
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
  verifyRollbackRuntime,
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
    verifyRollback: async () => {},
    ...dependencies,
  });
  const ecosystem = path.join(release, "ecosystem.config.json");
  const originalEcosystem = `${JSON.stringify({ ...snapshotApps(apps), metadata: { preserve: "original-format-and-fields" } }, null, 4)}\n`;
  fs.writeFileSync(ecosystem, originalEcosystem, { mode: 0o600 });
  return {
    state,
    file,
    release,
    revision,
    apps,
    manager,
    ecosystem,
    originalEcosystem,
  };
}

// A fresh process reads the exact path used by Control's `pm2 start` on boot.
function nextBootStorageKey(state) {
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `
    const fs = require('node:fs');
    const config = JSON.parse(fs.readFileSync(process.argv[1] + '/current/ecosystem.config.json'));
    process.stdout.write(config.apps[0].env.MINIO_SECRET_KEY);
  `,
      state,
    ],
    { encoding: "utf8" },
  );
  assert.equal(
    result.status,
    0,
    "next boot can read the saved PM2 configuration",
  );
  return result.stdout;
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

test("failed same-release apply restores the exact boot configuration for the next restart", async (t) => {
  const { manager, state, ecosystem, originalEcosystem } = fixture(t, {
    activate: (input) =>
      activateRelease(input, {
        preparePaths: () => {},
        replace: () => {},
        run: () => {},
        verify: async (_origin, revision) => {
          if (revision) throw new Error("synthetic-health-failure");
        },
      }),
  });
  manager.write(checksum(original), checksum(desired), desired);
  assert.equal(
    (await manager.apply(requestId, checksum(desired))).state,
    "failed",
  );
  assert.equal(fs.readFileSync(ecosystem, "utf8"), originalEcosystem);
  assert.equal(fs.statSync(ecosystem).mode & 0o777, 0o600);
  assert.equal(nextBootStorageKey(state), "synthetic-old");
  assert.equal(
    manager.read().payload,
    desired,
    "desired override remains available for an explicit retry",
  );
});

test("successful same-release apply retains the desired configuration for the next restart", async (t) => {
  const { manager, state, ecosystem, originalEcosystem } = fixture(t, {
    activate: (input) =>
      activateRelease(input, {
        preparePaths: () => {},
        replace: () => {},
        run: () => {},
        verify: async () => {},
      }),
  });
  manager.write(checksum(original), checksum(desired), desired);
  assert.equal(
    (await manager.apply(requestId, checksum(desired))).state,
    "succeeded",
  );
  assert.notEqual(fs.readFileSync(ecosystem, "utf8"), originalEcosystem);
  assert.equal(fs.statSync(ecosystem).mode & 0o777, 0o600);
  assert.equal(nextBootStorageKey(state), "synthetic-new");
});

test("original boot bytes and a fixed journal are durable and private before activation", async (t) => {
  const { manager, state, revision, originalEcosystem } = fixture(t, {
    activate: async () => {
      const snapshot = path.join(state, "private/env-apply-original.json");
      const journal = path.join(state, "env-apply-pending.json");
      assert.equal(fs.readFileSync(snapshot, "utf8"), originalEcosystem);
      assert.equal(fs.statSync(snapshot).mode & 0o777, 0o600);
      assert.equal(fs.statSync(snapshot).nlink, 1);
      assert.equal(fs.statSync(journal).mode & 0o777, 0o600);
      assert.deepEqual(JSON.parse(fs.readFileSync(journal)), {
        schema: "env-apply-v1",
        requestId,
        version: checksum(original),
        revision,
        originalSHA: checksum(originalEcosystem),
      });
    },
  });
  assert.equal(
    (await manager.apply(requestId, checksum(original))).state,
    "succeeded",
  );
  assert.equal(
    fs.existsSync(path.join(state, "env-apply-pending.json")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(state, "private/env-apply-original.json")),
    false,
  );
});

for (const kind of [
  "mode",
  "symlink",
  "hardlink",
  "oversize",
  "invalid-json",
  "invalid-apps",
]) {
  test(`unsafe original ecosystem ${kind} stops before activation`, async (t) => {
    let activations = 0;
    const { manager, state, ecosystem, originalEcosystem } = fixture(t, {
      activate: async () => {
        activations++;
      },
    });
    if (kind === "mode") fs.chmodSync(ecosystem, 0o644);
    if (kind === "oversize")
      fs.writeFileSync(ecosystem, Buffer.alloc(MAX_ENV_BYTES + 1));
    if (kind === "invalid-json") fs.writeFileSync(ecosystem, "broken JSON");
    if (kind === "invalid-apps") fs.writeFileSync(ecosystem, '{"apps":[]}');
    if (kind === "hardlink" || kind === "symlink") {
      const outside = path.join(state, "other-configuration");
      fs.linkSync(ecosystem, outside);
      if (kind === "symlink") {
        fs.unlinkSync(ecosystem);
        fs.symlinkSync(outside, ecosystem);
      }
    }
    await assert.rejects(manager.apply(requestId, checksum(original)));
    assert.equal(activations, 0);
    assert.equal(
      fs.existsSync(path.join(state, "env-apply-pending.json")),
      false,
    );
    if (!["oversize", "invalid-json", "invalid-apps"].includes(kind))
      assert.equal(fs.readFileSync(ecosystem, "utf8"), originalEcosystem);
  });
}

for (const target of ["snapshot", "journal"]) {
  test(`${target} persistence failure never starts activation or changes the boot file`, async (t) => {
    let activations = 0;
    const { manager, state, ecosystem, originalEcosystem } = fixture(t, {
      activate: async () => {
        activations++;
      },
    });
    const link = fs.linkSync;
    t.mock.method(fs, "linkSync", (source, destination) => {
      if (
        destination.endsWith(
          target === "snapshot"
            ? "/env-apply-original.json"
            : "/env-apply-pending.json",
        )
      )
        throw Object.assign(new Error("synthetic persistence failure"), {
          code: "EIO",
        });
      return link(source, destination);
    });
    await assert.rejects(
      manager.apply(requestId, checksum(original)),
      /synthetic persistence failure/,
    );
    assert.equal(activations, 0);
    assert.equal(fs.readFileSync(ecosystem, "utf8"), originalEcosystem);
    assert.equal(nextBootStorageKey(state), "synthetic-old");
    if (target === "journal") {
      assert.throws(
        () => manager.write(checksum(original), checksum(desired), desired),
        /recovery/,
      );
    }
  });
}

for (const point of ["before-commit", "commit-fsync"]) {
  test(`${point} failure retains the barrier and cannot publish a successful apply`, async (t) => {
    const { manager, state, ecosystem, originalEcosystem } = fixture(t, {
      activate: (input) =>
        activateRelease(input, {
          preparePaths: () => {},
          replace: () => {},
          run: () => {},
          verify: async () => {},
        }),
    });
    manager.write(checksum(original), checksum(desired), desired);
    const journal = path.join(state, "env-apply-pending.json");
    const status = path.join(state, "env-requests", `${requestId}.json`);
    let committing = false,
      syncFailed = false;
    const rename = fs.renameSync,
      sync = fs.fsyncSync;
    t.mock.method(fs, "renameSync", (from, to) => {
      if (from === journal && to === status) {
        assert.equal(
          manager.status(requestId).state,
          "running",
          "terminal success is not visible while the barrier exists",
        );
        if (point === "before-commit")
          throw new Error("synthetic terminal commit failure");
        committing = true;
      }
      return rename(from, to);
    });
    t.mock.method(fs, "fsyncSync", (fd) => {
      if (point === "commit-fsync" && committing && !syncFailed) {
        syncFailed = true;
        throw new Error("synthetic commit fsync failure");
      }
      return sync(fd);
    });
    const result = await manager.apply(requestId, checksum(desired));
    assert.equal(result.state, "failed");
    assert.equal(result.recoveryRequired, true);
    assert.equal(manager.status(requestId).state, "failed");
    assert.equal(fs.existsSync(journal), true);
    assert.equal(fs.readFileSync(ecosystem, "utf8"), originalEcosystem);
    assert.equal(nextBootStorageKey(state), "synthetic-old");
  });
}

test("a stale success record never overrides an unresolved or unreadable recovery journal", async (t) => {
  const { manager, state } = fixture(t, { activate: async () => {} });
  await manager.apply(requestId, checksum(original));
  const journal = path.join(state, "env-apply-pending.json");
  fs.writeFileSync(journal, JSON.stringify({ requestId }), { mode: 0o600 });
  assert.equal(manager.status(requestId).state, "running");
  fs.writeFileSync(journal, "broken journal");
  assert.equal(manager.status(requestId).state, "failed");
  assert.equal(manager.status(requestId).recoveryRequired, true);
});

for (const target of ["snapshot", "journal"]) {
  test(`${target} fsync failure stops before activation and preserves the original boot file`, async (t) => {
    let activations = 0;
    const { manager, ecosystem, originalEcosystem } = fixture(t, {
      activate: async () => {
        activations++;
      },
    });
    const opened = new Map();
    const open = fs.openSync,
      sync = fs.fsyncSync;
    t.mock.method(fs, "openSync", (file, ...args) => {
      const fd = open(file, ...args);
      opened.set(fd, String(file));
      return fd;
    });
    t.mock.method(fs, "fsyncSync", (fd) => {
      if (
        opened
          .get(fd)
          ?.includes(
            target === "snapshot"
              ? "env-apply-original.json"
              : "env-apply-pending.json",
          )
      )
        throw new Error("synthetic fsync failure");
      return sync(fd);
    });
    await assert.rejects(
      manager.apply(requestId, checksum(original)),
      /synthetic fsync failure/,
    );
    assert.equal(activations, 0);
    assert.equal(fs.readFileSync(ecosystem, "utf8"), originalEcosystem);
  });
}

test("restore failure retains the recovery barrier and never reports success", async (t) => {
  const { manager, state, ecosystem, originalEcosystem } = fixture(t, {
    activate: async () => {
      fs.writeFileSync(
        ecosystem,
        originalEcosystem.replaceAll("synthetic-old", "synthetic-new"),
      );
      throw new Error("synthetic activation failure");
    },
  });
  const rename = fs.renameSync;
  t.mock.method(fs, "renameSync", (source, destination) => {
    if (destination === ecosystem) throw new Error("synthetic restore failure");
    return rename(source, destination);
  });
  const result = await manager.apply(requestId, checksum(original));
  assert.equal(result.state, "failed");
  assert.equal(result.recoveryRequired, true);
  assert.equal(fs.existsSync(path.join(state, "env-apply-pending.json")), true);
  assert.equal(
    fs.readFileSync(
      path.join(state, "private/env-apply-original.json"),
      "utf8",
    ),
    originalEcosystem,
  );
  assert.throws(
    () => manager.write(checksum(original), checksum(desired), desired),
    /recovery/,
  );
  await assert.rejects(
    manager.apply("22222222-2222-4222-8222-222222222222", checksum(original)),
    /recovery/,
  );
  assert.equal(manager.read().payload, original);
  assert.equal(manager.status(requestId).state, "failed");
});

test("a failed or unverifiable PM2 rollback keeps the journal even after exact boot restoration", async (t) => {
  const { manager, state, ecosystem, originalEcosystem } = fixture(t, {
    activate: async () => {
      throw new Error("synthetic rollback failure");
    },
    verifyRollback: async () => {
      throw new Error("old runtime not verified");
    },
  });
  const result = await manager.apply(requestId, checksum(original));
  assert.equal(result.state, "failed");
  assert.equal(result.recoveryRequired, true);
  assert.equal(fs.readFileSync(ecosystem, "utf8"), originalEcosystem);
  assert.equal(fs.existsSync(path.join(state, "env-apply-pending.json")), true);
});

test("rollback verification rejects retained desired env and confirms health/save of the original runtime", async (t) => {
  const { apps, release } = fixture(t);
  const changed = structuredClone(apps);
  changed[0].pm2_env.env.MINIO_SECRET_KEY = "synthetic-new";
  let health = 0,
    saves = 0;
  await assert.rejects(
    verifyRollbackRuntime(apps, "https://example.test", release, {
      readApps: () => changed,
      verify: async () => {
        health++;
      },
      save: () => {
        saves++;
      },
    }),
    /rollback_unverified/,
  );
  assert.equal(health + saves, 0);
  const missing = structuredClone(apps),
    literalUndefined = structuredClone(apps);
  delete missing[0].pm2_env.env.MINIO_ENDPOINT;
  literalUndefined[0].pm2_env.env.MINIO_ENDPOINT = "undefined";
  await assert.rejects(
    verifyRollbackRuntime(missing, "https://example.test", release, {
      readApps: () => literalUndefined,
      verify: async () => {},
      save: () => {},
    }),
    /rollback_unverified/,
  );
  await verifyRollbackRuntime(apps, "https://example.test", release, {
    readApps: () => structuredClone(apps),
    verify: async () => {
      health++;
    },
    save: () => {
      saves++;
    },
  });
  assert.equal(health, 1);
  assert.equal(saves, 1);
});

test("rollback verification tolerates regenerated PM2 metadata while preserving effective environment checks", async (t) => {
  const { apps, release } = fixture(t);
  const restored = structuredClone(apps);
  apps[0].pm2_env.env.unique_id = "synthetic-old-process-id";
  restored[0].pm2_env.env.unique_id = "synthetic-new-process-id";
  apps[0].pm2_env.env.PWD = "/previous/process/path";
  restored[0].pm2_env.env.PWD = "/restored/process/path";
  await verifyRollbackRuntime(apps, "https://example.test", release, {
    readApps: () => restored,
    verify: async () => {},
    save: () => {},
  });
  restored[0].pm2_env.env.MINIO_SECRET_KEY = "synthetic-new";
  await assert.rejects(
    verifyRollbackRuntime(apps, "https://example.test", release, {
      readApps: () => restored,
      verify: async () => {},
      save: () => {},
    }),
    /rollback_unverified/,
  );
});

for (const kind of ["regular", "broken-symlink", "directory"]) {
  test(`pending ${kind} blocks mutations and CI prepare/deploy without consuming the snapshot`, async (t) => {
    const { manager, state, ecosystem, originalEcosystem } = fixture(t);
    const pending = path.join(state, "env-apply-pending.json");
    if (kind === "regular")
      fs.writeFileSync(pending, "invalid journal", { mode: 0o600 });
    if (kind === "directory") fs.mkdirSync(pending);
    if (kind === "broken-symlink")
      fs.symlinkSync(path.join(state, "missing"), pending);
    assert.throws(() => assertNoPendingEnvironmentApply(state), /recovery/);
    assert.throws(
      () => manager.write(checksum(original), checksum(desired), desired),
      /recovery/,
    );
    await assert.rejects(
      manager.apply(requestId, checksum(original)),
      /recovery/,
    );
    assert.equal(manager.read().payload, original);
    assert.equal(manager.status(requestId), null);
    assert.equal(fs.readFileSync(ecosystem, "utf8"), originalEcosystem);
    const source = fs.readFileSync(
      new URL("../deploy/ssh-entrypoint.sh", import.meta.url),
      "utf8",
    );
    const quote = (value) => `'${value.replace(/'/g, `'"'"'`)}'`;
    // Execute the actual forced handler with only its fixed state mapped to a fixture.
    const script = source.replace(
      "state=/app/slacord-deploy",
      `state=${quote(state)}`,
    );
    for (const mode of ["prepare", "deploy"]) {
      const result = spawnSync("bash", ["-c", script], {
        encoding: "utf8",
        input: "synthetic archive, never consumed",
        env: {
          ...process.env,
          SSH_ORIGINAL_COMMAND: `${mode} ${"a".repeat(40)} ${"b".repeat(64)}`,
        },
      });
      assert.equal(result.status, 75, result.stderr);
      assert.match(result.stderr, /recovery is required/);
      assert.equal(
        fs.existsSync(path.join(state, "uploads")),
        false,
        "rejection precedes upload creation",
      );
    }
  });
}

for (const stage of [
  "snapshot",
  "journal",
  "activation",
  "health",
  "status",
  "settled",
]) {
  test(`SIGKILL during ${stage} preserves either a boot barrier or a verified boot config`, async (t) => {
    const { manager, state, apps, ecosystem, originalEcosystem } = fixture(t);
    manager.write(checksum(original), checksum(desired), desired);
    const moduleUrl = new URL("../deploy/env-management.mjs", import.meta.url)
      .href;
    const deployUrl = new URL("../deploy/deploy-ubuntu.mjs", import.meta.url)
      .href;
    const source = `
      import fs from 'node:fs';
      import {environmentManager} from ${JSON.stringify(moduleUrl)};
      import {activateRelease} from ${JSON.stringify(deployUrl)};
      const stage = ${JSON.stringify(stage)};
      function halt() { fs.writeSync(1, 'ready\\n'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0); }
      const link = fs.linkSync; fs.linkSync = (from, to) => {
        link(from,to);
        if ((stage==='snapshot' && to.endsWith('/env-apply-original.json')) ||
            (stage==='journal' && to.endsWith('/env-apply-pending.json'))) halt();
      };
      const rename = fs.renameSync; fs.renameSync = (from,to) => {
        rename(from,to);
        if (stage==='status' && to.endsWith('/${requestId}.json') && JSON.parse(fs.readFileSync(to)).state==='succeeded') halt();
      };
      const unlink = fs.unlinkSync; fs.unlinkSync = file => {
        unlink(file); if (stage==='settled' && file.endsWith('/env-apply-original.json')) halt();
      };
      const manager = environmentManager(${JSON.stringify(state)}, {
        readApps: () => ${JSON.stringify(apps)}, readOrigin: () => 'https://example.test',
        activate: async input => {
          await activateRelease(input, {preparePaths:()=>{}, replace:()=>{if(stage==='activation')halt();}, verify:async()=>{}, run:()=>{}});
          if(stage==='health')halt();
        },
      });
      await manager.apply(${JSON.stringify(requestId)}, ${JSON.stringify(checksum(desired))});
    `;
    const worker = spawn(
      process.execPath,
      ["--input-type=module", "-e", source],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    t.after(() => {
      try {
        worker.kill("SIGKILL");
      } catch {}
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("worker did not reach the crash checkpoint")),
        5000,
      );
      worker.once("error", reject);
      worker.stdout.once("data", () => {
        clearTimeout(timeout);
        resolve();
      });
      worker.once("exit", () => {
        clearTimeout(timeout);
        reject(new Error("worker exited before the checkpoint"));
      });
    });
    worker.kill("SIGKILL");
    await new Promise((resolve) => worker.once("exit", resolve));
    const pending = fs.existsSync(path.join(state, "env-apply-pending.json"));
    if (stage === "snapshot") {
      assert.equal(pending, false);
      assert.equal(fs.readFileSync(ecosystem, "utf8"), originalEcosystem);
      assert.equal(nextBootStorageKey(state), "synthetic-old");
    } else if (stage === "settled" || stage === "status") {
      assert.equal(pending, false);
      assert.equal(manager.status(requestId).state, "succeeded");
      assert.equal(nextBootStorageKey(state), "synthetic-new");
    } else
      assert.equal(
        pending,
        true,
        "the paired Control boot guard must defer PM2 startup",
      );
    if (stage !== "settled")
      assert.throws(
        () => manager.write(checksum(desired), checksum(original), original),
        /recovery/,
      );
    else assert.doesNotThrow(() => assertNoPendingEnvironmentApply(state));
    assert.equal(manager.read().payload, desired);
  });
}

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

test("SSH disconnect before acknowledgement cannot abort a persisted apply", async (t) => {
  const { state, apps, manager } = fixture(t);
  const moduleUrl = new URL("../deploy/env-management.mjs", import.meta.url)
    .href;
  const flock =
    process.platform === "darwin"
      ? "/opt/homebrew/bin/flock"
      : "/usr/bin/flock";
  const launcherGone = path.join(state, "launcher-gone");
  const worker = `
    import fs from 'node:fs';
    import { environmentManager, writeResponse } from ${JSON.stringify(moduleUrl)};
    while (!fs.existsSync(${JSON.stringify(launcherGone)})) await new Promise(resolve => setTimeout(resolve, 10));
    const manager = environmentManager(${JSON.stringify(state)}, {
      readApps: () => ${JSON.stringify(apps)},
      readOrigin: () => 'https://example.test', activate: async () => {},
    });
    await manager.apply(${JSON.stringify(requestId)}, ${JSON.stringify(checksum(original))}, record => {
      writeResponse({ protocol:'env-v1', ok:true, record }, 3);
      fs.closeSync(3);
    });
  `;
  const options = {
    flock,
    runner: [process.execPath, "--input-type=module", "-e", worker],
  };
  const launcherSource = `
    import { lockedWorker } from ${JSON.stringify(moduleUrl)};
    lockedWorker(${JSON.stringify(state)}, 'env-v1 apply', undefined, true, ${JSON.stringify(options)});
    setTimeout(() => process.exit(0), 20);
  `;
  const launcher = spawn(
    process.execPath,
    ["--input-type=module", "-e", launcherSource],
    { stdio: "ignore" },
  );
  await new Promise((resolve, reject) => {
    launcher.once("error", reject);
    launcher.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`launcher exit ${code}`)),
    );
  });
  fs.writeFileSync(launcherGone, "gone");
  const deadline = Date.now() + 5000;
  while (manager.status(requestId)?.state !== "succeeded") {
    assert.ok(
      Date.now() < deadline,
      "apply survives the broken acknowledgement pipe",
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(manager.status(requestId).conclusion, "success");
});
