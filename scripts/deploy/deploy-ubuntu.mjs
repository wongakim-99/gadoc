import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const APP_NAMES = ["slacord-backend", "slacord-frontend"];
const DEFAULT_STATE = "/app/slacord-deploy";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0)
    throw new Error(`${command} failed (exit ${result.status ?? "unknown"}).`);
}

function privateJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function readApps() {
  const apps = JSON.parse(
    execFileSync("pm2", ["jlist"], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    }),
  );
  return APP_NAMES.map((name) => {
    const app = apps.find((item) => item.name === name);
    if (!app || app.pm2_env.status !== "online")
      throw new Error(`${name} must be online before deployment.`);
    return app;
  });
}

function replaceApps(configFile) {
  const running = JSON.parse(
    execFileSync("pm2", ["jlist"], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    }),
  );
  const existing = running
    .filter((app) => APP_NAMES.includes(app.name))
    .map((app) => app.name);
  // PM2 reload retains legacy shell args/interpreters. Recreate just these two app definitions.
  if (existing.length) run("pm2", ["delete", ...existing]);
  run("pm2", ["start", configFile]);
}

export function runtimeEnvironment(app, readFile = fs.readFileSync) {
  const pm = app.pm2_env;
  // Legacy PM2 commands start a shell at the repo root, while Nest reads its package .env.
  const packageDirectory = app.name === "slacord-backend" ? "server" : "web";
  const packageCwd =
    path.basename(pm.pm_cwd) === packageDirectory
      ? pm.pm_cwd
      : path.join(pm.pm_cwd, "packages", packageDirectory);
  let fileEnv = {};
  try {
    fileEnv = parseEnv(readFile(path.join(packageCwd, ".env"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const ignored = new Set([
    "PWD",
    "OLDPWD",
    "_",
    "SHLVL",
    "unique_id",
    ...APP_NAMES,
  ]);
  return Object.fromEntries(
    Object.entries({ ...fileEnv, ...pm.env }).filter(
      ([key, value]) =>
        !ignored.has(key) &&
        ["string", "number", "boolean"].includes(typeof value),
    ),
  );
}

export function snapshotApps(apps) {
  return {
    apps: apps.map(({ name, pm2_env: pm }) => ({
      name,
      script: pm.pm_exec_path,
      cwd: pm.pm_cwd,
      args: pm.args,
      interpreter: pm.exec_interpreter || "node",
      exec_mode: "fork",
      ...runtimeIdentity(pm),
      ...(pm.filter_env !== undefined ? { filter_env: pm.filter_env } : {}),
      env: pm.env,
      autorestart: true,
      watch: false,
      out_file: pm.pm_out_log_path,
      error_file: pm.pm_err_log_path,
    })),
  };
}

function runtimeIdentity(pm) {
  return Object.fromEntries(
    ["uid", "gid"]
      .filter((key) => pm[key] !== undefined)
      .map((key) => [key, pm[key]]),
  );
}

export function webEnvironment(env) {
  const allowed = new Set([
    "PATH",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TZ",
    "TMPDIR",
    "NODE_ENV",
    "NODE_OPTIONS",
    "NEXT_TELEMETRY_DISABLED",
    "INTERNAL_API_URL",
    "PORT",
  ]);
  return Object.fromEntries(
    Object.entries(env).filter(
      ([key]) => allowed.has(key) || key.startsWith("NEXT_PUBLIC_"),
    ),
  );
}

export function prepareRuntimePaths(release, config) {
  const identities = config.apps.filter(
    (app) => app.uid !== undefined && Number(app.uid) !== 0,
  );
  if (!identities.length) return;
  for (const app of identities) {
    if (
      !Number.isSafeInteger(Number(app.uid)) ||
      Number(app.uid) <= 0 ||
      !Number.isSafeInteger(Number(app.gid)) ||
      Number(app.gid) <= 0
    ) {
      throw new Error(
        "Non-root runtime requires numeric positive uid and gid.",
      );
    }
  }
  // Allow traversal, not listing, of private deployment parents.
  for (const directory of [
    path.dirname(path.dirname(release)),
    path.dirname(release),
  ])
    fs.chmodSync(directory, fs.statSync(directory).mode | 0o111);
  function makeReadable(directory) {
    fs.chmodSync(directory, 0o755);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) makeReadable(file);
      else if (entry.isFile()) {
        const privateFile =
          entry.name.startsWith(".env") ||
          entry.name === "ecosystem.config.json" ||
          /\.(pem|key)$/.test(entry.name);
        // Never briefly make an existing secret readable while fixing artifact permissions.
        fs.chmodSync(
          file,
          privateFile ? 0o600 : 0o644 | (fs.statSync(file).mode & 0o111),
        );
      }
    }
  }
  makeReadable(release);
  const web = identities.find((app) => app.name === APP_NAMES[1]);
  const next = path.join(release, "packages/web/.next");
  if (web && fs.existsSync(next))
    run("chown", ["-R", `${web.uid}:${web.gid}`, next]);
}

export function readServerOverrides(state) {
  const file = path.join(state, "private", "server.env");
  if (!fs.existsSync(file)) return {};
  if ((fs.statSync(file).mode & 0o077) !== 0)
    throw new Error("Server override file must be private (0600).");
  const values = parseEnv(fs.readFileSync(file, "utf8"));
  const allowed = new Set([
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY",
    "MINIO_ENDPOINT",
    "MINIO_BUCKET",
  ]);
  if (Object.keys(values).some((key) => !allowed.has(key)))
    throw new Error("Unsupported server override.");
  return values;
}

export function readPublicOrigin(state) {
  const file = path.join(state, "private", "public.env");
  let origin = "https://gadoc.kr";
  if (fs.existsSync(file)) {
    if ((fs.statSync(file).mode & 0o077) !== 0)
      throw new Error("Public origin override must be private (0600).");
    const values = parseEnv(fs.readFileSync(file, "utf8"));
    if (Object.keys(values).some((key) => key !== "GADOC_PUBLIC_ORIGIN"))
      throw new Error("Unsupported public origin override.");
    origin = values.GADOC_PUBLIC_ORIGIN ?? origin;
  }
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.origin !== origin || url.username || url.password)
    throw new Error("Public origin must be an exact HTTPS origin.");
  return origin;
}

export function releaseApps(release, apps, origin, serverOverrides = {}) {
  const server = { ...runtimeEnvironment(apps[0]), ...serverOverrides };
  const web = webEnvironment(runtimeEnvironment(apps[1]));
  // The API needs only its scoped URI, never Mongo bootstrap/admin credentials.
  for (const key of Object.keys(server))
    if (key.startsWith("MONGO_")) delete server[key];
  if (!server.MONGODB_URI || !server.JWT_SECRET)
    throw new Error("Existing MONGODB_URI and JWT_SECRET are required.");
  const publicEnv = {
    NODE_ENV: "production",
    INTERNAL_API_URL: "http://127.0.0.1:8082",
    NEXT_PUBLIC_APP_URL: origin,
    NEXT_PUBLIC_API_URL: origin,
    NEXT_PUBLIC_SOCKET_URL: origin,
  };
  return {
    apps: [
      {
        name: APP_NAMES[0],
        cwd: path.join(release, "packages/server"),
        script: path.join(release, "packages/server/dist/main.js"),
        interpreter: process.execPath,
        ...runtimeIdentity(apps[0].pm2_env),
        // PM2 6.0.14 ignores boolean true (.length check); this excludes every inherited key.
        filter_env: [""],
        env: { ...server, ...publicEnv, HOST: "0.0.0.0", PORT: "8082" },
        autorestart: true,
        watch: false,
        kill_timeout: 10000,
        out_file: "/var/log/slacord/backend.log",
        error_file: "/var/log/slacord/backend-error.log",
      },
      {
        name: APP_NAMES[1],
        cwd: path.join(release, "packages/web"),
        script: path.join(release, "node_modules/next/dist/bin/next"),
        interpreter: process.execPath,
        ...runtimeIdentity(apps[1].pm2_env),
        filter_env: [""],
        args: ["start", "--hostname", "0.0.0.0", "--port", "3002"],
        env: { ...web, ...publicEnv, PORT: "3002" },
        autorestart: true,
        watch: false,
        kill_timeout: 10000,
        out_file: "/var/log/slacord/frontend.log",
        error_file: "/var/log/slacord/frontend-error.log",
      },
    ],
  };
}

async function waitFor(url, validate = () => true, attempts = 45) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok && (await validate(response))) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Health check failed: ${url}`);
}

export async function verifyRelease(origin, revision, release) {
  for (const base of ["http://127.0.0.1:8082", origin]) {
    await waitFor(
      `${base}/api/health`,
      async (response) => (await response.json()).data?.status === "ok",
    );
  }
  for (const base of ["http://127.0.0.1:3002", origin]) {
    await waitFor(`${base}/auth/login`, async (response) =>
      (response.headers.get("content-type") || "").includes("text/html"),
    );
    if (revision) {
      await waitFor(
        `${base}/slacord-release.json?revision=${revision}`,
        async (response) => (await response.json()).revision === revision,
      );
    }
  }
  if (release) {
    const running = readApps();
    const scripts = [
      "packages/server/dist/main.js",
      "node_modules/next/dist/bin/next",
    ];
    for (let index = 0; index < running.length; index += 1) {
      if (
        running[index].pm2_env.pm_exec_path !==
        path.join(release, scripts[index])
      ) {
        throw new Error(
          `${running[index].name} is not running the expected release.`,
        );
      }
    }
  }
}

export async function activateRelease(
  { state, release, revision, origin, apps },
  dependencies = {},
) {
  const execute = dependencies.run || run;
  const replace = dependencies.replace || replaceApps;
  const verify = dependencies.verify || verifyRelease;
  const current = path.join(state, "current");
  const previousTarget = fs.existsSync(current)
    ? fs.realpathSync(current)
    : null;
  const rollbackFile = path.join(state, "rollback.config.json");
  const ecosystemFile = path.join(release, "ecosystem.config.json");
  const config = releaseApps(release, apps, origin, readServerOverrides(state));
  (dependencies.preparePaths || prepareRuntimePaths)(release, config);
  privateJson(rollbackFile, snapshotApps(apps));
  privateJson(ecosystemFile, config);

  try {
    replace(ecosystemFile);
    await verify(origin, revision, release);
    execute("pm2", ["save"]);
    fs.symlinkSync(release, `${current}.next`);
    fs.renameSync(`${current}.next`, current);
    privateJson(path.join(state, "last-success.json"), {
      revision,
      release,
      previousTarget,
      deployedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Activation failed; restoring both previous PM2 processes.");
    replace(rollbackFile);
    await verify(origin, null);
    execute("pm2", ["save"]);
    fs.rmSync(`${current}.next`, { force: true });
    if (previousTarget) {
      fs.symlinkSync(previousTarget, `${current}.next`);
      fs.renameSync(`${current}.next`, current);
    } else {
      fs.rmSync(current, { force: true });
    }
    throw error;
  }
}

export function validateArchiveNames(names) {
  if (
    names.some((name) => name.startsWith("/") || name.split("/").includes(".."))
  ) {
    throw new Error("Unsafe path in source archive.");
  }
  for (const required of [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "packages/server/package.json",
    "packages/web/package.json",
  ]) {
    if (!names.includes(required))
      throw new Error(`Incomplete source archive: ${required}`);
  }
}

async function main() {
  const [mode, revision, archive] = process.argv.slice(2);
  if (!["check", "prepare", "deploy"].includes(mode))
    throw new Error("Expected check, prepare, or deploy.");
  const state = DEFAULT_STATE;
  const origin = readPublicOrigin(state);
  const apps = readApps();
  const server = runtimeEnvironment(apps[0]);
  if (!server.MONGODB_URI || !server.JWT_SECRET)
    throw new Error("Current runtime configuration is incomplete.");
  if (mode === "check") {
    for (const command of ["pnpm", "tar", "flock"])
      execFileSync("which", [command]);
    await verifyRelease(origin, null);
    console.log(
      `Deployment target ready: ${process.platform}/${process.arch}; existing DB and storage configuration retained.`,
    );
    return;
  }
  if (!/^[a-f0-9]{40}$/.test(revision || "") || !archive)
    throw new Error("Invalid source revision.");
  const names = execFileSync("tar", ["-tzf", archive], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  })
    .trim()
    .split("\n");
  validateArchiveNames(names);
  fs.mkdirSync(path.join(state, "releases"), { recursive: true, mode: 0o700 });
  const release = fs.mkdtempSync(path.join(state, "releases", `${revision}-`));
  run("tar", [
    "-xzf",
    archive,
    "--no-same-owner",
    "--no-same-permissions",
    "-C",
    release,
  ]);
  const env = {
    ...process.env,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    ELECTRON_SKIP_BINARY_DOWNLOAD: "1",
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
    NODE_OPTIONS: "--max-old-space-size=1536",
    INTERNAL_API_URL: "http://127.0.0.1:8082",
    NEXT_PUBLIC_APP_URL: origin,
    NEXT_PUBLIC_API_URL: origin,
    NEXT_PUBLIC_SOCKET_URL: origin,
  };
  console.log(`Building verified revision ${revision} in ${release}`);
  run("pnpm", ["install", "--frozen-lockfile", "--prod=false"], {
    cwd: release,
    env,
  });
  run("pnpm", ["build:server"], { cwd: release, env });
  run("pnpm", ["build:web"], { cwd: release, env });
  for (const artifact of [
    "packages/server/dist/main.js",
    "packages/web/.next/BUILD_ID",
  ]) {
    if (!fs.existsSync(path.join(release, artifact)))
      throw new Error(`Missing release artifact: ${artifact}`);
  }
  fs.writeFileSync(
    path.join(release, "packages/web/public/slacord-release.json"),
    `${JSON.stringify({ revision })}\n`,
  );
  if (mode === "prepare") {
    console.log(
      `Prepared ${revision}. Active PM2 processes and database were not changed.`,
    );
    return;
  }
  await activateRelease({ state, release, revision, origin, apps: readApps() });
  console.log(`Deployment healthy: ${revision} at ${origin}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
