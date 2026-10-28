import { expect, test } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

const layoutSelector =
  '.bn-block:has(> .bn-react-node-view-renderer > [data-content-type="documentColumns"]) > .bn-block-group';

test("a column can contain the existing live database without creating a second source on reload", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await createWorkspaceFixture();
  await loginWithSession(page, fixture.owner);
  await page.goto(`/${fixture.teamId}/docs/${fixture.documentId}`);
  await expect(page.locator(".bn-editor")).toContainText("문서 검증 본문");
  await page.getByRole("button", { name: "2열 배치", exact: true }).click();
  const column = page
    .locator(layoutSelector)
    .locator(":scope > .bn-block-outer")
    .first();
  await column.locator('[data-content-type="paragraph"]').last().click();
  await page.keyboard.type("/database");
  await page
    .getByRole("option", {
      name: "데이터베이스 빈 데이터베이스 추가",
      exact: true,
    })
    .click();
  const database = column.locator("[data-inline-database]");
  await expect(database.getByRole("table")).toBeVisible();
  const id = await database.getAttribute("data-inline-database");
  expect(id).not.toBe("new");
  await expect
    .poll(
      async () =>
        (
          await jsonFetch<{ content: string }>(
            `/team/${fixture.teamId}/document/${fixture.documentId}`,
            { token: fixture.owner.token },
          )
        )?.data?.content ?? "",
    )
    .toContain(id!);
  await page.reload();
  await expect(database.getByRole("table")).toBeVisible();
  await expect(database).toHaveAttribute("data-inline-database", id!);
  await expect(page.locator("[data-inline-database]")).toHaveCount(1);
});

test("columns are one live document: peer edits, persistence, responsive layout and read-only access", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const fixture = await createWorkspaceFixture();
  const context = await browser.newContext();
  const other = await context.newPage();
  const path = `/${fixture.teamId}/docs/${fixture.documentId}`;
  try {
    await loginWithSession(page, fixture.owner);
    await loginWithSession(other, fixture.actor);
    await page.goto(path);
    await other.goto(path);
    await expect(page.locator(".bn-editor")).toContainText("문서 검증 본문");
    await expect(other.locator(".bn-editor")).toContainText("문서 검증 본문");
    await page.getByRole("button", { name: "2열 배치", exact: true }).click();
    const layout = page.locator(layoutSelector);
    const peerLayout = other.locator(layoutSelector);
    await expect(layout.locator(":scope > .bn-block-outer")).toHaveCount(2);
    await expect(peerLayout.locator(":scope > .bn-block-outer")).toHaveCount(2);
    const columns = layout.locator(":scope > .bn-block-outer");
    const left = await columns.nth(0).boundingBox();
    const right = await columns.nth(1).boundingBox();
    expect(right!.x).toBeGreaterThan(left!.x + left!.width);
    expect(Math.abs(right!.y - left!.y)).toBeLessThan(5);
    await columns
      .nth(0)
      .locator('[data-content-type="paragraph"]')
      .last()
      .click();
    await page.keyboard.insertText("OWNER-COLUMN");
    await expect(peerLayout).toContainText("OWNER-COLUMN");
    await context.setOffline(true);
    await peerLayout
      .locator(":scope > .bn-block-outer")
      .nth(1)
      .locator('[data-content-type="paragraph"]')
      .last()
      .click();
    await other.keyboard.insertText("PEER-OFFLINE-COLUMN");
    await columns
      .nth(0)
      .getByRole("button", { name: "이 열에 문단 추가" })
      .click();
    await page.keyboard.insertText("SECOND-PARAGRAPH");
    await context.setOffline(false);
    await expect(layout).toContainText("PEER-OFFLINE-COLUMN");
    await expect(peerLayout).toContainText("SECOND-PARAGRAPH");
    await expect
      .poll(
        async () =>
          (
            await jsonFetch<{ content: string }>(
              `/team/${fixture.teamId}/document/${fixture.documentId}`,
              { token: fixture.owner.token },
            )
          )?.data?.content ?? "",
      )
      .toContain("PEER-OFFLINE-COLUMN");
    await page.reload();
    await expect(layout).toContainText("OWNER-COLUMN");
    await expect(layout).toContainText("SECOND-PARAGRAPH");
    await expect(page.locator(".bn-editor")).toContainText("문서 검증 본문");
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileColumns = layout.locator(":scope > .bn-block-outer");
    const top = await mobileColumns.nth(0).boundingBox();
    const bottom = await mobileColumns.nth(1).boundingBox();
    expect(bottom!.y).toBeGreaterThanOrEqual(top!.y + top!.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "/tmp/gadoc-document-columns-mobile.png",
      fullPage: true,
    });
    await jsonFetch(`/team/${fixture.teamId}/document/${fixture.documentId}`, {
      method: "PATCH",
      token: fixture.owner.token,
      body: { editPolicy: "owner_admin" },
    });
    await other.reload();
    await expect(
      other.locator('.bn-editor[contenteditable="false"]'),
    ).toContainText("OWNER-COLUMN");
    await expect(
      other.getByRole("button", { name: "2열 배치", exact: true }),
    ).toHaveCount(0);
    await expect(
      peerLayout.getByRole("button", { name: "이 열에 문단 추가" }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("document picker keeps insertion position, retries failure and only offers authorized documents", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const fixture = await createWorkspaceFixture();
  const source = await jsonFetch<{ id: string }>(
    `/team/${fixture.teamId}/document`,
    {
      method: "POST",
      token: fixture.owner.token,
      body: {
        title: "연결할 가이드",
        content: "원본은 유지됩니다.",
        contentFormat: "plain",
      },
    },
  );
  const privateDocument = await jsonFetch<{ id: string }>(
    `/team/${fixture.teamId}/document`,
    {
      method: "POST",
      token: fixture.owner.token,
      body: {
        title: "비공개 운영 자료",
        content: "private",
        contentFormat: "plain",
      },
    },
  );
  await jsonFetch(
    `/team/${fixture.teamId}/document/${privateDocument!.data!.id}`,
    {
      method: "PATCH",
      token: fixture.owner.token,
      body: { visibility: "restricted", allowedViewerIds: [] },
    },
  );
  await loginWithSession(page, fixture.actor);
  await page.goto(`/${fixture.teamId}/docs/${fixture.documentId}`);
  await expect(page.locator(".bn-editor")).toContainText("문서 검증 본문");
  await page.getByRole("button", { name: "3열 배치", exact: true }).click();
  const layout = page.locator(layoutSelector);
  const target = layout.locator(":scope > .bn-block-outer").nth(1);
  await target.locator('[data-content-type="paragraph"]').click();
  const selectedBlockId = await target
    .locator('[data-content-type="paragraph"]')
    .evaluate((element) =>
      element.closest("[data-id]")?.getAttribute("data-id"),
    );
  await expect
    .poll(() =>
      page.evaluate(() =>
        window
          .getSelection()
          ?.anchorNode?.parentElement?.closest("[data-id]")
          ?.getAttribute("data-id"),
      ),
    )
    .toBe(selectedBlockId);
  await page.route(
    `**/team/${fixture.teamId}/document`,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "목록 일시 중단" }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "문서 링크", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "문서 링크 추가" });
  await expect(picker.getByRole("alert")).toBeVisible();
  await picker.getByRole("button", { name: "다시 시도" }).click();
  await expect(
    picker.getByRole("button", { name: /연결할 가이드/ }),
  ).toBeVisible();
  await expect(picker.getByText("비공개 운영 자료")).toHaveCount(0);
  await picker.getByRole("button", { name: /연결할 가이드/ }).click();
  await expect(picker).toHaveCount(0);
  await expect(
    target.getByRole("link", { name: "연결할 가이드" }),
  ).toHaveAttribute("href", `/${fixture.teamId}/docs/${source!.data!.id}`);
  await expect
    .poll(
      async () =>
        (
          await jsonFetch<{ content: string }>(
            `/team/${fixture.teamId}/document/${fixture.documentId}`,
            { token: fixture.owner.token },
          )
        )?.data?.content ?? "",
    )
    .toContain(source!.data!.id);
  await page.reload();
  await expect(
    target.getByRole("link", { name: "연결할 가이드" }),
  ).toBeVisible();
  await expect(page.locator(".bn-editor")).toContainText("문서 검증 본문");
  await page.screenshot({
    path: "/tmp/gadoc-document-columns-desktop.png",
    fullPage: true,
  });
});

test("hub creation makes a real editable page without changing existing documents; slash inserts layouts", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const fixture = await createWorkspaceFixture();
  await loginWithSession(page, fixture.owner);
  await page.goto(`/${fixture.teamId}/docs`);
  await page
    .getByRole("button", { name: "문서 허브 만들기", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "페이지 제목" })).toHaveValue(
    "문서 허브",
  );
  const layout = page.locator(layoutSelector);
  await expect(layout.locator(":scope > .bn-block-outer")).toHaveCount(3);
  await expect(layout).toContainText("자료");
  await expect(layout).toContainText("업무");
  await page.getByRole("button", { name: "배치 아래에 문단 추가" }).click();
  await page.keyboard.type("/2열");
  await page.getByRole("option", { name: /2열 배치/ }).click();
  await expect(page.locator(layoutSelector)).toHaveCount(2);
  const existing = await jsonFetch<{ content: string }>(
    `/team/${fixture.teamId}/document/${fixture.documentId}`,
    { token: fixture.owner.token },
  );
  expect(existing?.data?.content).toContain("문서 검증 본문");
});

test("document link captures the visible column before a pending native selection event is processed", async ({
  page,
}) => {
  const fixture = await createWorkspaceFixture();
  const source = await jsonFetch<{ id: string }>(
    `/team/${fixture.teamId}/document`,
    {
      method: "POST",
      token: fixture.owner.token,
      body: {
        title: "빠른 선택 링크",
        content: "원본",
        contentFormat: "plain",
      },
    },
  );
  await loginWithSession(page, fixture.owner);
  await page.goto(`/${fixture.teamId}/docs/${fixture.documentId}`);
  await expect(page.locator(".bn-editor")).toContainText("문서 검증 본문");
  await page.getByRole("button", { name: "3열 배치", exact: true }).click();
  const target = page
    .locator(layoutSelector)
    .locator(":scope > .bn-block-outer")
    .nth(1);
  await target
    .locator('[data-content-type="paragraph"]')
    .evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      // Browsers queue selectionchange. Open synchronously to exercise that boundary.
      const toolbar = document.querySelector('[aria-label="페이지 구성"]')!;
      Array.from(toolbar.querySelectorAll("button"))
        .find((button) => button.textContent?.trim() === "문서 링크")!
        .click();
    });
  const picker = page.getByRole("dialog", { name: "문서 링크 추가" });
  await picker.getByRole("button", { name: /빠른 선택 링크/ }).click();
  await expect(
    target.getByRole("link", { name: "빠른 선택 링크", exact: true }),
  ).toHaveAttribute("href", `/${fixture.teamId}/docs/${source!.data!.id}`);
});
