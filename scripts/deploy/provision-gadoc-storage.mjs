import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const alias = "localminio";
const account = "gadoc-app";
const policy = "gadoc-private-files";
const directory = path.join(os.homedir(), ".config/gadoc");
const file = path.join(directory, "minio-server.env");
const policyFile = fileURLToPath(
  new URL("./gadoc-file-policy.json", import.meta.url),
);

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Do not render subprocess argv or stderr: the user-add call contains a generated secret.
  if (result.status !== 0)
    throw new Error(
      `${command} operation failed; credentials were not logged.`,
    );
  return result.stdout;
}

function credentials() {
  if (!fs.existsSync(file) || fs.statSync(file).mode & 0o077)
    throw new Error("Prepare a private 0600 credential file first.");
  const values = parseEnv(fs.readFileSync(file, "utf8"));
  if (
    values.MINIO_ACCESS_KEY !== account ||
    !values.MINIO_SECRET_KEY ||
    values.MINIO_SECRET_KEY.length < 48
  )
    throw new Error("Unexpected storage account configuration.");
  return values;
}

async function main() {
  const mode = process.argv[2];
  if (!["prepare", "install", "privatize"].includes(mode))
    throw new Error("Use prepare, install, or privatize <deployed-main-sha>.");
  const aliases = JSON.parse(
    fs.readFileSync(path.join(os.homedir(), ".mc/config.json"), "utf8"),
  ).aliases;
  if (
    !["http://127.0.0.1:9000", "http://localhost:9000"].includes(
      aliases?.[alias]?.url,
    )
  )
    throw new Error("Expected the existing local shared MinIO alias.");
  if (mode === "prepare") {
    const info = spawnSync(
      "mc",
      ["admin", "user", "info", alias, account, "--json"],
      { encoding: "utf8" },
    );
    if (info.status === 0 && !fs.existsSync(file))
      throw new Error(
        "Account already exists without its private credential file; refusing to rotate it.",
      );
    if (
      info.status !== 0 &&
      !`${info.stdout}${info.stderr}`.includes("XMinioAdminNoSuchUser")
    )
      throw new Error("Cannot verify storage account state.");
    if (!fs.existsSync(file)) {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      fs.writeFileSync(
        file,
        `MINIO_ACCESS_KEY=${account}\nMINIO_SECRET_KEY=${randomBytes(48).toString("hex")}\nMINIO_BUCKET=gadoc\nMINIO_ENDPOINT=http://host.docker.internal:9000\n`,
        { mode: 0o600, flag: "wx" },
      );
    }
    const values = credentials();
    if (values.MINIO_BUCKET !== "gadoc")
      throw new Error("Complete the verified gadoc bucket migration before applying the final policy.");
    run("mc", ["admin", "policy", "create", alias, policy, policyFile]);
    if (info.status !== 0)
      run("mc", [
        "admin",
        "user",
        "add",
        alias,
        account,
        values.MINIO_SECRET_KEY,
      ]);
    run("mc", ["admin", "policy", "attach", alias, policy, "--user", account]);
    console.log(
      `Prepared ${account}: object read/write only for GaDoc chat/docs. Bucket policy and running app unchanged.`,
    );
  } else if (mode === "install") {
    credentials();
    run("docker", [
      "exec",
      "ubuntu-slacord",
      "mkdir",
      "-p",
      "/app/slacord-deploy/private",
    ]);
    run("docker", [
      "exec",
      "ubuntu-slacord",
      "chmod",
      "700",
      "/app/slacord-deploy/private",
    ]);
    run("docker", [
      "cp",
      file,
      "ubuntu-slacord:/app/slacord-deploy/private/server.env",
    ]);
    run("docker", [
      "exec",
      "ubuntu-slacord",
      "chown",
      "root:root",
      "/app/slacord-deploy/private/server.env",
    ]);
    run("docker", [
      "exec",
      "ubuntu-slacord",
      "chmod",
      "600",
      "/app/slacord-deploy/private/server.env",
    ]);
    console.log(
      "Staged backend-only credentials for the next deployment; current PM2 environment unchanged.",
    );
  } else {
    const revision = process.argv[3];
    if (!/^[a-f0-9]{40}$/.test(revision ?? ""))
      throw new Error("An exact verified main revision is required.");
    const base = "https://slacord.cloud";
    const release = await fetch(`${base}/slacord-release.json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!release.ok || (await release.json()).revision !== revision)
      throw new Error("Expected release is not live.");
    const reader = await fetch(`${base}/api/files?key=slacord%2Fchat%2Fprobe`, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    if (reader.status !== 401)
      throw new Error("Authenticated file reader is not live.");
    run("mc", ["anonymous", "set", "none", `${alias}/gadoc`]);
    console.log(
      "Removed anonymous access from gadoc only. Verify authorized reads plus anonymous GET/HEAD/LIST now.",
    );
  }
}

main().catch(() => {
  console.error(
    "GaDoc storage operation failed. Check target readiness and account state; no secret values were printed.",
  );
  process.exitCode = 1;
});
