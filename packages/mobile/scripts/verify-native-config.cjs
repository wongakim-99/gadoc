const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const { join, resolve } = require("node:path");

const root = resolve(__dirname, "..");
const ios = join(root, "ios");
const project = readdirSync(ios).find((name) => name.endsWith(".xcodeproj"));
assert.ok(project, "먼저 prebuild --no-install을 실행해야 함");
const projectText = readFileSync(join(ios, project, "project.pbxproj"), "utf8");
assert.match(
  projectText,
  /PRODUCT_BUNDLE_IDENTIFIER = "com\.kscold\.gadoc\.mobile"/,
);
assert.doesNotMatch(projectText, /com\.kscold\.slacord/);
const app = readdirSync(ios).find((name) => {
  try {
    return readFileSync(join(ios, name, "Info.plist"), "utf8").includes(
      "CFBundleDisplayName",
    );
  } catch {
    return false;
  }
});
assert.ok(app);
const plist = readFileSync(join(ios, app, "Info.plist"), "utf8");
assert.match(plist, /<key>NSAllowsArbitraryLoads<\/key>\s*<false\s*\/>/);
assert.doesNotMatch(plist, /<key>NSAllowsLocalNetworking<\/key>/);
assert.doesNotMatch(
  plist,
  /NSCameraUsageDescription|NSMicrophoneUsageDescription/,
);
const android = join(root, "android");
const gradle = readFileSync(join(android, "app/build.gradle"), "utf8");
const manifest = readFileSync(
  join(android, "app/src/main/AndroidManifest.xml"),
  "utf8",
);
const properties = readFileSync(join(android, "gradle.properties"), "utf8");
assert.match(gradle, /applicationId 'com\.kscold\.gadoc\.mobile'/);
assert.match(manifest, /android:usesCleartextTraffic="false"/);
assert.match(manifest, /android:allowBackup="false"/);
assert.match(manifest, /android:windowSoftInputMode="adjustResize"/);
assert.match(properties, /android\.builder\.sdkDownload=false/);
for (const permission of [
  "CAMERA",
  "RECORD_AUDIO",
  "READ_EXTERNAL_STORAGE",
  "WRITE_EXTERNAL_STORAGE",
]) {
  assert.match(
    manifest,
    new RegExp(
      `android:name="android\\.permission\\.${permission}"[^>]*tools:node="remove"`,
    ),
  );
}
process.stdout.write(
  "iOS/Android 생성 설정 검증 통과 (앱 식별자·전송 보안·권한·백업·키보드·SDK 자동설치 차단). 바이너리/기기 검증은 별도임.\n",
);
