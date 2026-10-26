import { test, expect, type Page } from "playwright/test";

// Synthetic API integration tests. Live MongoDB is verified separately.
async function fixture(
  page: Page,
  options: {
    canEdit?: boolean;
    invalidContent?: boolean;
    failFirst?: boolean;
    delayMs?: number;
  } = {},
) {
  const canEdit = options.canEdit ?? true;
  let doc = {
    id: "page-1",
    teamId: "review-team",
    title: "팀 시작 가이드",
    parentId: "root-1",
    content: options.invalidContent
      ? "{invalid-json"
      : JSON.stringify([
          {
            id: "intro",
            type: "paragraph",
            content: "함께 일하는 방법을 이 페이지에 정리하세요.",
          },
        ]),
    contentFormat: "json",
    canEdit,
    canDelete: canEdit,
    visibility: "team",
    createdBy: "review-user",
    updatedBy: "review-user",
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-26T00:00:00Z",
  };
  let failNext = options.failFirst ?? false;
  const writes: Record<string, unknown>[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path === "/api/team/review-team/document/page-1") {
      if (route.request().method() === "PATCH") {
        const payload = route.request().postDataJSON();
        writes.push(payload);
        maxInFlight = Math.max(maxInFlight, ++inFlight);
        if (options.delayMs)
          await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        inFlight--;
        if (failNext) {
          failNext = false;
          return route.fulfill({
            status: 503,
            json: { success: false, message: "시험용 저장 실패" },
          });
        }
        doc = {
          ...doc,
          ...payload,
          updatedAt: new Date(
            Date.UTC(2026, 9, 26, 1, 0, writes.length),
          ).toISOString(),
        };
      }
      data = doc;
    } else if (path === "/api/team/review-team/document/root-1") {
      data = { ...doc, id: "root-1", title: "팀 위키", parentId: null };
    } else if (path === "/api/team/review-team/document") {
      data = [{ ...doc, id: "root-1", title: "팀 위키", parentId: null }, doc];
    } else if (path === "/api/auth/me") {
      data = {
        id: "review-user",
        username: "검토 사용자",
        email: "review@example.test",
      };
    } else if (path.endsWith("/member")) {
      data = [
        {
          userId: "review-user",
          username: "검토 사용자",
          role: canEdit ? "owner" : "guest",
        },
      ];
    } else if (
      path === "/api/team/review-team" ||
      path === "/api/team/review-team/settings"
    ) {
      const target = {
        enabled: false,
        relayAnnouncements: false,
        relayGithub: false,
        hasWebhookUrl: false,
        webhookUrl: "",
      };
      data = {
        id: "review-team",
        name: "검토 워크스페이스",
        slug: "review-team",
        memberCount: 1,
        activeInviteCount: 0,
        githubConfig: null,
        bridgeConfig: { slack: target, discord: target },
      };
    }
    await route.fulfill({ json: { success: true, data } });
  });
  return { writes, concurrency: () => maxInFlight };
}

const editor = (page: Page) =>
  page.locator('.bn-editor[contenteditable="true"]');

test("workspace shell stays mounted and aligned across every area", async ({
  page,
}, testInfo) => {
  await fixture(page);
  await open(page);
  const sidebar = page.getByRole("complementary", {
    name: "워크스페이스 사이드바",
  });
  const modules = sidebar.getByRole("navigation", {
    name: "워크스페이스 영역",
    exact: true,
  });
  await sidebar.evaluate((element) =>
    element.setAttribute("data-shell-probe", "retained"),
  );
  const initial = await modules.boundingBox();
  for (const [label, path] of [
    ["이슈", "issues"],
    ["공지", "announcements"],
    ["채팅", "channel"],
    ["홈", ""],
    ["문서", "docs"],
  ]) {
    await modules.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/review-team${path ? "/" + path : ""}$`),
    );
    await expect(
      modules.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "location");
    await expect(sidebar).toHaveAttribute("data-shell-probe", "retained");
    expect(await modules.boundingBox()).toEqual(initial);
    expect(
      await sidebar.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).toBe("rgb(32, 32, 32)");
    expect(
      await page
        .locator("main")
        .evaluate(
          (element) => getComputedStyle(element.parentElement!).backgroundColor,
        ),
    ).toBe("rgb(25, 25, 25)");
    if (path === "channel")
      await expect(sidebar.getByText("아직 채널이 없습니다.")).toBeVisible();
    if (path === "issues")
      await page.screenshot({
        path: testInfo.outputPath("workspace-issues.png"),
      });
  }
  await sidebar.getByRole("link", { name: "설정", exact: true }).click();
  await expect(
    sidebar.getByRole("link", { name: "설정", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(await modules.boundingBox()).toEqual(initial);
  await sidebar
    .getByRole("button", { name: "사이드바 접기", exact: true })
    .click();
  expect((await sidebar.boundingBox())?.width).toBe(64);
  await modules.getByRole("link", { name: "이슈", exact: true }).click();
  await expect(page).toHaveURL(/\/issues$/);
  expect((await sidebar.boundingBox())?.width).toBe(64);
  await sidebar
    .getByRole("button", { name: "사이드바 펼치기", exact: true })
    .click();
  expect((await sidebar.boundingBox())?.width).toBe(256);
});

test("mobile workspace navigation closes on area changes and exposes contextual actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await open(page);
  const toggle = page.getByRole("button", {
    name: "워크스페이스 탐색",
    exact: true,
  });
  const navigation = page.locator("#workspace-navigation");
  await toggle.click();
  await navigation.getByRole("link", { name: "채팅", exact: true }).click();
  await expect(page).toHaveURL(/\/channel$/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(
    navigation.getByRole("button", { name: "+ DM / 소그룹 열기", exact: true }),
  ).toBeVisible();
  await navigation.getByRole("link", { name: "이슈", exact: true }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(
    navigation.getByRole("link", { name: "+ 이슈 만들기", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
const saveStatus = (page: Page) => page.locator('header [role="status"]');

async function open(page: Page) {
  await page.goto("/review-team/docs/page-1");
  await expect(
    page.getByRole("textbox", { name: "페이지 제목" }),
  ).toBeEnabled();
  await expect(editor(page)).toContainText("함께 일하는 방법");
}

test("immediate editing, autosave failure/retry, sidebar title and reload", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const { writes } = await fixture(page, { failFirst: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  await expect(
    page.getByRole("button", { name: "편집", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "저장", exact: true }),
  ).toHaveCount(0);
  // Observe beyond the debounce to ensure normalizing/loading blocks does not create a version.
  await page.waitForTimeout(900);
  expect(writes).toHaveLength(0);
  const sidebar = page.getByRole("complementary", {
    name: "워크스페이스 사이드바",
  });
  await expect(sidebar.locator('a[aria-current="page"]')).toContainText(
    "팀 시작 가이드",
  );
  await expect(
    sidebar.getByRole("button", { name: "팀 위키 하위 페이지 접기" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("document-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("textbox", { name: "페이지 제목" })
    .fill("자동 저장된 시작 가이드");
  await expect(
    page.getByRole("alert").filter({ hasText: "시험용 저장 실패" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "페이지 제목" })).toHaveValue(
    "자동 저장된 시작 가이드",
  );
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(saveStatus(page)).toHaveText("저장됨");
  await expect(sidebar.locator('a[aria-current="page"]')).toContainText(
    "자동 저장된 시작 가이드",
  );
  expect(writes).toHaveLength(2);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "페이지 제목" })).toHaveValue(
    "자동 저장된 시작 가이드",
  );
  await expect(editor(page)).toBeVisible();
  await editor(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  await expect(page.locator(".bn-suggestion-menu")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("document-slash-menu.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("Saved body without a button");
  await expect(saveStatus(page)).toHaveText("저장됨");
  await page.reload();
  await expect(editor(page)).toContainText("Saved body without a button");
  expect(errors).toEqual([]);
});

test("typing during a slow save preserves the newest draft and editor instance", async ({
  page,
}) => {
  const { writes, concurrency } = await fixture(page, { delayMs: 1400 });
  await open(page);
  await page.getByRole("textbox", { name: "페이지 제목" }).fill("First title");
  await expect(saveStatus(page)).toHaveText("저장 중…");
  await editor(page).evaluate((element) => {
    element.setAttribute("data-instance-proof", "same-editor");
  });
  await page.getByRole("textbox", { name: "페이지 제목" }).fill("Newest title");
  await editor(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Latest body");
  await expect(saveStatus(page)).toHaveText("저장됨");
  await expect(page.getByRole("textbox", { name: "페이지 제목" })).toHaveValue(
    "Newest title",
  );
  await expect(editor(page)).toHaveAttribute(
    "data-instance-proof",
    "same-editor",
  );
  expect(concurrency()).toBe(1);
  expect(writes.at(-1)?.title).toBe("Newest title");
  expect(writes.at(-1)?.content).toContain("Latest body");
});

test("navigation flushes a pending edit before leaving", async ({ page }) => {
  const { writes } = await fixture(page, { delayMs: 500 });
  await open(page);
  await page
    .getByRole("textbox", { name: "페이지 제목" })
    .fill("이동 전에 저장");
  await page
    .getByRole("navigation", { name: "페이지 경로" })
    .getByRole("link", { name: "팀 위키" })
    .click();
  await expect(page).toHaveURL(/\/docs\/root-1$/);
  expect(writes.at(-1)?.title).toBe("이동 전에 저장");
});

test('child creation stops when the parent cannot be saved', async ({ page }) => {
  await fixture(page, { failFirst: true });
  let creations = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/team/review-team/document') creations++;
  });
  await open(page);
  await page.getByRole('textbox', { name: '페이지 제목', exact: true }).fill('저장 실패 초안');
  await page.getByRole('button', { name: '하위 페이지 추가', exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/page-1$/);
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible();
  expect(creations).toBe(0);
});

test("malformed JSON cannot be autosaved over the stored document", async ({
  page,
}) => {
  const { writes } = await fixture(page, { invalidContent: true });
  await page.goto("/review-team/docs/page-1");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "본문을 편집기로 불러오지 못했습니다" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "페이지 제목" }),
  ).toBeDisabled();
  await page.waitForTimeout(900);
  expect(writes).toHaveLength(0);
});

test("mobile navigation and read-only page", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { writes } = await fixture(page, { canEdit: false });
  await page.goto("/review-team/docs/page-1");
  await expect(page.getByTestId("document-content")).toContainText(
    "함께 일하는 방법",
  );
  await expect(
    page.getByRole("heading", { name: "팀 시작 가이드" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "페이지 제목" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "아카이브", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: '하위 페이지 추가', exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "워크스페이스 탐색", exact: true })
    .click();
  await expect(
    page
      .locator("#workspace-navigation")
      .getByRole("link", { name: "문서", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "워크스페이스 탐색", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("document-mobile.png"),
    fullPage: true,
  });
  expect(writes).toHaveLength(0);
});
