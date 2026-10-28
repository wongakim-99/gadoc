import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";
import { sha256, verifyPlatformEvidence } from "./lib/desktop-verification.mjs";

const [directoryArg, tag] = process.argv.slice(2);
if (!directoryArg || !/^v\d+\.\d+\.\d+$/.test(tag ?? ""))
  throw new Error("Usage: verify-desktop-platform.mjs <release-dir> <vX.Y.Z>");
const directory = path.resolve(directoryArg);
const version = tag.slice(1);
const platform =
  process.platform === "darwin"
    ? "mac"
    : process.platform === "win32"
      ? "windows"
      : null;
if (!platform) throw new Error("Run verification on the matching native OS");
const proof = {
  schemaVersion: 1,
  platform,
  version,
  codeSigned: false,
  checks: [],
  assets: [],
};
function run(command, args, env = process.env, stdoutOnly = false) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env,
    timeout: 30 * 60 * 1000,
    maxBuffer: 4 * 1024 * 1024,
  });
  // notarytool 명령 인자에는 비밀 값이 있을 수 있어 실패 시 명령 전체를 출력하지 않는다.
  if (result.status !== 0)
    throw new Error(
      `${path.basename(command)} verification failed (exit ${result.status})`,
    );
  return stdoutOnly
    ? result.stdout
    : `${result.stdout ?? ""}${result.stderr ?? ""}`;
}
function authArgs() {
  const env = process.env;
  if (env.APPLE_KEYCHAIN_PROFILE)
    return [
      "--keychain-profile",
      env.APPLE_KEYCHAIN_PROFILE,
      ...(env.APPLE_KEYCHAIN ? ["--keychain", env.APPLE_KEYCHAIN] : []),
    ];
  if (env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER)
    return [
      "--key",
      env.APPLE_API_KEY,
      "--key-id",
      env.APPLE_API_KEY_ID,
      "--issuer",
      env.APPLE_API_ISSUER,
    ];
  if (env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID)
    return [
      "--apple-id",
      env.APPLE_ID,
      "--password",
      env.APPLE_APP_SPECIFIC_PASSWORD,
      "--team-id",
      env.APPLE_TEAM_ID,
    ];
  throw new Error("Notarization credentials are required");
}
if (platform === "mac") {
  const teamId = process.env.APPLE_TEAM_ID;
  if (!/^[A-Z0-9]{10}$/.test(teamId ?? ""))
    throw new Error("APPLE_TEAM_ID is required for identity verification");
  const apps = readdirSync(directory)
    .map((name) => path.join(directory, name, "GaDoc.app"))
    .filter((file) => {
      try {
        return statSync(file).isDirectory();
      } catch {
        return false;
      }
    });
  if (apps.length !== 1)
    throw new Error("Expected exactly one packaged GaDoc.app");
  const app = apps[0];
  const appVersion = run("/usr/libexec/PlistBuddy", [
    "-c",
    "Print :CFBundleShortVersionString",
    path.join(app, "Contents/Info.plist"),
  ]).trim();
  if (appVersion !== version)
    throw new Error("Packaged app version does not match release tag");
  const dmg = path.join(directory, `GaDoc-${version}-arm64.dmg`);
  const zip = path.join(directory, `GaDoc-${version}-arm64.zip`);
  for (const [file, name] of [
    [app, "app"],
    [dmg, "dmg"],
  ]) {
    run("codesign", ["--verify", "--deep", "--strict", file]);
    const identity = run("codesign", ["--display", "--verbose=4", file]);
    if (
      !identity.includes(`TeamIdentifier=${teamId}`) ||
      !identity.includes("Authority=Developer ID Application:")
    )
      throw new Error(`Unexpected ${name} signing identity`);
    if (
      name === "app" &&
      (!identity.includes("Identifier=com.kscold.slacord") ||
        !identity.includes("runtime"))
    )
      throw new Error("App identifier or hardened runtime mismatch");
    proof.checks.push(`codesign-${name}`);
  }
  run("xcrun", ["stapler", "validate", app]);
  proof.checks.push("stapler-app");
  const submission = JSON.parse(
    run(
      "xcrun",
      [
        "notarytool",
        "submit",
        dmg,
        ...authArgs(),
        "--wait",
        "--output-format",
        "json",
      ],
      process.env,
      true,
    ),
  );
  if (submission.status !== "Accepted")
    throw new Error("Apple did not accept DMG notarization");
  run("xcrun", ["stapler", "staple", dmg]);
  run("xcrun", ["stapler", "validate", dmg]);
  proof.checks.push("stapler-dmg");
  run("spctl", ["--assess", "--type", "execute", "--verbose=2", app]);
  run("spctl", [
    "--assess",
    "--type",
    "open",
    "--context",
    "context:primary-signature",
    "--verbose=2",
    dmg,
  ]);
  proof.checks.push("gatekeeper-app", "gatekeeper-dmg");
  // ZIP도 풀어서 검사해 DMG와 다른 미서명 앱이 섞이는 것을 막는다.
  const zipDirectory = mkdtempSync(path.join(tmpdir(), "gadoc-verify-zip-"));
  try {
    run("ditto", ["-x", "-k", zip, zipDirectory]);
    const zipApp = path.join(zipDirectory, "GaDoc.app");
    run("codesign", ["--verify", "--deep", "--strict", zipApp]);
    const zippedIdentity = run("codesign", [
      "--display",
      "--verbose=4",
      zipApp,
    ]);
    const appIdentity = run("codesign", ["--display", "--verbose=4", app]);
    if (
      !zippedIdentity.includes(`TeamIdentifier=${teamId}`) ||
      zippedIdentity.match(/^CDHash=(.+)$/m)?.[1] !==
        appIdentity.match(/^CDHash=(.+)$/m)?.[1] ||
      !zippedIdentity.match(/^CDHash=(.+)$/m)
    )
      throw new Error("ZIP app signature differs from packaged app");
    run("xcrun", ["stapler", "validate", zipApp]);
    run("spctl", ["--assess", "--type", "execute", "--verbose=2", zipApp]);
    proof.checks.push("codesign-zip", "stapler-zip", "gatekeeper-zip");
  } finally {
    rmSync(zipDirectory, { recursive: true, force: true });
  }
  proof.codeSigned = true;
  proof.notarized = true;
  proof.teamId = teamId;
  proof.notarySubmissionId = submission.id;
  // DMG에 공증 티켓을 붙인 뒤 바뀐 크기·해시를 builder와 같은 YAML 의존성으로 갱신한다.
  const desktopRequire = createRequire(
    new URL("../packages/desktop/package.json", import.meta.url),
  );
  const builderRequire = createRequire(
    desktopRequire.resolve("electron-builder/package.json"),
  );
  const libRequire = createRequire(
    builderRequire.resolve("app-builder-lib/package.json"),
  );
  const yaml = libRequire("js-yaml");
  const { buildBlockMap } = libRequire("./out/targets/blockmap/blockmap.js");
  await buildBlockMap(dmg, "gzip", `${dmg}.blockmap`);
  const metadataFile = path.join(directory, "latest-mac.yml");
  const metadata = yaml.load(readFileSync(metadataFile, "utf8"));
  if (metadata.version !== version || !Array.isArray(metadata.files))
    throw new Error("Unexpected macOS update metadata");
  for (const item of metadata.files) {
    if (![path.basename(dmg), path.basename(zip)].includes(item.url))
      throw new Error("Unexpected update artifact");
    const file = path.join(directory, item.url);
    item.size = statSync(file).size;
    item.sha512 = createHash("sha512")
      .update(readFileSync(file))
      .digest("base64");
  }
  const primary = metadata.files.find((item) => item.url === metadata.path);
  if (!primary) throw new Error("Missing primary update artifact");
  metadata.sha512 = primary.sha512;
  writeFileSync(metadataFile, yaml.dump(metadata));
} else {
  const file = path.join(directory, `GaDoc-${version}-x64.exe`);
  const signature = JSON.parse(
    run(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$s=Get-AuthenticodeSignature -LiteralPath $env:GADOC_VERIFY_FILE; [pscustomobject]@{Status=$s.Status.ToString(); Thumbprint=$s.SignerCertificate.Thumbprint}|ConvertTo-Json -Compress",
      ],
      { ...process.env, GADOC_VERIFY_FILE: file },
      true,
    ),
  );
  if (!["Valid", "NotSigned"].includes(signature.Status))
    throw new Error("Invalid installer Authenticode signature");
  proof.codeSigned = signature.Status === "Valid";
  if (process.env.WIN_CSC_LINK && !proof.codeSigned)
    throw new Error("Configured Windows signature was not applied");
  if (proof.codeSigned) {
    proof.checks.push("authenticode-valid");
    proof.certificateThumbprint = signature.Thumbprint;
  }
}
const suffixes = platform === "mac" ? ["arm64.dmg", "arm64.zip"] : ["x64.exe"];
proof.assets = suffixes.map((suffix) => {
  const name = `GaDoc-${version}-${suffix}`;
  return { name, sha256: sha256(path.join(directory, name)) };
});
verifyPlatformEvidence(proof, platform, version, proof.assets);
writeFileSync(
  path.join(directory, `verification-${platform}.json`),
  JSON.stringify(proof, null, 2) + "\n",
);
console.log(`Verified native ${platform} artifacts for ${tag}`);
