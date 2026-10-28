import { test, expect, type Locator, type Page } from "playwright/test";
import {
  createWorkspaceFixture,
  createAssignedIssue,
  jsonFetch,
  sendSocketMessage,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

test.setTimeout(90000);

async function startDrag(page: Page, source: Locator) {
  await source.hover();
  const box = (await source.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 12,
    box.y + box.height / 2 + 12,
    { steps: 5 },
  );
}
async function dropOn(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 15,
  });
  await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
  await page.mouse.up();
}

test("native edge drag opens alongside; cross-pane drops preserve drafts and autosave document references", async ({
  page,
}, testInfo) => {
  const f = await createWorkspaceFixture();
  await sendSocketMessage({
    session: f.actor,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "드래그 연결 근거 메시지",
  });
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs/${f.documentId}`);
  await expect(
    page.getByRole("textbox", { name: "페이지 제목" }),
  ).toBeEnabled();
  const channel = page
    .getByRole("complementary", { name: "워크스페이스 사이드바" })
    .locator(`a[href="/${f.teamId}/channel/${f.channelId}"]`);
  await startDrag(page, channel);
  const edge = page.getByTestId("workspace-edge-drop");
  await expect(edge).toBeVisible();
  await expect(edge).toHaveCSS("position", "absolute");
  await page.screenshot({ path: testInfo.outputPath("drag-preview.png") });
  await dropOn(page, edge);
  const side = page.frameLocator("iframe");
  const message = side
    .locator("[data-message-id]")
    .filter({ hasText: "드래그 연결 근거 메시지" });
  await expect(message).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/docs/${f.documentId}`));
  await expect(edge).toHaveCount(0);
  const title = await page
    .getByRole("textbox", { name: "페이지 제목" })
    .inputValue();
  const composer = side.locator("textarea").last();
  await composer.fill("기존 작성 중인 메시지");
  await startDrag(page, page.getByLabel(`${title} 연결 메뉴`, { exact: true }));
  await dropOn(page, composer);
  await expect(composer).toHaveValue(new RegExp(f.documentId));
  await expect(composer).toHaveValue(/기존 작성 중인 메시지/);
  await expect(
    side.locator("[data-message-id]").filter({ hasText: title }),
  ).toHaveCount(0);
  await message.hover();
  await startDrag(page, message.getByLabel(/대화 원문 .* 연결 메뉴/));
  await expect(edge).toBeVisible();
  await dropOn(page, page.locator(".bn-editor [data-id]").first());
  await expect(page.locator(".bn-editor a")).toHaveAttribute(
    "href",
    /message=/,
  );
  await expect
    .poll(
      async () =>
        (
          await jsonFetch<{ content: string }>(
            `/team/${f.teamId}/document/${f.documentId}`,
            { token: f.owner.token },
          )
        )?.data?.content,
    )
    .toContain("message=");
  await page.screenshot({ path: testInfo.outputPath("drag-connected.png") });
});

test("direct open button avoids the picker", async ({ page }) => {
  const f = await createWorkspaceFixture();
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs/${f.documentId}`);
  await page
    .getByRole("button", { name: "채팅 옆에 열기", exact: true })
    .click();
  await expect(
    page.frameLocator("iframe").locator("textarea").last(),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "옆에 볼 내용 선택" }),
  ).toHaveCount(0);
});

test("issue reference drag is separate from Kanban status movement", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const issueId = await createAssignedIssue({
    ...f,
    title: "연결 및 상태 이동",
  });
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/issues`);
  const card = page.locator(`[data-rfd-draggable-id="${issueId}"]`);
  await expect(card).toBeVisible();
  await startDrag(
    page,
    card.getByLabel("연결 및 상태 이동 연결 메뉴", { exact: true }),
  );
  await expect(page.getByTestId("workspace-edge-drop")).toBeVisible();
  await dropOn(page, page.getByTestId("workspace-edge-drop"));
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "연결 및 상태 이동", exact: true }),
  ).toBeVisible();
  const status = async () =>
    (
      await jsonFetch<Array<{ id: string; status: string }>>(
        `/team/${f.teamId}/issue`,
        { token: f.owner.token },
      )
    )?.data?.find((issue) => issue.id === issueId)?.status;
  expect(await status()).toBe("todo");
  await page.getByRole("button", { name: "분할 닫기" }).click();
  await expect(page.locator(".issue-board-columns")).toBeVisible();
  await expect(page.locator(".issue-board-stacked")).toBeHidden();
  const handle = card.locator("[data-rfd-drag-handle-draggable-id]");
  await expect(handle).toBeVisible();
  await handle.focus();
  await expect(handle).toBeFocused();
  await page.keyboard.press("Space");
  await expect(card).toHaveCSS("position", "fixed");
  const start = (await card.boundingBox())!;
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await card.boundingBox())!.x)
    .toBeGreaterThan(start.x + 100);
  await page.keyboard.press("Space");
  await expect.poll(status).toBe("in_progress");
});
