import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  activateRelease,
  readServerOverrides,
  releaseApps,
  runtimeEnvironment,
  snapshotApps,
  webEnvironment,
  prepareRuntimePaths,
  validateArchiveNames,
} from "../deploy/deploy-ubuntu.mjs";

function fixture(t) {
  const state = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "slacord-deploy-test-")),
  );
  t.after(() => fs.rmSync(state, { recursive: true, force: true }));
  const release = path.join(state, "releases", "new-release");
  const previous = path.join(state, "old-release");
  fs.mkdirSync(release, { recursive: true });
  fs.mkdirSync(previous);
  fs.symlinkSync(previous, path.join(state, "current"));
  const apps = ["slacord-backend", "slacord-frontend"].map((name) => ({
    name,
    pm2_env: {
      pm_cwd: previous,
      pm_exec_path: "/bin/bash",
      exec_interpreter: "none",
      args: ["-c", "node existing-server.js"],
      env: {
        MONGODB_URI:
          "mongodb://user:test@127.0.0.1:27017/existing?authSource=existing",
        JWT_SECRET: "existing-test-secret",
        MINIO_ENDPOINT: "http://existing-storage:9000",
        MINIO_SECRET_KEY: "existing-test-storage-secret",
        COOKIE_SECURE: "true",
        NEXT_PUBLIC_APP_URL: "https://old.example.test",
      },
    },
  }));
  return {
    state,
    release,
    previous,
    apps,
    revision: "a".repeat(40),
    origin: "https://slacord.cloud",
  };
}

test("new release retains the existing database, credentials, and object storage", (t) => {
  const input = fixture(t);
  const config = releaseApps(input.release, input.apps, input.origin);
  const server = config.apps[0];
  for (const key of [
    "MONGODB_URI",
    "JWT_SECRET",
    "MINIO_ENDPOINT",
    "MINIO_SECRET_KEY",
    "COOKIE_SECURE",
  ]) {
    assert.equal(server.env[key], input.apps[0].pm2_env.env[key]);
  }
  assert.equal(server.env.PORT, "8082");
  assert.equal(config.apps[1].env.PORT, "3002");
  assert.equal(
    config.apps[1].env.NEXT_PUBLIC_SOCKET_URL,
    "https://slacord.cloud",
  );
  assert.equal(config.apps[1].env.INTERNAL_API_URL, "http://127.0.0.1:8082");
});

test("existing package .env is inherited while PM2 overrides retain priority", (t) => {
  const { apps } = fixture(t);
  const result = runtimeEnvironment(
    apps[0],
    () => "DATABASE_OPTION=existing\nJWT_SECRET=file-value\n",
  );
  assert.equal(result.DATABASE_OPTION, "existing");
  assert.equal(result.JWT_SECRET, "existing-test-secret");
});

test("frontend allows only web runtime configuration and drops unknown secrets", (t) => {
  const input = fixture(t);
  const secrets = {
    MONGO_ROOT_USERNAME: "test-root",
    MONGO_ROOT_PASSWORD: "test-root-password",
    MONGO_APP_USERNAME: "test-app",
    MONGO_APP_PASSWORD: "test-app-password",
    AWS_SECRET_ACCESS_KEY: "test-unknown-secret",
    GITHUB_TOKEN: "test-token",
  };
  for (const app of input.apps) Object.assign(app.pm2_env.env, secrets);
  const config = releaseApps(input.release, input.apps, input.origin);
  for (const key of Object.keys(secrets))
    assert.equal(config.apps[1].env[key], undefined);
  for (const key of Object.keys(secrets).filter((key) =>
    key.startsWith("MONGO_"),
  ))
    assert.equal(config.apps[0].env[key], undefined);
  assert.equal(
    config.apps[0].env.MONGODB_URI,
    input.apps[0].pm2_env.env.MONGODB_URI,
  );
  assert.ok(
    config.apps.every((app) => JSON.stringify(app.filter_env) === '[""]'),
  );
  assert.deepEqual(
    webEnvironment({
      PATH: "/bin",
      NEXT_PUBLIC_WEBRTC_ICE_SERVERS: "[]",
      COOKIE_SECRET: "secret",
    }),
    { PATH: "/bin", NEXT_PUBLIC_WEBRTC_ICE_SERVERS: "[]" },
  );
});

test("non-root identities and environment isolation survive release and rollback snapshots", (t) => {
  const input = fixture(t);
  for (const [index, app] of input.apps.entries()) {
    app.pm2_env.uid = 1002 + index;
    app.pm2_env.gid = 1002 + index;
    app.pm2_env.filter_env = [""];
  }
  for (const config of [
    releaseApps(input.release, input.apps, input.origin),
    snapshotApps(input.apps),
  ]) {
    assert.deepEqual(
      config.apps.map(({ uid, gid }) => ({ uid, gid })),
      [
        { uid: 1002, gid: 1002 },
        { uid: 1003, gid: 1003 },
      ],
    );
    assert.ok(
      config.apps.every((app) => JSON.stringify(app.filter_env) === '[""]'),
    );
  }
});

test("legacy root deployment needs no permission changes and invalid non-root identity fails closed", (t) => {
  const input = fixture(t);
  const config = releaseApps(input.release, input.apps, input.origin);
  const original = fs.statSync(input.release).mode;
  prepareRuntimePaths(input.release, config);
  assert.equal(fs.statSync(input.release).mode, original);
  config.apps[0].uid = "invalid";
  assert.throws(
    () => prepareRuntimePaths(input.release, config),
    /numeric positive/,
  );
});

test("activation prepares permissions before writing private config and starting PM2", async (t) => {
  const input = fixture(t);
  const events = [];
  await activateRelease(input, {
    preparePaths: () => events.push("permissions"),
    replace: (file) => {
      assert.equal(fs.statSync(file).mode & 0o777, 0o600);
      events.push("start");
    },
    verify: async () => {},
    run: () => {},
  });
  assert.deepEqual(events, ["permissions", "start"]);
});

test("artifact permissions never temporarily expose private files or follow external symlinks", (t) => {
  const input = fixture(t);
  const nested = path.join(input.release, "nested");
  fs.mkdirSync(nested, { mode: 0o700 });
  const secret = path.join(nested, ".env.production");
  const artifact = path.join(nested, "main.js");
  const external = path.join(input.state, "outside-private");
  fs.writeFileSync(secret, "SYNTHETIC_SECRET=test", { mode: 0o600 });
  fs.writeFileSync(artifact, "// test", { mode: 0o600 });
  fs.writeFileSync(external, "test", { mode: 0o600 });
  fs.symlinkSync(external, path.join(nested, "external-link"));
  const chmod = fs.chmodSync;
  t.mock.method(fs, "chmodSync", (file, mode) => {
    if (file === secret) assert.equal(mode, 0o600);
    return chmod(file, mode);
  });
  prepareRuntimePaths(input.release, {
    apps: [{ name: "slacord-backend", uid: 1002, gid: 1002 }],
  });
  assert.equal(fs.statSync(secret).mode & 0o777, 0o600);
  assert.equal(fs.statSync(artifact).mode & 0o777, 0o644);
  assert.equal(fs.statSync(external).mode & 0o777, 0o600);
});

test("private storage rotation applies only to the backend and rejects unsafe override files", (t) => {
  const input = fixture(t);
  fs.mkdirSync(path.join(input.state, "private"), { mode: 0o700 });
  const file = path.join(input.state, "private/server.env");
  fs.writeFileSync(
    file,
    "MINIO_ACCESS_KEY=gadoc-app\nMINIO_SECRET_KEY=rotated-test-only\n",
    { mode: 0o600 },
  );
  const config = releaseApps(
    input.release,
    input.apps,
    input.origin,
    readServerOverrides(input.state),
  );
  assert.equal(config.apps[0].env.MINIO_ACCESS_KEY, "gadoc-app");
  assert.equal(config.apps[0].env.MINIO_SECRET_KEY, "rotated-test-only");
  for (const key of [
    "MINIO_SECRET_KEY",
    "MINIO_ENDPOINT",
    "MONGODB_URI",
    "JWT_SECRET",
  ])
    assert.equal(config.apps[1].env[key], undefined);
  fs.chmodSync(file, 0o644);
  assert.throws(() => readServerOverrides(input.state), /private/);
  fs.chmodSync(file, 0o600);
  fs.writeFileSync(file, "MONGODB_URI=do-not-replace\n");
  assert.throws(() => readServerOverrides(input.state), /Unsupported/);
});

test("missing runtime secrets fail before restarting anything", (t) => {
  const { apps, release, origin } = fixture(t);
  delete apps[0].pm2_env.env.MONGODB_URI;
  assert.throws(
    () => releaseApps(release, apps, origin),
    /Existing MONGODB_URI/,
  );
});

test("successful activation saves PM2 only after health and revision checks", async (t) => {
  const input = fixture(t);
  const events = [];
  await activateRelease(input, {
    run: (command, args) => events.push([command, ...args]),
    replace: (config) => events.push(["replace", config]),
    verify: async (origin, revision) => {
      assert.equal(
        fs.realpathSync(path.join(input.state, "current")),
        input.previous,
      );
      events.push(["verify", origin, revision]);
    },
  });
  assert.equal(events[0][0], "replace");
  assert.deepEqual(events[1], ["verify", input.origin, input.revision]);
  assert.deepEqual(events[2], ["pm2", "save"]);
  assert.equal(
    fs.realpathSync(path.join(input.state, "current")),
    input.release,
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(input.state, "last-success.json")))
      .revision,
    input.revision,
  );
  assert.equal(
    fs.statSync(path.join(input.release, "ecosystem.config.json")).mode & 0o777,
    0o600,
  );
});

test("failed health check restores both original process commands and leaves current release intact", async (t) => {
  const input = fixture(t);
  const events = [];
  await assert.rejects(
    activateRelease(input, {
      run: (command, args) => events.push([command, ...args]),
      replace: (config) => events.push(["replace", config]),
      verify: async (_origin, revision) => {
        if (revision) throw new Error("unhealthy new release");
      },
    }),
    /unhealthy new release/,
  );
  const rollback = JSON.parse(
    fs.readFileSync(path.join(input.state, "rollback.config.json")),
  );
  assert.equal(rollback.apps.length, 2);
  assert.deepEqual(rollback.apps[0].args, input.apps[0].pm2_env.args);
  assert.deepEqual(rollback.apps[0].env, input.apps[0].pm2_env.env);
  assert.equal(events[1][1], path.join(input.state, "rollback.config.json"));
  assert.deepEqual(events[2], ["pm2", "save"]);
  assert.equal(
    fs.realpathSync(path.join(input.state, "current")),
    input.previous,
  );
  assert.equal(
    fs.existsSync(path.join(input.state, "last-success.json")),
    false,
  );
});

test("partial PM2 activation failure also triggers rollback", async (t) => {
  const input = fixture(t);
  let calls = 0;
  await assert.rejects(
    activateRelease(input, {
      replace: () => {
        if (++calls === 1) throw new Error("restart failed");
      },
      run: () => {
        calls += 1;
      },
      verify: async () => {},
    }),
    /restart failed/,
  );
  assert.equal(calls, 3);
  assert.equal(
    fs.realpathSync(path.join(input.state, "current")),
    input.previous,
  );
});

test("source archive rejects path traversal and incomplete applications", () => {
  const required = [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "packages/server/package.json",
    "packages/web/package.json",
  ];
  validateArchiveNames(required);
  assert.throws(
    () => validateArchiveNames([...required, "../outside"]),
    /Unsafe path/,
  );
  assert.throws(
    () => validateArchiveNames([...required, "/etc/passwd"]),
    /Unsafe path/,
  );
  assert.throws(
    () => validateArchiveNames(["package.json"]),
    /Incomplete source/,
  );
});

test("forced SSH entrypoint rejects arbitrary commands before touching deployment state", () => {
  const entrypoint = fileURLToPath(
    new URL("../deploy/ssh-entrypoint.sh", import.meta.url),
  );
  for (const command of [
    "bash",
    "check extra",
    "deploy main invalid",
    `deploy ${"a".repeat(40)} ${"b".repeat(64)} extra`,
    "check; id",
  ]) {
    const result = spawnSync("bash", [entrypoint], {
      env: { ...process.env, SSH_ORIGINAL_COMMAND: command },
    });
    assert.equal(result.status, 64, command);
  }
});
