import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const requireDesktop = createRequire(
  new URL("../packages/desktop/package.json", import.meta.url),
);
// Electron 45 downloads on first require. Complete that once before parallel test workers start.
execFileSync(
  process.execPath,
  [requireDesktop.resolve("electron/install.js")],
  { stdio: "inherit" },
);
