import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repository = "kscold/slacord";
const container = "ubuntu-slacord";
const host = "kscold.com";
const port = "2226";
const sshDirectory = path.join(os.homedir(), ".ssh");
const key = path.join(sshDirectory, "slacord-actions-deploy");
const knownHosts = path.join(sshDirectory, "slacord-actions-known_hosts");
const exec = (command, args, input) =>
  execFileSync(command, args, {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "pipe"],
  });

fs.mkdirSync(sshDirectory, { recursive: true, mode: 0o700 });
if (!fs.existsSync(key)) {
  exec("ssh-keygen", [
    "-q",
    "-t",
    "ed25519",
    "-N",
    "",
    "-C",
    "slacord-github-actions",
    "-f",
    key,
  ]);
}
const publicKey = fs.readFileSync(`${key}.pub`, "utf8").trim();
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "../../package.json"), "utf8"),
);
if (!/^pnpm@10\.\d+\.\d+$/.test(manifest.packageManager))
  throw new Error("Expected a pinned pnpm 10 version.");
exec("docker", [
  "exec",
  "-w",
  "/",
  container,
  "corepack",
  "install",
  "--global",
  manifest.packageManager,
]);
exec("docker", ["exec", container, "corepack", "enable", "pnpm"]);
const installedPnpm = exec("docker", [
  "exec",
  "-w",
  "/",
  container,
  "pnpm",
  "--version",
]).trim();
if (`pnpm@${installedPnpm}` !== manifest.packageManager)
  throw new Error("Deployment pnpm version does not match packageManager.");
const hostKey = exec("docker", [
  "exec",
  container,
  "cat",
  "/etc/ssh/ssh_host_ed25519_key.pub",
]).trim();
const pinnedHost = `[${host}]:${port} ${hostKey}\n`;
fs.writeFileSync(knownHosts, pinnedHost, { mode: 0o600 });

exec("docker", [
  "exec",
  container,
  "mkdir",
  "-p",
  "/root/.ssh",
  "/app/slacord-deploy/tools",
]);
exec("docker", [
  "exec",
  container,
  "chmod",
  "700",
  "/root/.ssh",
  "/app/slacord-deploy",
]);
exec("docker", [
  "cp",
  path.join(root, "ssh-entrypoint.sh"),
  `${container}:/usr/local/sbin/slacord-ci`,
]);
exec("docker", [
  "cp",
  path.join(root, "deploy-ubuntu.mjs"),
  `${container}:/app/slacord-deploy/tools/deploy-ubuntu.mjs`,
]);
exec("docker", [
  "exec",
  container,
  "chmod",
  "755",
  "/usr/local/sbin/slacord-ci",
]);
const entry = `restrict,command="/usr/local/sbin/slacord-ci" ${publicKey}`;
exec(
  "docker",
  [
    "exec",
    "-i",
    container,
    "sh",
    "-c",
    'touch /root/.ssh/authorized_keys; chmod 600 /root/.ssh/authorized_keys; IFS= read -r entry; grep -qxF "$entry" /root/.ssh/authorized_keys || printf "%s\\n" "$entry" >> /root/.ssh/authorized_keys',
  ],
  `${entry}\n`,
);

// Read-only readiness check. Setup never restarts the application or database.
const ready = exec("ssh", [
  "-T",
  "-p",
  port,
  "-i",
  key,
  "-o",
  "BatchMode=yes",
  "-o",
  "IdentitiesOnly=yes",
  "-o",
  "StrictHostKeyChecking=yes",
  "-o",
  `UserKnownHostsFile=${knownHosts}`,
  "-o",
  "ConnectTimeout=15",
  `root@${host}`,
  "check",
]);
console.log(ready.trim());
exec("gh", [
  "api",
  "--method",
  "PUT",
  `repos/${repository}/environments/production`,
]);
const secrets = {
  SLACORD_SSH_HOST: host,
  SLACORD_SSH_PORT: port,
  SLACORD_SSH_USER: "root",
  SLACORD_SSH_PRIVATE_KEY: fs.readFileSync(key, "utf8"),
  SLACORD_SSH_KNOWN_HOSTS: pinnedHost,
};
for (const [name, value] of Object.entries(secrets)) {
  exec(
    "gh",
    ["secret", "set", name, "--repo", repository, "--env", "production"],
    value,
  );
  console.log(`Configured production secret: ${name}`);
}
