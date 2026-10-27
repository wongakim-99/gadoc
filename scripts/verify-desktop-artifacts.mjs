import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const [directory, tag] = process.argv.slice(2);
if (!directory || !/^v\d+\.\d+\.\d+$/.test(tag ?? ""))
  throw new Error("Usage: verify-desktop-artifacts.mjs <directory> <vX.Y.Z>");
const version = tag.slice(1);
const manifest = JSON.parse(
  readFileSync(
    new URL("../packages/desktop/package.json", import.meta.url),
    "utf8",
  ),
);
if (version !== manifest.version || manifest.build.productName !== "GaDoc")
  throw new Error("Installer manifest/tag mismatch");
const required = [
  `GaDoc-${version}-arm64.dmg`,
  `GaDoc-${version}-arm64.zip`,
  `GaDoc-${version}-x64.exe`,
  "latest-mac.yml",
  "latest.yml",
];
for (const file of required) {
  if (
    !statSync(path.join(directory, file)).isFile() ||
    statSync(path.join(directory, file)).size === 0
  )
    throw new Error(`Missing installer: ${file}`);
}
for (const name of ["latest-mac.yml", "latest.yml"]) {
  const metadata = readFileSync(path.join(directory, name), "utf8");
  if (
    !metadata.includes(`version: ${version}`) ||
    metadata.includes("Slacord-") ||
    !metadata.includes(`GaDoc-${version}-`)
  )
    throw new Error(`Invalid update metadata: ${name}`);
}
const assets = readdirSync(directory)
  .filter((file) => /\.(dmg|zip|exe|blockmap|yml)$/.test(file))
  .sort();
const checksums = assets
  .map(
    (file) =>
      `${createHash("sha256")
        .update(readFileSync(path.join(directory, file)))
        .digest("hex")}  ${file}`,
  )
  .join("\n");
writeFileSync(path.join(directory, "SHA256SUMS.txt"), checksums + "\n");
const mac = process.env.GADOC_MAC_SIGNED === "1",
  win = process.env.GADOC_WINDOWS_SIGNED === "1";
writeFileSync(
  path.join(directory, "RELEASE_NOTES.md"),
  `# GaDoc ${tag}\n\n가독 GaDoc. 서비스 주소는 https://slacord.cloud 그대로입니다.\n\n- 기존 문서 안의 데이터베이스와 AI MCP 연결\n- 문서 공동 편집과 참여자 표시\n- 웹·데스크톱 중복 알림 방지 및 UI 정리\n\n## 설치 전 확인\n\nmacOS: ${mac ? "코드 서명 및 공증 적용" : "코드 서명·공증 없음. Gatekeeper 경고 또는 설치 차단이 발생할 수 있습니다."}\nWindows: ${win ? "코드 서명 적용" : "코드 서명 없음. SmartScreen 경고가 발생할 수 있습니다."}\n\n공식 릴리즈에서 받은 파일의 SHA256을 SHA256SUMS.txt와 비교하세요. 시스템 보안 설정을 일괄 해제하지 마세요. 설치가 차단되면 웹 버전을 이용할 수 있습니다. macOS는 최신 DMG를 통한 수동 설치를 사용합니다.\n\n기존 설치의 로그인/환경 설정 및 업데이트 식별자는 호환성을 유지합니다. 새 설치의 앱 이름과 기본 설치 폴더는 GaDoc입니다.\n`,
);
console.log(`Verified ${assets.length} artifacts for ${tag}`);
