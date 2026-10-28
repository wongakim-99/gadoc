import { test, expect, type Page } from "playwright/test";
import {
  createWorkspaceFixture,
  jsonFetch,
  sendSocketMessage,
  type WorkspaceFixture,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

async function message(f: WorkspaceFixture, id: string) {
  return (await jsonFetch<{
    content: string;
    mentions: string[];
    reactions: Array<{ emoji: string }>;
  }>(`/channel/${f.channelId}/message/${id}`, { token: f.owner.token }))!.data!;
}
async function inbox(f: WorkspaceFixture) {
  return (await jsonFetch<
    Array<{ id: string; resourceId: string; type: string }>
  >(`/team/${f.teamId}/notification`, { token: f.actor.token }))!.data!;
}
async function openChat(page: Page, f: WorkspaceFixture) {
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/channel/${f.channelId}`);
  await expect(
    page.getByRole("button", { name: "채널 참여자 2명 보기" }),
  ).toBeVisible();
}

test("reaction picker searches a local catalog, supports the keyboard and restores focus without toggling on dismissal", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const sent = await sendSocketMessage({
    session: f.owner,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "리액션 선택창 확인",
  });
  await openChat(page, f);
  const row = page.locator(`#message-${sent.id}`);
  await row.focus();
  await row.getByRole("button", { name: "리액션", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "리액션 선택", exact: true });
  await expect(
    picker.getByRole("searchbox", { name: "이모지 검색" }),
  ).toBeFocused();
  await picker.getByRole("searchbox").fill(":thumbsup:");
  await picker.getByRole("searchbox").press("ArrowDown");
  await expect(picker.getByRole("button", { name: "👍 좋아요" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(picker).toHaveCount(0);
  await expect(
    row.getByRole("button", { name: "👍 1", exact: true }),
  ).toBeVisible();
  const add = row.getByRole("button", { name: "리액션 추가", exact: true });
  await add.click();
  await picker.getByRole("button", { name: "표정", exact: true }).click();
  await expect(picker.locator("[data-emoji]")).toHaveCount(37);
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(add).toBeFocused();
  expect((await message(f, sent.id)).reactions).toEqual([
    expect.objectContaining({ emoji: "👍" }),
  ]);
  await add.click();
  await picker.getByRole("searchbox").fill("없는이모지검색");
  await expect(picker.getByText("다른 이름으로 검색해보세요.")).toBeVisible();
  await page.screenshot({ path: "/tmp/gadoc-reaction-picker-desktop.png" });
  await page.locator("header.workspace-topbar h2").click();
  await expect(picker).toHaveCount(0);
});

test("channel participants are readable, searchable and scoped to a private room on a phone", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const privateRoom = (await jsonFetch<{ id: string }>(
    `/team/${f.teamId}/channel`,
    {
      method: "POST",
      token: f.owner.token,
      body: { name: "private-people", type: "private", memberIds: [] },
    },
  ))!.data!;
  await page.setViewportSize({ width: 390, height: 844 });
  await openChat(page, f);
  const trigger = page.getByRole("button", { name: "채널 참여자 2명 보기" });
  await trigger.click();
  const people = page.getByRole("dialog", {
    name: "채널 참여자 2명",
    exact: true,
  });
  await expect(
    people.getByRole("textbox", { name: "채널 참여자 검색" }),
  ).toBeFocused();
  await expect(
    people.getByText(f.actor.username, { exact: true }),
  ).toBeVisible();
  await expect(people).not.toContainText(f.actor.email);
  await people.getByRole("textbox").fill(f.actor.username);
  await expect(people.getByRole("listitem")).toHaveCount(1);
  await page.screenshot({ path: "/tmp/gadoc-channel-members-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.goto(`/${f.teamId}/channel/${privateRoom.id}`);
  await page.getByRole("button", { name: "채널 참여자 1명 보기" }).click();
  await expect(
    page.getByRole("dialog", { name: "채널 참여자 1명", exact: true }),
  ).not.toContainText(f.actor.username);
});

test("editing a message selects a mention without saving early and notifies only a newly added person", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const sent = await sendSocketMessage({
    session: f.owner,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "편집 전 메시지",
  });
  await openChat(page, f);
  const row = page.locator(`#message-${sent.id}`);
  await row.focus();
  await row.getByRole("button", { name: "편집", exact: true }).click();
  const edit = row.getByRole("textbox", { name: "메시지 수정" });
  await edit.fill(`편집 @${f.actor.username}`);
  await expect(page.getByRole("listbox", { name: "멘션 대상" })).toContainText(
    f.actor.username,
  );
  await edit.press("Enter");
  await expect(edit).toBeVisible();
  await expect(edit).toHaveValue(`편집 @${f.actor.username} `);
  expect((await message(f, sent.id)).content).toBe("편집 전 메시지");
  await edit.press("Enter");
  await expect(edit).toHaveCount(0);
  await expect
    .poll(async () => (await message(f, sent.id)).mentions)
    .toEqual([f.actor.userId]);
  await expect
    .poll(
      async () =>
        (await inbox(f)).filter((entry) => entry.resourceId === sent.id).length,
    )
    .toBe(1);
  await row.focus();
  await row.getByRole("button", { name: "편집", exact: true }).click();
  await edit.fill(`내용만 수정 @${f.actor.username} `);
  await edit.press("Enter");
  await expect(edit).toHaveCount(0);
  expect(
    (await inbox(f)).filter((entry) => entry.resourceId === sent.id),
  ).toHaveLength(1);
});

test("thread composer and reply editing share person and broadcast mentions while private nonmembers are excluded", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const parent = await sendSocketMessage({
    session: f.owner,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "답글 멘션 원문",
  });
  await openChat(page, f);
  const row = page.locator(`#message-${parent.id}`);
  await row.focus();
  await row.getByRole("button", { name: "스레드", exact: true }).click();
  const thread = page.getByRole("complementary", {
    name: "스레드",
    exact: true,
  });
  const composer = thread.locator("textarea").last();
  await composer.fill(`답글 @${f.actor.username}`);
  await page
    .getByRole("option", { name: new RegExp(f.actor.username) })
    .click();
  await composer.press("Enter");
  const candidate = thread
    .locator("[data-message-id]")
    .filter({ hasText: `답글 @${f.actor.username}` });
  await expect(candidate).toBeVisible();
  const replyId = (await candidate.getAttribute("data-message-id"))!;
  const reply = thread.locator(`[data-message-id="${replyId}"]`);
  await expect
    .poll(async () => (await message(f, replyId)).mentions)
    .toEqual([f.actor.userId]);
  await reply.focus();
  await reply.getByRole("button", { name: "편집", exact: true }).click();
  const edit = reply.getByRole("textbox", { name: "메시지 수정" });
  await edit.fill("전체 확인 @전체");
  await page.getByRole("option", { name: /전체 이 채널/ }).click();
  await edit.press("Enter");
  await expect(edit).toHaveCount(0);
  await expect
    .poll(async () => (await message(f, replyId)).content)
    .toBe("전체 확인 @all");
  const privateRoom = (await jsonFetch<{ id: string }>(
    `/team/${f.teamId}/channel`,
    {
      method: "POST",
      token: f.owner.token,
      body: { name: "private-mentions", type: "private", memberIds: [] },
    },
  ))!.data!;
  const isolated = await sendSocketMessage({
    session: f.owner,
    teamId: f.teamId,
    channelId: privateRoom.id,
    content: `@all @${f.actor.username}`,
  });
  expect(isolated.mentions).toEqual([]);
  expect(
    (await inbox(f)).some((entry) => entry.resourceId === isolated.id),
  ).toBe(false);
});

test("delete-all uses an app dialog, preserves notifications on failure and retries without a native prompt", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const sent = await sendSocketMessage({
    session: f.actor,
    teamId: f.teamId,
    channelId: f.channelId,
    content: `삭제 확인 @${f.owner.username}`,
  });
  let nativeDialogs = 0;
  page.on("dialog", async (dialog) => {
    nativeDialogs++;
    await dialog.dismiss();
  });
  let deletes = 0;
  let release: (() => void) | undefined;
  await page.route(`**/api/team/${f.teamId}/notification`, async (route) => {
    if (route.request().method() !== "DELETE") return route.continue();
    deletes++;
    if (deletes === 1) {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "temporary failure" }),
      });
    }
    return route.continue();
  });
  await openChat(page, f);
  await page
    .getByRole("button", { name: /알림.*읽지 않음/ })
    .first()
    .click();
  const panel = page.getByRole("dialog", { name: "알림", exact: true });
  await expect(panel).toContainText(`삭제 확인 @${f.owner.username}`);
  const clear = panel.getByRole("button", { name: "전체 삭제", exact: true });
  await clear.click();
  const confirm = page.getByRole("dialog", {
    name: "내 알림을 모두 삭제할까요?",
    exact: true,
  });
  await expect(confirm.getByRole("button", { name: "취소" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await expect(clear).toBeFocused();
  expect(deletes).toBe(0);
  await clear.click();
  await confirm.getByRole("button", { name: "모두 삭제", exact: true }).click();
  await expect(
    confirm.getByRole("button", { name: "처리 중..." }),
  ).toBeDisabled();
  await expect.poll(() => deletes).toBe(1);
  release!();
  await expect(confirm.getByRole("alert")).toContainText("목록은 유지");
  await expect(panel).toContainText(`삭제 확인 @${f.owner.username}`);
  await confirm.getByRole("button", { name: "모두 삭제", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(panel.getByText("알림이 없습니다.")).toBeVisible();
  expect(deletes).toBe(2);
  expect(nativeDialogs).toBe(0);
  expect((await message(f, sent.id)).content).toContain("삭제 확인");
});

test("the thread reaction picker fits a narrow viewport and sends a reaction after search", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const parent = await sendSocketMessage({
    session: f.owner,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "모바일 이모지 원문",
  });
  const reply = await sendSocketMessage({
    session: f.owner,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "모바일 이모지 답글",
    replyToId: parent.id,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await openChat(page, f);
  const parentRow = page.locator(`#message-${parent.id}`);
  await parentRow.focus();
  await parentRow.getByRole("button", { name: "스레드", exact: true }).click();
  const row = page.locator(`#thread-message-${reply.id}`);
  await row.focus();
  await row.getByRole("button", { name: "리액션", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "리액션 선택", exact: true });
  const search = picker.getByRole("searchbox", { name: "이모지 검색" });
  await expect(search).toBeFocused();
  await picker.getByRole("button", { name: "표정", exact: true }).click();
  await expect(picker.locator("[data-emoji]").first()).toBeVisible();
  const box = (await picker.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(7);
  expect(box.y).toBeGreaterThanOrEqual(7);
  expect(box.x + box.width).toBeLessThanOrEqual(383);
  expect(box.y + box.height).toBeLessThanOrEqual(837);
  await page.screenshot({ path: "/tmp/gadoc-reaction-picker-mobile.png" });
  await search.fill("테스트");
  await picker.getByRole("button", { name: "🧪 테스트", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "🧪 1", exact: true }),
  ).toBeVisible();
});

test("a failed message edit keeps the draft and only persists the mention after retry", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const sent = await sendSocketMessage({
    session: f.owner,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "실패 복구 원문",
  });
  await openChat(page, f);
  const row = page.locator(`#message-${sent.id}`);
  await row.focus();
  await row.getByRole("button", { name: "편집", exact: true }).click();
  let failed = false;
  await page.route(
    `**/api/channel/${f.channelId}/message/${sent.id}`,
    async (route) => {
      if (route.request().method() !== "PATCH" || failed)
        return route.continue();
      failed = true;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "잠시 후 다시 시도해 주세요.",
        }),
      });
    },
  );
  const edit = row.getByRole("textbox", { name: "메시지 수정" });
  await edit.fill(`유지할 초안 @${f.actor.username} `);
  await edit.press("Enter");
  await expect(row.getByRole("alert")).toBeVisible();
  await expect(edit).toHaveValue(`유지할 초안 @${f.actor.username} `);
  expect((await message(f, sent.id)).content).toBe("실패 복구 원문");
  expect((await inbox(f)).some((entry) => entry.resourceId === sent.id)).toBe(
    false,
  );
  await edit.press("Enter");
  await expect(edit).toHaveCount(0);
  await expect
    .poll(async () => (await message(f, sent.id)).mentions)
    .toEqual([f.actor.userId]);
});
