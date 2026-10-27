import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const version = JSON.parse(
  readFileSync(new URL("../../packages/desktop/package.json", import.meta.url)),
).version;
test("release requires all platforms and emits SHA256 plus unsigned warnings", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "gadoc-artifacts-test-"));
  const run = () =>
    spawnSync(
      process.execPath,
      ["scripts/verify-desktop-artifacts.mjs", directory, `v${version}`],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          GADOC_MAC_SIGNED: "0",
          GADOC_WINDOWS_SIGNED: "0",
        },
      },
    );
  try {
    writeFileSync(
      path.join(directory, `GaDoc-${version}-arm64.dmg`),
      "test installer",
    );
    assert.notEqual(run().status, 0);
    for (const suffix of ["arm64.zip", "x64.exe"])
      writeFileSync(
        path.join(directory, `GaDoc-${version}-${suffix}`),
        "test installer",
      );
    for (const name of ["latest-mac.yml", "latest.yml"])
      writeFileSync(
        path.join(directory, name),
        `version: ${version}\npath: GaDoc-${version}-${name === "latest.yml" ? "x64.exe" : "arm64.zip"}\n`,
      );
    assert.equal(run().status, 0);
    assert.match(
      readFileSync(path.join(directory, "SHA256SUMS.txt"), "utf8"),
      /^[a-f0-9]{64}  GaDoc-/,
    );
    assert.match(
      readFileSync(path.join(directory, "RELEASE_NOTES.md"), "utf8"),
      /SmartScreen/,
    );
    assert.ok(
      readFileSync(path.join(directory, "RELEASE_NOTES.md"), "utf8").includes(
        readFileSync(
          new URL(`../../docs/releases/v${version}.md`, import.meta.url),
          "utf8",
        ).trim(),
      ),
    );
    writeFileSync(
      path.join(directory, "latest.yml"),
      "version: 0.0.1\npath: Slacord-0.0.1-x64.exe",
    );
    assert.notEqual(run().status, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("unsigned mode is explicit and partial signing credentials never pass", () => {
  const env = { ...process.env };
  for (const key of [
    "CSC_LINK",
    "CSC_KEY_PASSWORD",
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID",
    "WIN_CSC_LINK",
    "WIN_CSC_KEY_PASSWORD",
  ])
    delete env[key];
  const run = (args, extra = {}) =>
    spawnSync(
      process.execPath,
      ["scripts/check-desktop-release-secrets.mjs", ...args],
      { env: { ...env, ...extra }, encoding: "utf8" },
    ).status;
  assert.notEqual(run([]), 0);
  assert.equal(run(["--allow-unsigned"]), 0);
  assert.notEqual(
    run(["--allow-unsigned"], { CSC_LINK: "synthetic-not-a-certificate" }),
    0,
  );
});
