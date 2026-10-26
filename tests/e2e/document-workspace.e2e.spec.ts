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
    } else if (path === "/api/team/review-team") {
      data = { id: "review-team", name: "검토 워크스페이스" };
    }
    await route.fulfill({ json: { success: true, data } });
  });
  return { writes, concurrency: () => maxInFlight };
}

const editor = (page: Page) =>
  page.locator('.bn-editor[contenteditable="true"]');
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
  const sidebar = page.getByRole("complementary", { name: "문서 사이드바" });
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
  await page.locator("summary").click();
  await expect(
    page
      .locator("details[open]")
      .getByRole("link", { name: "문서", exact: true }),
  ).toBeVisible();
  await page.locator("summary").click();
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
