import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import {
  activateRelease,
  readApps,
  readPublicOrigin,
} from "./deploy-ubuntu.mjs";

// These paths cannot be supplied over SSH or stdin.
const STATE = "/app/slacord-deploy";
const SELF = fileURLToPath(import.meta.url);
export const MAX_ENV_BYTES = 256 * 1024;
export const MANAGED_KEYS = Object.freeze([
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "MINIO_ENDPOINT",
  "MINIO_BUCKET",
]);
const SHA = /^[a-f0-9]{64}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_APPLY_MS = 15 * 60 * 1000;

function fail(code) {
  throw Object.assign(new Error(code), { publicCode: code });
}

export function checksum(payload) {
  return createHash("sha256").update(payload).digest("hex");
}

// Use the same single-line dotenv grammar as the Control editor. No shell eval,
// expansion, multiline values, duplicate assignments, or executable env keys.
export function validateOverrides(payload, requireAll = true) {
  if (
    typeof payload !== "string" ||
    Buffer.byteLength(payload) > MAX_ENV_BYTES ||
    /[\x00-\x08\x0b-\x1f\x7f]/.test(payload)
  )
    fail("invalid_environment");
  const keys = new Set();
  for (const line of payload.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = /^([A-Z_]+)=(.*)$/.exec(line);
    if (!match || !MANAGED_KEYS.includes(match[1]) || keys.has(match[1]))
      fail("unsupported_environment");
    keys.add(match[1]);
    const value = match[2];
    if (
      (value.startsWith('"') && !/^"[^"\\]*"$/.test(value)) ||
      (value.startsWith("'") && !/^'[^']*'$/.test(value)) ||
      value.startsWith("`") ||
      (!/^["']/.test(value) && /[\s#]/.test(value))
    )
      fail("invalid_environment");
  }
  if (!keys.size || (requireAll && MANAGED_KEYS.some((key) => !keys.has(key))))
    fail("missing_environment");
  const values = parseEnv(payload);
  for (const [key, value] of Object.entries(values)) {
    if (!keys.has(key) || !value || value.length > 16 * 1024)
      fail("invalid_environment");
    if (key === "MINIO_ENDPOINT") {
      let url;
      try {
        url = new URL(value);
      } catch {
        fail("invalid_endpoint");
      }
      if (
        !["http:", "https:"].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/"
      )
        fail("invalid_endpoint");
    }
    if (
      key === "MINIO_BUCKET" &&
      (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value) ||
        value.includes("..") ||
        /^\d+\.\d+\.\d+\.\d+$/.test(value))
    )
      fail("invalid_bucket");
  }
  return values;
}

function assertDirectory(directory) {
  const stat = fs.lstatSync(directory);
  if (
    !stat.isDirectory() ||
    stat.uid !== process.getuid() ||
    (stat.mode & 0o022) !== 0
  )
    fail("unsafe_permissions");
}

function privateFile(file, maxBytes = MAX_ENV_BYTES) {
  const fd = fs.openSync(
    file,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
  );
  try {
    const stat = fs.fstatSync(fd);
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid() ||
      (stat.mode & 0o777) !== 0o600 ||
      stat.nlink !== 1 ||
      stat.size > maxBytes
    )
      fail("unsafe_permissions");
    const bytes = Buffer.alloc(maxBytes + 1);
    const size = fs.readSync(fd, bytes, 0, bytes.length, 0);
    if (size > maxBytes) fail("invalid_environment");
    const payload = bytes.subarray(0, size).toString("utf8");
    if (!Buffer.from(payload).equals(bytes.subarray(0, size)))
      fail("invalid_environment");
    return { payload, stat };
  } finally {
    fs.closeSync(fd);
  }
}

function atomicPrivate(file, payload, exclusive = false) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const fd = fs.openSync(temporary, "wx", 0o600);
    try {
      fs.writeFileSync(fd, payload);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    if (exclusive) {
      fs.linkSync(temporary, file);
      fs.unlinkSync(temporary);
    } else fs.renameSync(temporary, file);
    const directory = fs.openSync(path.dirname(file), "r");
    try {
      fs.fsyncSync(directory);
    } finally {
      fs.closeSync(directory);
    }
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

export function parseCommand(command) {
  if (
    typeof command !== "string" ||
    command.length > 256 ||
    /[\r\n\0]/.test(command)
  )
    fail("invalid_command");
  const args = command.split(" ");
  const [protocol, action, first, second] = args;
  if (protocol !== "env-v1") fail("invalid_command");
  if (action === "read" && args.length === 2) return { action };
  if (
    action === "write" &&
    args.length === 4 &&
    SHA.test(first) &&
    SHA.test(second)
  )
    return { action, expected: first, version: second };
  if (
    action === "apply" &&
    args.length === 4 &&
    UUID.test(first) &&
    SHA.test(second)
  )
    return { action, requestId: first, version: second };
  if (action === "status" && args.length === 3 && UUID.test(first))
    return { action, requestId: first };
  fail("invalid_command");
}

// State injection is only for tests; the CLI always uses STATE above.
export function environmentManager(state, dependencies = {}) {
  const envFile = path.join(state, "private/server.env");
  const requests = path.join(state, "env-requests");
  const now = dependencies.now || (() => new Date().toISOString());
  function checkState() {
    assertDirectory(state);
    assertDirectory(path.join(state, "private"));
  }
  function read() {
    checkState();
    const { payload, stat } = privateFile(envFile);
    validateOverrides(payload);
    return {
      version: checksum(payload),
      payload,
      createdAt: stat.mtime.toISOString(),
    };
  }
  function requestPath(requestId) {
    if (!UUID.test(requestId)) fail("invalid_command");
    assertDirectory(state);
    if (!fs.existsSync(requests)) fs.mkdirSync(requests, { mode: 0o700 });
    assertDirectory(requests);
    return path.join(requests, `${requestId}.json`);
  }
  function status(requestId) {
    const file = requestPath(requestId);
    try {
      const record = JSON.parse(privateFile(file, 4096).payload);
      if (
        record.requestId !== requestId ||
        typeof record.version !== "string" ||
        !SHA.test(record.version) ||
        !["queued", "running", "succeeded", "failed"].includes(record.state)
      )
        fail("invalid_status");
      if (
        ["queued", "running"].includes(record.state) &&
        Date.now() - Date.parse(record.createdAt) > MAX_APPLY_MS
      ) {
        return { ...record, state: "failed", conclusion: "interrupted" };
      }
      return record;
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  return {
    read,
    status,
    // Called only by the worker while holding the CI deployment flock.
    write(expected, version, payload) {
      if (!SHA.test(expected) || !SHA.test(version)) fail("invalid_command");
      validateOverrides(payload);
      if (checksum(payload) !== version) fail("checksum_mismatch");
      const current = read();
      if (current.version !== expected) fail("version_conflict");
      atomicPrivate(envFile, payload);
      const written = read();
      if (written.version !== version) fail("checksum_mismatch");
      return { version, createdAt: written.createdAt };
    },
    async apply(requestId, version, acknowledge = () => {}) {
      if (!UUID.test(requestId) || !SHA.test(version)) fail("invalid_command");
      const existing = status(requestId);
      if (existing) {
        if (existing.version !== version) fail("request_conflict");
        acknowledge(existing);
        return existing;
      }
      if (read().version !== version) fail("version_conflict");
      // Reuse exactly the healthy current release; never build, fetch, or change source.
      const release = fs.realpathSync(path.join(state, "current"));
      const releases = fs.realpathSync(path.join(state, "releases"));
      if (path.dirname(release) !== releases) fail("invalid_release");
      const manifest = JSON.parse(
        privateFile(path.join(state, "last-success.json"), 4096).payload,
      );
      if (
        manifest.release !== release ||
        typeof manifest.revision !== "string" ||
        !/^[a-f0-9]{40}$/.test(manifest.revision)
      )
        fail("invalid_release");
      const apps = (dependencies.readApps || readApps)();
      for (const [index, relative] of [
        "packages/server/dist/main.js",
        "node_modules/next/dist/bin/next",
      ].entries()) {
        if (apps[index]?.pm2_env.pm_exec_path !== path.join(release, relative))
          fail("invalid_release");
      }
      const record = {
        requestId,
        version,
        revision: manifest.revision,
        state: "queued",
        conclusion: null,
        createdAt: now(),
        updatedAt: now(),
      };
      const file = requestPath(requestId);
      const save = () => atomicPrivate(file, `${JSON.stringify(record)}\n`);
      atomicPrivate(file, `${JSON.stringify(record)}\n`, true);
      acknowledge({ ...record });
      try {
        record.state = "running";
        record.updatedAt = now();
        save();
        // Recheck under the same lock immediately before activation.
        if (read().version !== version) fail("version_conflict");
        await (dependencies.activate || activateRelease)({
          state,
          release,
          revision: manifest.revision,
          origin: (dependencies.readOrigin || readPublicOrigin)(state),
          apps,
        });
        record.state = "succeeded";
        record.conclusion = "success";
      } catch {
        // activateRelease restores both previous PM2 definitions on health failure.
        // Keep the desired env file for an explicit retry or encrypted Control restore.
        record.state = "failed";
        record.conclusion = "activation_failed";
      }
      record.updatedAt = now();
      save();
      return record;
    },
  };
}

export async function readInput(stream, timeoutMs = 15_000) {
  const chunks = [];
  let size = 0;
  const timer = setTimeout(
    () => stream.destroy(new Error("input_timeout")),
    timeoutMs,
  );
  try {
    for await (const chunk of stream) {
      size += Buffer.byteLength(chunk);
      if (size > MAX_ENV_BYTES) fail("input_too_large");
      chunks.push(Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);
    const value = bytes.toString("utf8");
    if (!Buffer.from(value).equals(bytes)) fail("invalid_environment");
    return value;
  } finally {
    clearTimeout(timer);
  }
}

function envelope(value) {
  return { protocol: "env-v1", ok: true, ...value };
}
function errorEnvelope(error) {
  return {
    protocol: "env-v1",
    ok: false,
    code: error.publicCode || "operation_failed",
  };
}
function output(value, fd = 1) {
  fs.writeSync(fd, `${JSON.stringify(value)}\n`);
}

// flock uses the SAME permanent inode as ssh-entrypoint.sh, including for writes.
// The detached apply worker owns that lock until health/rollback completes.
export function lockedWorker(
  state,
  command,
  input,
  background = false,
  options = {},
) {
  assertDirectory(state);
  const lock = path.join(state, "deploy.lock");
  const fd = fs.openSync(
    lock,
    fs.constants.O_CREAT |
      fs.constants.O_APPEND |
      fs.constants.O_WRONLY |
      fs.constants.O_NOFOLLOW |
      fs.constants.O_NONBLOCK,
    0o600,
  );
  fs.closeSync(fd);
  privateFile(lock, 4096);
  return new Promise((resolve, reject) => {
    const child = spawn(
      options.flock || "/usr/bin/flock",
      [
        "-n",
        "-E",
        "75",
        lock,
        ...(options.runner || [
          "/usr/bin/timeout",
          "--kill-after=10s",
          "840s",
          process.execPath,
          SELF,
          "--locked",
          command,
        ]),
      ],
      {
        detached: background,
        // FD 3 carries only the acknowledgement, never PM2 output or env values.
        stdio: ["pipe", "ignore", "ignore", "pipe"],
        env: {
          PATH: "/usr/local/bin:/usr/bin:/bin",
          HOME: "/root",
          PM2_HOME: "/root/.pm2",
        },
      },
    );
    let settled = false;
    let bytes = "";
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.stdio[3].destroy();
      child.unref();
      reject(
        Object.assign(new Error("worker_unavailable"), {
          publicCode: "worker_unavailable",
        }),
      );
    }, 20_000);
    child.stdio[3].on("data", (data) => {
      if (settled) return;
      bytes += data.toString("utf8");
      if (bytes.length > 4096) return;
      if (!bytes.endsWith("\n")) return;
      try {
        const response = JSON.parse(bytes);
        settled = true;
        clearTimeout(timer);
        child.stdio[3].destroy();
        child.unref();
        resolve(response);
      } catch {
        /* wait for complete JSON or worker exit */
      }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
    child.once("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("worker_unavailable"));
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdio[3].destroy();
      resolve({
        protocol: "env-v1",
        ok: false,
        code: code === 75 ? "deployment_busy" : "worker_unavailable",
      });
    });
  });
}

async function main() {
  let acknowledgementSent = false;
  const internal = process.argv[2] === "--locked";
  const reply = (value) => {
    if (acknowledgementSent) return;
    output(value, internal ? 3 : 1);
    acknowledgementSent = true;
    if (internal) fs.closeSync(3);
  };
  try {
    const command = internal
      ? process.argv[3]
      : process.env.SSH_ORIGINAL_COMMAND;
    // No user-supplied paths, flags, worker actions, or additional arguments.
    if (
      (!internal && process.argv.length !== 2) ||
      (internal && process.argv.length !== 4)
    )
      fail("invalid_command");
    const parsed = parseCommand(command);
    const manager = environmentManager(STATE);
    if (internal) {
      if (parsed.action === "write")
        reply(
          envelope(
            manager.write(
              parsed.expected,
              parsed.version,
              await readInput(process.stdin),
            ),
          ),
        );
      else if (parsed.action === "apply")
        await manager.apply(parsed.requestId, parsed.version, (record) =>
          reply(envelope({ record })),
        );
      else fail("invalid_command");
    } else if (parsed.action === "read") reply(envelope(manager.read()));
    else if (parsed.action === "status")
      reply(envelope({ record: manager.status(parsed.requestId) }));
    else {
      if (parsed.action === "apply") {
        const existing = manager.status(parsed.requestId);
        if (existing) {
          if (existing.version !== parsed.version) fail("request_conflict");
          reply(envelope({ record: existing }));
          return;
        }
      }
      const payload =
        parsed.action === "write" ? await readInput(process.stdin) : undefined;
      reply(
        await lockedWorker(STATE, command, payload, parsed.action === "apply"),
      );
    }
  } catch (error) {
    reply(errorEnvelope(error));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) await main();
