import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  sha256,
  verifyPlatformEvidence,
} from "../lib/desktop-verification.mjs";

const version = JSON.parse(
  readFileSync(new URL("../../packages/desktop/package.json", import.meta.url)),
).version;
test("release requires all platforms and emits SHA256 plus unsigned warnings", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "gadoc-artifacts-test-"));
  const run = (args = []) =>
    spawnSync(
      process.execPath,
      [
        "scripts/verify-desktop-artifacts.mjs",
        directory,
        `v${version}`,
        ...args,
      ],
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
    assert.notEqual(run().status, 0);
    for (const platform of ["mac", "windows"]) {
      const suffixes =
        platform === "mac" ? ["arm64.dmg", "arm64.zip"] : ["x64.exe"];
      writeFileSync(
        path.join(directory, `verification-${platform}.json`),
        JSON.stringify({
          schemaVersion: 1,
          platform,
          version,
          codeSigned: false,
          ...(platform === "mac" ? { notarized: false } : {}),
          assets: suffixes.map((suffix) => {
            const name = `GaDoc-${version}-${suffix}`;
            return { name, sha256: sha256(path.join(directory, name)) };
          }),
        }),
      );
    }
    assert.equal(run().status, 0);
    assert.notEqual(run(["--require-mac-notarized"]).status, 0);
    const proof = JSON.parse(
      readFileSync(path.join(directory, "desktop-verification.json"), "utf8"),
    );
    assert.equal(proof.mac.notarized, false);
    assert.equal(proof.assets.length, 3);
    writeFileSync(
      path.join(directory, `GaDoc-${version}-arm64.dmg`),
      "changed after verification",
    );
    assert.notEqual(run().status, 0);
    writeFileSync(
      path.join(directory, `GaDoc-${version}-arm64.dmg`),
      "test installer",
    );
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
    "APPLE_API_KEY",
    "APPLE_API_KEY_ID",
    "APPLE_API_ISSUER",
    "APPLE_KEYCHAIN_PROFILE",
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
  assert.notEqual(run(["--allow-unsigned", "--require-mac-notarized"]), 0);
  assert.notEqual(
    run(["--allow-unsigned"], { CSC_LINK: "synthetic-not-a-certificate" }),
    0,
  );
  const signing = {
    CSC_LINK: "synthetic-certificate",
    CSC_KEY_PASSWORD: "synthetic-password",
    APPLE_TEAM_ID: "TESTTEAM01",
  };
  assert.equal(
    run(["--target=mac"], {
      ...signing,
      APPLE_ID: "review@example.invalid",
      APPLE_APP_SPECIFIC_PASSWORD: "synthetic-password",
    }),
    0,
  );
  assert.equal(
    run(["--target=mac"], {
      ...signing,
      APPLE_API_KEY: "synthetic-path",
      APPLE_API_KEY_ID: "TESTKEY",
      APPLE_API_ISSUER: "synthetic-issuer",
    }),
    0,
  );
  assert.notEqual(
    run(["--target=mac"], { ...signing, APPLE_API_KEY: "partial-only" }),
    0,
  );
  assert.equal(
    run(["--target=mac"], {
      ...signing,
      APPLE_KEYCHAIN_PROFILE: "local-profile",
    }),
    0,
  );
});

test("notarization proof requires matching files and every native check", () => {
  const assets = [{ name: "GaDoc-test.dmg", sha256: "a".repeat(64) }];
  const proof = {
    schemaVersion: 1,
    version,
    platform: "mac",
    codeSigned: true,
    notarized: true,
    teamId: "TESTTEAM01",
    notarySubmissionId: "00000000-0000-4000-8000-000000000000",
    checks: [
      "codesign-app",
      "codesign-dmg",
      "codesign-zip",
      "gatekeeper-app",
      "gatekeeper-dmg",
      "gatekeeper-zip",
      "stapler-app",
      "stapler-dmg",
      "stapler-zip",
    ],
    assets,
  };
  assert.equal(verifyPlatformEvidence(proof, "mac", version, assets), proof);
  for (const changed of [
    { ...proof, version: "0.0.0" },
    { ...proof, teamId: undefined },
    { ...proof, checks: ["codesign-app"] },
    { ...proof, notarySubmissionId: undefined },
    { ...proof, codeSigned: false },
    { ...proof, assets: [] },
  ])
    assert.throws(() =>
      verifyPlatformEvidence(changed, "mac", version, assets),
    );
  assert.throws(() =>
    verifyPlatformEvidence(proof, "mac", version, [
      { ...assets[0], sha256: "b".repeat(64) },
    ]),
  );
  assert.throws(() =>
    verifyPlatformEvidence(
      {
        schemaVersion: 1,
        version,
        platform: "windows",
        codeSigned: true,
        assets,
      },
      "windows",
      version,
      assets,
    ),
  );
});
