require("./check-disk.cjs");
const [major, minor] = process.versions.node.split(".").map(Number);
if (!(
  (major === 22 && minor >= 13) ||
  (major === 24 && minor >= 3) ||
  major >= 26
)) {
  process.stderr.write(
    "Expo SDK 58이 지원하는 Node 22.13+ 또는 24.3+ LTS를 먼저 선택해야 함. Node 25는 지원하지 않음.\n",
  );
  process.exit(1);
}
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

// Override only this checkout's installation. Leave the desktop's tracked hoisted
// workspace policy untouched; native development uses its own worktree.
const child = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  [
    "--filter",
    "@gadoc/mobile...",
    "install",
    "--config.node-linker=isolated",
    "--ignore-scripts",
    "--frozen-lockfile",
  ],
  {
    cwd: resolve(__dirname, "../../.."),
    stdio: "inherit",
    env: { ...process.env, CI: "1" },
  },
);
process.exit(child.status ?? 1);
