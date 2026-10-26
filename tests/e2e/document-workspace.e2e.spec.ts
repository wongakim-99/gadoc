import { test, expect, type Page } from "playwright/test";

// UI integration tests use synthetic API responses, never production data.
async function fixture(page: Page, canEdit = true, invalidContent = false) {
  let doc = {
    id: "page-1",
    teamId: "review-team",
    title: "팀 시작 가이드",
    parentId: "root-1",
    content: JSON.stringify([
      {
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
  if (invalidContent) doc.content = '{invalid-json';
  let failNextSave = true;
  const writes: Record<string, unknown>[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path === "/api/team/review-team/document/page-1") {
      if (route.request().method() === "PATCH") {
        const payload = route.request().postDataJSON();
        writes.push(payload);
        if (failNextSave) {
          failNextSave = false;
          return route.fulfill({
            status: 503,
            json: { success: false, message: "시험용 저장 실패" },
          });
        }
        doc = { ...doc, ...payload, updatedAt: "2026-10-26T01:00:00Z" };
      }
      data = doc;
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
  return { writes };
}

test("page navigation, Korean slash menu, save failure/retry and reload", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const { writes } = await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/review-team/docs/page-1");
  await expect(
    page.getByRole("heading", { name: "팀 시작 가이드" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "페이지 경로" }).getByText("팀 위키"),
  ).toBeVisible();
  await page.getByRole("button", { name: "페이지 탐색", exact: true }).click();
  await page
    .getByRole("button", { name: "팀 위키 하위 페이지 펼치기" })
    .click();
  await expect(page.locator('a[aria-current="page"]')).toContainText(
    "팀 시작 가이드",
  );
  await expect(page.getByTestId('document-content')).toContainText('함께 일하는 방법');
  await page.screenshot({
    path: testInfo.outputPath("document-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "편집", exact: true }).click();
  const editor = page.locator('.bn-editor[contenteditable="true"]');
  await expect(editor).toBeVisible();
  await editor.click();
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
  await page
    .getByRole("textbox", { name: "페이지 제목" })
    .fill("수정된 시작 가이드");
  await page.keyboard.press("Control+s");
  await expect(
    page.getByRole("alert").filter({ hasText: "시험용 저장 실패" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "페이지 제목" })).toHaveValue(
    "수정된 시작 가이드",
  );
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "수정된 시작 가이드" }),
  ).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[1].contentFormat).toBe("json");
  expect(Array.isArray(JSON.parse(writes[1].content as string))).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "수정된 시작 가이드" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('malformed JSON cannot overwrite the stored document', async ({ page }) => {
  const { writes } = await fixture(page, true, true);
  await page.goto('/review-team/docs/page-1?edit=1');
  await expect(page.getByRole('alert').filter({ hasText: '본문을 편집기로 불러오지 못했습니다' })).toBeVisible();
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await page.keyboard.press('Control+s');
  expect(writes).toHaveLength(0);
});

test("read-only page at mobile width has no edit action or horizontal overflow", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, false);
  await page.goto("/review-team/docs/page-1");
  await expect(page.getByTestId('document-content')).toContainText('함께 일하는 방법');
  await expect(
    page.getByRole("heading", { name: "팀 시작 가이드" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "편집", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "아카이브", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("document-mobile.png"),
    fullPage: true,
  });
});
