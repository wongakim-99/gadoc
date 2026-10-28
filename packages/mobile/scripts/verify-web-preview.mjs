import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Uses the repository's existing Playwright and an already installed browser.
// Never installs browsers or contacts production: every external request is intercepted.
const require = createRequire(
  new URL("../../../package.json", import.meta.url),
);
const { chromium } = require("playwright");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist/web");
const captures = resolve(root, "../../docs/mobile/assets");
const date = "2026-10-28T01:00:00.000Z";
const user = {
  id: "user-preview",
  username: "가독 팀원",
  email: "preview@example.test",
  avatarUrl: null,
};
const team = {
  id: "team-preview",
  name: "가독 디자인 팀",
  slug: "preview",
  description: "대화가 다음 일로 이어지는 곳",
  memberCount: 8,
};
const document = {
  id: "doc-preview",
  teamId: team.id,
  title: "새로운 팀원의 첫 일주일",
  parentId: null,
  contentFormat: "json",
  updatedAt: date,
};
const issue = {
  id: "issue-preview",
  teamId: team.id,
  title: "모바일에서 팀의 흐름 이어가기",
  description:
    "## 이번 주에 함께할 일\n\n작은 화면에서도 **맥락을 놓치지 않도록**, 필요한 정보를 차분하게 정리해요.\n\n- [x] 팀의 대화 확인하기\n- [ ] 문서와 다음 할 일 이어 보기",
  status: "in_progress",
  priority: "high",
  assigneeIds: [user.id],
  labels: ["모바일", "디자인"],
  updatedAt: date,
};
const content = JSON.stringify([
  {
    type: "heading",
    props: { level: 2 },
    content: [{ type: "text", text: "함께 일하는 방식부터" }],
  },
  {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "팀 문서를 손안에서. 중요한 맥락을 읽고, 대화에 참여하고, 다음 할 일을 확인하세요.",
      },
    ],
  },
  {
    type: "heading",
    props: { level: 3 },
    content: [{ type: "text", text: "첫날 체크리스트" }],
  },
  {
    type: "checkListItem",
    props: { checked: true },
    content: [{ type: "text", text: "워크스페이스와 팀 채널 둘러보기" }],
  },
  {
    type: "checkListItem",
    props: { checked: false },
    content: [{ type: "text", text: "이번 주 이슈와 담당자 확인하기" }],
  },
  {
    type: "quote",
    content: [
      { type: "text", text: "좋은 기록은 다음 대화를 가볍게 만듭니다." },
    ],
  },
]);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const target = resolve(
      dist,
      `.${decodeURIComponent(pathname === "/" ? "/index.html" : pathname)}`,
    );
    if (!target.startsWith(`${dist}${sep}`)) throw new Error("invalid path");
    response.writeHead(200, {
      "Content-Type": types[extname(target)] || "application/octet-stream",
    });
    response.end(await readFile(target));
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  const origin = `http://127.0.0.1:${server.address().port}`;
  let errors = 0;
  page.on("pageerror", () => errors++);
  page.on("console", (event) => {
    if (event.type() === "error") errors++;
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.origin !== "https://gadoc.kr" || !url.pathname.startsWith("/api/"))
      return route.abort();
    const path = url.pathname.slice(4);
    const data =
      path === "/auth/login"
        ? { accessToken: "synthetic-preview", user }
        : path === "/auth/me"
          ? user
          : path === "/team"
            ? [team]
            : path.endsWith("/channel")
              ? [
                  {
                    id: "channel-preview",
                    teamId: team.id,
                    name: "일반",
                    type: "public",
                    description: "일상의 대화와 팀의 소식",
                    unreadCount: 3,
                  },
                ]
              : path.endsWith("/member")
                ? [{ userId: user.id, role: "member", user }]
                : path.endsWith("/document/doc-preview")
                  ? { ...document, content, canEdit: false, canDelete: false }
                  : path.endsWith("/document")
                    ? [document]
                    : path.endsWith("/issue")
                      ? [issue]
                      : undefined;
    return route.fulfill({
      status: route.request().method() === "OPTIONS" ? 204 : 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
      body:
        route.request().method() === "OPTIONS"
          ? ""
          : JSON.stringify({ success: true, data }),
    });
  });
  await page.routeWebSocket("**/*", (socket) => socket.close());
  await mkdir(captures, { recursive: true });
  await page.goto(origin);
  await page
    .getByRole("button", { name: "이메일로 로그인", exact: true })
    .waitFor();
  await page.screenshot({ path: resolve(captures, "login-web-preview.png") });
  await page.getByLabel("이메일", { exact: true }).fill(user.email);
  await page.getByLabel("비밀번호", { exact: true }).fill("synthetic-password");
  await page
    .getByRole("button", { name: "이메일로 로그인", exact: true })
    .click();
  try {
    await page
      .getByRole("button", { name: /가독 디자인 팀/ })
      .waitFor({ timeout: 5_000 });
  } catch {
    await page.screenshot({ path: resolve(dist, "verification-failure.png") });
    throw new Error(
      "합성 로그인 후 팀 목록을 표시하지 못함. dist/web/verification-failure.png 확인 필요.",
    );
  }
  await page.getByRole("button", { name: /가독 디자인 팀/ }).click();
  await page.getByRole("tab", { name: "문서", exact: true }).click();
  await page.getByRole("button", { name: /새로운 팀원의 첫 일주일/ }).click();
  await page.getByText("함께 일하는 방식부터", { exact: true }).waitFor();
  await page.screenshot({
    path: resolve(captures, "document-web-preview.png"),
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "‹ 뒤로", exact: true }).click();
  await page.getByRole("tab", { name: "이슈", exact: true }).click();
  await page
    .getByRole("button", { name: /모바일에서 팀의 흐름 이어가기/ })
    .click();
  await page.getByText("이번 주에 함께할 일", { exact: true }).waitFor();
  await page.screenshot({ path: resolve(captures, "issue-web-preview.png") });
  assert.equal(
    await page.evaluate(
      () => window.localStorage.length + window.sessionStorage.length,
    ),
    0,
  );
  assert.equal((await context.cookies()).length, 0);
  assert.equal(errors, 0);
  console.log(
    "Web preview verified: native UI login → workspace → document/issue reading, 390px layout, no persistent browser credentials. Synthetic screenshots saved.",
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
