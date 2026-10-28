import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (file) => readFileSync(path.join(root, file), "utf8");
const manifest = (file) => JSON.parse(read(file));
const packageFiles = [
  "package.json",
  ...readdirSync(path.join(root, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}/package.json`)
    .filter((file) => existsSync(path.join(root, file))),
];

test("자체 패키지의 독점 라이선스와 게시 차단 표기를 유지한다", () => {
  assert.ok(packageFiles.length > 1);
  // 외부 의존성의 라이선스는 각 라이브러리의 원래 조건을 유지한다.
  for (const file of packageFiles) {
    const pkg = manifest(file);
    assert.equal(pkg.license, "UNLICENSED", `${file}: license`);
    assert.equal(pkg.private, true, `${file}: private`);
  }
});

test("README와 LICENSE에 실제 소유권과 허가 조건을 명시한다", () => {
  const readme = read("README.md");
  const license = read("LICENSE");
  assert.match(readme, /^# 가독 GaDoc/m);
  assert.match(readme, /MIT 라이선스가 아닙니다/);
  assert.match(readme, /kscold.*Colding/);
  assert.match(readme, /\[LICENSE\]\(\.\/LICENSE\)/);
  assert.match(license, /Copyright \(c\) \d{4} kscold .*Colding/);
  assert.match(license, /All rights reserved\./);
  assert.match(license, /prior written permission/);
});

test("제품 이름과 기존 데스크톱 호환성 식별자를 함께 유지한다", () => {
  const desktop = manifest("packages/desktop/package.json");
  assert.equal(desktop.build.productName, "GaDoc");
  assert.equal(desktop.build.appId, "com.kscold.slacord");
  assert.match(desktop.build.copyright, /kscold.*Colding/);
  assert.match(desktop.build.copyright, /All rights reserved/);
});

test("주요 안내 문서의 저장소 내부 링크가 실제 경로를 가리킨다", () => {
  for (const file of ["README.md", "CONTRIBUTING.md", "docs/desktop-app.md"]) {
    for (const match of read(file).matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
      const target = match[1];
      if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("#"))
        continue;
      assert.ok(!target.startsWith("/"), `${file}: 로컬 절대 경로 ${target}`);
      const resolved = path.resolve(
        root,
        path.dirname(file),
        target.split("#")[0],
      );
      assert.ok(existsSync(resolved), `${file}: 없는 링크 ${target}`);
    }
  }
});

test("README에 안내한 pnpm 명령이 루트 스크립트에 존재한다", () => {
  const scripts = manifest("package.json").scripts;
  for (const match of read("README.md").matchAll(
    /\bpnpm ([a-z][a-z\d-]*:[a-z\d:-]+)/g,
  )) {
    assert.ok(scripts[match[1]], `없는 명령: pnpm ${match[1]}`);
  }
});
