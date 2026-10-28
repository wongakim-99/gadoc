import { test, expect } from "playwright/test";
import { io, type Socket } from "socket.io-client";
import {
  createWorkspaceFixture,
  sendSocketMessage,
  e2eApiUrl,
  type AuthSession,
  jsonFetch,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

async function connect(session: AuthSession) {
  const socket = io(`${e2eApiUrl.replace(/\/api$/, "")}/chat`, {
    path: "/socket.io",
    transports: ["websocket"],
    auth: { token: session.token },
    forceNew: true,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return socket;
}
async function react(
  socket: Socket,
  channelId: string,
  messageId: string,
  emoji: string,
) {
  const result = await socket
    .timeout(5000)
    .emitWithAck("add_reaction", { channelId, messageId, emoji });
  expect(result?.success).toBe(true);
}

test("participants open without toggling a reaction and update live across clients with keyboard access", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const message = await sendSocketMessage({
    session: f.owner,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "누가 반응했는지 확인",
  });
  const owner = await connect(f.owner),
    actor = await connect(f.actor);
  try {
    await react(owner, f.channelId, message.id, "👍");
    await react(actor, f.channelId, message.id, "👍");
    await react(actor, f.channelId, message.id, "🎉");
    await loginWithSession(page, f.owner);
    await page.goto(`/${f.teamId}/channel/${f.channelId}`);
    const row = page.locator(`#message-${message.id}`);
    const toggle = row.getByRole("button", { name: "👍 2", exact: true });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(toggle).toHaveAttribute("title", new RegExp(f.actor.username));
    const trigger = row.getByRole("button", {
      name: "리액션 참여자 보기",
      exact: true,
    });
    await trigger.focus();
    await trigger.press("Enter");
    const dialog = page.getByRole("dialog", {
      name: "리액션 참여자",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "👍 2", exact: true }).click();
    const people = dialog.getByRole("region", {
      name: "👍 참여자",
      exact: true,
    });
    await expect(
      people.getByText(f.owner.username, { exact: true }),
    ).toBeVisible();
    await expect(
      people.getByText(f.actor.username, { exact: true }),
    ).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(dialog).not.toContainText(f.owner.email);
    await expect(dialog).not.toContainText(f.actor.userId);
    await react(actor, f.channelId, message.id, "👍");
    await expect(
      people.getByText(f.actor.username, { exact: true }),
    ).toHaveCount(0);
    await expect(
      people.getByText(f.owner.username, { exact: true }),
    ).toBeVisible();
    await react(actor, f.channelId, message.id, "👍");
    await expect(
      people.getByText(f.actor.username, { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await toggle.click();
    await expect(
      row.getByRole("button", { name: "👍 1", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
  } finally {
    owner.disconnect();
    actor.disconnect();
  }
});

test("simultaneous reactions preserve both participants and removing them does not remove other emoji", async () => {
  const f = await createWorkspaceFixture();
  const message = await sendSocketMessage({
    session: f.owner,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "동시 반응 보존",
  });
  const owner = await connect(f.owner),
    actor = await connect(f.actor);
  const read = async () =>
    (await jsonFetch<{
      reactions: Array<{ emoji: string; userIds: string[] }>;
    }>(`/channel/${f.channelId}/message/${message.id}`, {
      token: f.owner.token,
    }))!.data!;
  try {
    await react(owner, f.channelId, message.id, "👀");
    await Promise.all([
      react(owner, f.channelId, message.id, "👍"),
      react(actor, f.channelId, message.id, "👍"),
    ]);
    const added = (await read()).reactions.filter(
      (reaction) => reaction.emoji === "👍",
    );
    expect(added).toHaveLength(1);
    expect([...added[0].userIds].sort()).toEqual(
      [f.owner.userId, f.actor.userId].sort(),
    );
    await Promise.all([
      react(owner, f.channelId, message.id, "👍"),
      react(actor, f.channelId, message.id, "👍"),
    ]);
    expect((await read()).reactions).toEqual([
      { emoji: "👀", userIds: [f.owner.userId] },
    ]);
  } finally {
    owner.disconnect();
    actor.disconnect();
  }
});

test("mobile thread participants recover lookup errors, handle missing profiles and use private avatars", async ({
  page,
}, info) => {
  const f = await createWorkspaceFixture();
  const parent = await sendSocketMessage({
    session: f.owner,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "답글 참여자 원문",
  });
  const reply = await sendSocketMessage({
    session: f.actor,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "답글 반응 확인",
    replyToId: parent.id,
  });
  const actor = await connect(f.actor);
  try {
    await react(actor, f.channelId, reply.id, "👍");
    await loginWithSession(page, f.owner);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${f.teamId}/channel/${f.channelId}?message=${reply.id}`);
    const thread = page.getByRole("complementary", {
      name: "스레드",
      exact: true,
    });
    const row = thread.locator(`[data-message-id="${reply.id}"]`);
    await expect(row).toHaveCount(1);
    await expect(row).toHaveCSS("box-shadow", "none");
    await expect(
      row.getByRole("button", { name: "👍 1", exact: true }),
    ).toBeVisible();
    const endpoint = `**/api/team/${f.teamId}/member`;
    await page.route(endpoint, (route) =>
      route.fulfill({
        status: 503,
        json: { success: false, message: "검증용 조회 오류" },
      }),
    );
    await row
      .getByRole("button", { name: "리액션 참여자 보기", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "리액션 참여자",
      exact: true,
    });
    await expect(dialog.getByRole("alert")).toContainText(
      "참여자 정보를 불러오지 못했습니다.",
    );
    await page.unroute(endpoint);
    await dialog
      .getByRole("button", { name: "다시 시도", exact: true })
      .click();
    await expect(
      dialog.getByText(f.actor.username, { exact: true }),
    ).toBeVisible();
    expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(390);
    await page.route(endpoint, async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      await route.fulfill({
        json: {
          ...payload,
          data: payload.data.filter(
            (member: any) => member.userId !== f.actor.userId,
          ),
        },
      });
    });
    await dialog
      .getByRole("button", { name: "참여자 새로고침", exact: true })
      .click();
    await expect(
      dialog.getByText("이름을 확인할 수 없는 멤버", { exact: true }),
    ).toBeVisible();
    await expect(dialog).not.toContainText(f.actor.userId);
    await page.unroute(endpoint);
    let imageReads = 0;
    await page.route("**/api/files?key=gadoc/test-avatar.png", (route) => {
      imageReads++;
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Znk0AAAAASUVORK5CYII=",
          "base64",
        ),
      });
    });
    await page.route(endpoint, async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      await route.fulfill({
        json: {
          ...payload,
          data: payload.data.map((member: any) =>
            member.userId === f.actor.userId
              ? {
                  ...member,
                  user: {
                    ...member.user,
                    username: "변경된 표시 이름",
                    avatarUrl: "/api/files?key=gadoc/test-avatar.png",
                  },
                }
              : member,
          ),
        },
      });
    });
    await dialog
      .getByRole("button", { name: "참여자 새로고침", exact: true })
      .click();
    await expect(
      dialog.getByText("변경된 표시 이름", { exact: true }),
    ).toBeVisible();
    await expect.poll(() => imageReads).toBe(1);
    await expect(dialog.locator("img")).toHaveCount(1);
    await page.screenshot({
      path: info.outputPath("reaction-people-mobile.png"),
    });
    await dialog
      .getByRole("button", { name: "리액션 참여자 닫기", exact: true })
      .click();
    await expect(row).toBeVisible();
  } finally {
    actor.disconnect();
  }
});
