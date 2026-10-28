// Run only in the disposable ubuntu-gadoc image, never against the production PM2 daemon.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { activateRelease, readApps } from "../deploy/deploy-ubuntu.mjs";

assert.equal(process.getuid(), 0, "Run inside the disposable image as root.");
const state = fs.mkdtempSync(path.join(os.tmpdir(), "gadoc-pm2-isolation-"));
process.env.PM2_HOME = path.join(state, "pm2");
process.env.MONGO_ROOT_PASSWORD = "synthetic-inherited-admin-secret";
process.env.GITHUB_TOKEN = "synthetic-inherited-github-secret";
const pm2 = (...args) =>
  execFileSync("pm2", args, { encoding: "utf8", env: process.env });
const releases = path.join(state, "releases");
const release = path.join(releases, "new");
const legacy = path.join(releases, "legacy");
fs.mkdirSync(legacy, { recursive: true });
fs.mkdirSync(path.join(state, "private"), { mode: 0o700 });
const secret = path.join(state, "private/protected.env");
fs.writeFileSync(secret, "JWT_SECRET=synthetic-file-secret\n", { mode: 0o600 });
for (const directory of [
  "packages/server/dist",
  "packages/web/.next/server",
  "node_modules/next/dist/bin",
])
  fs.mkdirSync(path.join(release, directory), { recursive: true });
fs.writeFileSync(
  path.join(legacy, "main.js"),
  "setInterval(() => {}, 1000);\n",
);
const proof = [];
for (let index = 0; index < 2; index++) {
  const uid = 1002 + index;
  const directory = path.join(state, `proof-${uid}`);
  fs.mkdirSync(directory, { mode: 0o700 });
  fs.chownSync(directory, uid, uid);
  proof.push(path.join(directory, "result.json"));
  const body = `
    const fs=require('fs'),assert=require('assert/strict');
    assert.equal(process.getuid(),${uid});assert.equal(process.getgid(),${uid});
    assert.equal(process.env.MONGO_ROOT_PASSWORD,undefined);
    assert.throws(()=>fs.readFileSync(${JSON.stringify(secret)}),{code:'EACCES'});
    ${
      index === 1
        ? `for(const key of ['JWT_SECRET','MONGODB_URI','GITHUB_TOKEN'])assert.equal(process.env[key],undefined);
    fs.writeFileSync(${JSON.stringify(path.join(release, "packages/web/.next/server/write-check"))},'ok');`
        : "assert.equal(process.env.JWT_SECRET,'synthetic-api-secret');"
    }
    fs.writeFileSync(${JSON.stringify(proof[index])},JSON.stringify({uid:process.getuid(),isolated:true}));
    setInterval(()=>{},1000);
  `;
  fs.writeFileSync(
    path.join(
      release,
      index === 0
        ? "packages/server/dist/main.js"
        : "node_modules/next/dist/bin/next",
    ),
    body,
  );
}
const initial = path.join(state, "initial.config.json");
fs.writeFileSync(
  initial,
  JSON.stringify({
    apps: ["slacord-backend", "slacord-frontend"].map((name) => ({
      name,
      cwd: legacy,
      script: path.join(legacy, "main.js"),
      env: {
        MONGODB_URI: "mongodb://unused.invalid/test",
        JWT_SECRET: "synthetic-api-secret",
      },
    })),
  }),
);
try {
  pm2("start", initial);
  const apps = readApps();
  for (const [index, app] of apps.entries()) {
    app.pm2_env.uid = 1002 + index;
    app.pm2_env.gid = 1002 + index;
  }
  await activateRelease(
    {
      state,
      release,
      apps,
      revision: "a".repeat(40),
      origin: "https://unused.invalid",
    },
    {
      verify: async () => {
        for (
          let attempt = 0;
          attempt < 60 && !proof.every((file) => fs.existsSync(file));
          attempt++
        )
          await new Promise((resolve) => setTimeout(resolve, 100));
        for (const [index, file] of proof.entries())
          assert.deepEqual(JSON.parse(fs.readFileSync(file)), {
            uid: 1002 + index,
            isolated: true,
          });
        const running = readApps();
        for (const [index, app] of running.entries())
          assert.equal(Number(app.pm2_env.uid), 1002 + index);
        assert.throws(() =>
          execFileSync(
            "gosu",
            ["gadoc-web", "cat", `/proc/${running[0].pid}/environ`],
            { stdio: "ignore" },
          ),
        );
      },
    },
  );
  const failed = path.join(releases, "failed");
  fs.cpSync(release, failed, { recursive: true });
  await assert.rejects(
    activateRelease(
      {
        state,
        release: failed,
        apps: readApps(),
        revision: "b".repeat(40),
        origin: "https://unused.invalid",
      },
      {
        verify: async (_origin, revision) => {
          if (revision) throw new Error("synthetic unhealthy release");
          assert.deepEqual(
            readApps().map((app) => Number(app.pm2_env.uid)),
            [1002, 1003],
          );
        },
      },
    ),
    /synthetic unhealthy release/,
  );
  assert.equal(fs.realpathSync(path.join(state, "current")), release);
  console.log(
    "Real PM2: non-root activation, secret isolation, cross-user /proc denial, Next writes, and rollback passed.",
  );
} finally {
  pm2("kill");
  fs.rmSync(state, { recursive: true, force: true });
}
