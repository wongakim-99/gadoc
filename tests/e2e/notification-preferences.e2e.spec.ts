import { expect, test, type Page } from "playwright/test";
import { mongo } from "mongoose";
import {
  createChannel,
  createWorkspaceFixture,
  e2eApiUrl,
  jsonFetch,
  sendSocketMessage,
  type AuthSession,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import type {
  NotificationPreference,
  UpdateNotificationPreference,
} from "../../packages/web/src/entities/notification/types";

const kinds = [
  "mention",
  "thread",
  "issue",
  "document",
  "chat",
  "update",
] as const;
const allKinds = Object.fromEntries(kinds.map((kind) => [kind, true]));
const preferencePath = (teamId: string) =>
  `/team/${teamId}/notification/preferences`;
async function preferences(teamId: string, user: AuthSession) {
  return (await jsonFetch<NotificationPreference>(preferencePath(teamId), {
    token: user.token,
  }))!.data!;
}
async function save(
  teamId: string,
  user: AuthSession,
  patch: Omit<UpdateNotificationPreference, "revision">,
) {
  const { revision } = await preferences(teamId, user);
  return (await jsonFetch<NotificationPreference>(preferencePath(teamId), {
    token: user.token,
    method: "PATCH",
    body: { ...patch, revision },
  }))!.data!;
}
async function raw(
  teamId: string,
  token: string | null,
  path: string,
  body?: unknown,
) {
  return fetch(`${e2eApiUrl}/team/${teamId}/notification${path}`, {
    method:
      body === undefined ? "GET" : path === "/preferences" ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function claim(teamId: string, user: AuthSession, key: string) {
  return (await jsonFetch<{ deliver: boolean }>(
    `/team/${teamId}/notification/delivery-claim`,
    {
      token: user.token,
      method: "POST",
      body: { key },
    },
  ))!.data!.deliver;
}
async function verificationDb() {
  const value = process.env.SLACORD_NOTIFICATION_VERIFY_MONGO_URI;
  if (!value)
    throw new Error(
      "This test requires SLACORD_NOTIFICATION_VERIFY_MONGO_URI for the dedicated verification DB.",
    );
  const uri = new URL(value);
  const api = new URL(e2eApiUrl);
  if (
    uri.hostname !== "127.0.0.1" ||
    uri.port !== "27127" ||
    uri.pathname !== "/gadoc_notification_verify" ||
    api.hostname !== "127.0.0.1" ||
    api.port !== "18096"
  )
    throw new Error(
      "Refusing to modify a database outside notification verification.",
    );
  const client = await new mongo.MongoClient(value).connect();
  return { client, db: client.db("gadoc_notification_verify") };
}

test("API persists user/workspace/channel scopes, restores login and rejects conflicting writes", async () => {
  test.setTimeout(90_000);
  const f = await createWorkspaceFixture();
  expect(await preferences(f.teamId, f.owner)).toEqual({
    mode: "all",
    kinds: allKinds,
    channelModes: {},
    channelKinds: {},
    revision: 0,
  });
  const contenders = await Promise.all(
    Array.from({ length: 8 }, () =>
      raw(f.teamId, f.owner.token, "/preferences", {
        revision: 0,
        mode: "mentions",
        kinds: { chat: false },
      }),
    ),
  );
  expect(contenders.filter((response) => response.ok)).toHaveLength(1);
  expect(contenders.filter((response) => response.status === 409)).toHaveLength(
    7,
  );
  const b = await createChannel({
    teamId: f.teamId,
    token: f.owner.token,
    name: `other-${Date.now()}`,
  });
  await save(f.teamId, f.owner, {
    channelId: f.channelId,
    mode: "off",
    kinds: { mention: false },
  });
  await save(f.teamId, f.owner, {
    channelId: b,
    mode: "all",
    kinds: { thread: false },
  });
  const revision = (await preferences(f.teamId, f.owner)).revision;
  const writes = await Promise.all([
    raw(f.teamId, f.owner.token, "/preferences", {
      revision,
      channelId: b,
      kinds: { issue: false },
    }),
    raw(f.teamId, f.owner.token, "/preferences", {
      revision,
      channelId: b,
      kinds: { document: false },
    }),
  ]);
  expect(writes.map((response) => response.status).sort()).toEqual([200, 409]);
  const saved = await preferences(f.teamId, f.owner);
  expect(saved.channelModes).toEqual({ [f.channelId]: "off", [b]: "all" });
  expect(saved.channelKinds[f.channelId]).toEqual({ mention: false });
  expect(saved.channelKinds[b].thread).toBe(false);
  expect(Object.keys(saved.channelKinds[b])).toHaveLength(2);
  expect((await preferences(f.teamId, f.actor)).revision).toBe(0);
  const other = (await jsonFetch<{ id: string }>("/team", {
    method: "POST",
    token: f.owner.token,
    body: { name: "알림 격리 검증", slug: `notification-${Date.now()}` },
  }))!.data!;
  expect((await preferences(other.id, f.owner)).revision).toBe(0);
  const login = (await jsonFetch<{ accessToken: string }>("/auth/login", {
    method: "POST",
    body: { email: f.owner.email, password: f.owner.password },
  }))!.data!;
  expect(
    await preferences(f.teamId, { ...f.owner, token: login.accessToken }),
  ).toEqual(saved);
  const reset = await save(f.teamId, f.owner, { channelId: b, reset: true });
  expect(reset.channelModes).toEqual({ [f.channelId]: "off" });
  expect(reset.channelKinds).toEqual({ [f.channelId]: { mention: false } });
  expect(reset.kinds.chat).toBe(false);
  expect((await raw(f.teamId, null, "/preferences")).status).toBe(401);
  expect((await raw(other.id, f.actor.token, "/preferences")).status).toBe(403);
  expect(
    (
      await raw(other.id, f.owner.token, "/preferences", {
        revision: 0,
        channelId: b,
        mode: "off",
      })
    ).status,
  ).toBe(404);
  for (const invalid of [
    { mode: "inherit" },
    { kinds: { chat: "false" } },
    { kinds: { unknown: true } },
    { kinds: { mention: "inherit" } },
    { reset: true },
  ]) {
    expect(
      (
        await raw(f.teamId, f.owner.token, "/preferences", {
          revision: reset.revision,
          ...invalid,
        })
      ).status,
    ).toBe(400);
  }
});

test("all six categories gate delivery, retain inbox data and recheck revoked private metadata", async () => {
  test.setTimeout(90_000);
  test.skip(
    !process.env.SLACORD_NOTIFICATION_VERIFY_MONGO_URI,
    "전용 알림 검증 DB에서만 자료 권한 철회 fixture를 작성합니다.",
  );
  const { client, db } = await verificationDb();
  try {
    const f = await createWorkspaceFixture();
    const parent = await sendSocketMessage({
      session: f.owner,
      teamId: f.teamId,
      channelId: f.channelId,
      content: "답글 원문",
    });
    const messages = {
      chat: await sendSocketMessage({
        session: f.actor,
        teamId: f.teamId,
        channelId: f.channelId,
        content: "일반 활동",
      }),
      thread: await sendSocketMessage({
        session: f.actor,
        teamId: f.teamId,
        channelId: f.channelId,
        content: "답글 활동",
        replyToId: parent.id,
      }),
      mention: await sendSocketMessage({
        session: f.actor,
        teamId: f.teamId,
        channelId: f.channelId,
        content: `멘션 @${f.owner.username}`,
        replyToId: parent.id,
      }),
    };
    const issue = (await jsonFetch<{ id: string }>(`/team/${f.teamId}/issue`, {
      method: "POST",
      token: f.actor.token,
      body: {
        title: "알림 종류 검증",
        priority: "medium",
        assigneeIds: [f.owner.userId],
      },
    }))!.data!;
    const fixtureNotices = kinds.map((kind) => ({
      _id: new mongo.ObjectId(),
      teamId: f.teamId,
      recipientId: f.owner.userId,
      actorId: f.actor.userId,
      actorName: f.actor.username,
      content: `검증 ${kind}`,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      channelId: f.channelId,
      resourceType: ["mention", "thread", "chat"].includes(kind)
        ? "message"
        : kind === "document"
          ? "document"
          : "issue",
      resourceId:
        kind === "mention" || kind === "thread" || kind === "chat"
          ? messages[kind].id
          : kind === "document"
            ? f.documentId
            : issue.id,
      type:
        kind === "document"
          ? "document_assigned"
          : kind === "issue"
            ? "issue_assigned"
            : kind === "update"
              ? "issue_updated"
              : kind === "thread"
                ? "thread_reply"
                : "mention",
    }));
    // Assignment/update fixtures exercise stored legacy event types; no public API can create an arbitrary notice.
    await db.collection("notifications").insertMany(fixtureNotices);
    const ids = fixtureNotices.map((notice) => notice._id);
    const countBefore = await db
      .collection("notifications")
      .countDocuments({ _id: { $in: ids }, isRead: false });
    for (const [index, kind] of kinds.entries()) {
      await save(f.teamId, f.owner, {
        mode: "all",
        kinds: { ...allKinds, [kind]: false },
      });
      const key = `notification:${fixtureNotices[index]._id}`;
      expect(await claim(f.teamId, f.owner, key)).toBe(false);
      if (kind === "mention" || kind === "thread" || kind === "chat")
        expect(
          await claim(f.teamId, f.owner, `message:${messages[kind].id}`),
        ).toBe(false);
      await save(f.teamId, f.owner, {
        channelId: f.channelId,
        kinds: { [kind]: true },
      });
      expect(await claim(f.teamId, f.owner, key)).toBe(true);
      if (kind === "mention" || kind === "thread" || kind === "chat")
        expect(
          await claim(f.teamId, f.owner, `message:${messages[kind].id}`),
        ).toBe(false);
      await save(f.teamId, f.owner, { channelId: f.channelId, reset: true });
    }
    expect(
      await db
        .collection("notifications")
        .countDocuments({ _id: { $in: ids }, isRead: false }),
    ).toBe(countBefore);
    await save(f.teamId, f.owner, { mode: "off" });
    const persisted = await db
      .collection("notification_preferences")
      .findOne({ teamId: f.teamId, userId: f.owner.userId });
    expect(persisted?.mode).toBe("off");
    expect(persisted?.kinds).toEqual(
      (await preferences(f.teamId, f.owner)).kinds,
    );
    const inbox = (await jsonFetch<any[]>(`/team/${f.teamId}/notification`, {
      token: f.owner.token,
    }))!.data!;
    expect(inbox.map((notice) => notice.id)).toEqual(
      expect.arrayContaining(ids.map(String)),
    );

    const privateRoom = (await jsonFetch<{ id: string }>(
      `/team/${f.teamId}/channel`,
      {
        method: "POST",
        token: f.owner.token,
        body: {
          name: `secret-${Date.now()}`,
          type: "private",
          memberIds: [f.actor.userId],
        },
      },
    ))!.data!;
    await save(f.teamId, f.actor, {
      channelId: privateRoom.id,
      mode: "mentions",
      kinds: { mention: false },
    });
    const secret = await sendSocketMessage({
      session: f.owner,
      teamId: f.teamId,
      channelId: privateRoom.id,
      content: `PRIVATE-CONTENT @${f.actor.username}`,
    });
    await expect
      .poll(async () =>
        (await jsonFetch<any[]>(`/team/${f.teamId}/notification`, {
          token: f.actor.token,
        }))!.data!.some((notice) => notice.resourceId === secret.id),
      )
      .toBe(true);
    const privateNotice = (await db.collection("notifications").findOne({
      teamId: f.teamId,
      recipientId: f.actor.userId,
      resourceId: secret.id,
    }))!;
    const revoke = await db
      .collection("channels")
      .updateOne(
        { _id: new mongo.ObjectId(privateRoom.id), teamId: f.teamId },
        { $pull: { memberIds: f.actor.userId } } as any,
      );
    expect(revoke.modifiedCount).toBe(1);
    const filtered = await preferences(f.teamId, f.actor);
    expect(JSON.stringify(filtered)).not.toContain(privateRoom.id);
    expect(
      JSON.stringify(
        await jsonFetch(`/team/${f.teamId}/notification`, {
          token: f.actor.token,
        }),
      ),
    ).not.toContain("PRIVATE-CONTENT");
    expect(
      (await jsonFetch<{ count: number }>(
        `/team/${f.teamId}/notification/unread-count`,
        { token: f.actor.token },
      ))!.data!.count,
    ).toBe(0);
    expect(await claim(f.teamId, f.actor, `message:${secret.id}`)).toBe(false);
    expect(
      await claim(f.teamId, f.actor, `notification:${privateNotice._id}`),
    ).toBe(false);
    expect(
      (
        await raw(f.teamId, f.actor.token, "/preferences", {
          revision: filtered.revision,
          channelId: privateRoom.id,
          mode: "all",
        })
      ).status,
    ).toBe(404);
    expect(
      await db
        .collection("notifications")
        .findOne({ _id: privateNotice._id, isRead: false }),
    ).not.toBeNull();
  } finally {
    await client.close();
  }
});

test("settings and channel header expose real controls, inheritance, reset, conflict recovery and login restoration", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const f = await createWorkspaceFixture();
  await loginWithSession(page, f.owner);
  const url = `/${f.teamId}/settings?section=notifications`;
  await page.goto(url);
  const workspace = page.getByRole("region", {
    name: "워크스페이스 알림 정책",
  });
  await expect(
    workspace.getByRole("checkbox", { name: "워크스페이스 멘션", exact: true }),
  ).toBeChecked();
  await workspace
    .getByRole("checkbox", { name: "워크스페이스 멘션", exact: true })
    .uncheck();
  await workspace
    .getByRole("button", { name: "알림 설정 저장", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toContainText("저장했습니다");
  await expect(
    page.getByRole("heading", { name: "이 기기의 알림 권한" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "알림을 설정할 채팅방" })
    .selectOption(f.channelId);
  const room = page.getByRole("region", { name: "이 방 알림 정책" });
  await expect(
    room.getByRole("combobox", { name: "이 방 멘션", exact: true }),
  ).toHaveValue("inherit");
  await room
    .getByRole("combobox", { name: "이 방 멘션", exact: true })
    .selectOption("on");
  await room
    .getByRole("combobox", { name: "이 방 알림 방식", exact: true })
    .selectOption("mentions");
  await room
    .getByRole("button", { name: "알림 설정 저장", exact: true })
    .click();
  await expect(room.getByRole("status")).toContainText("저장했습니다");
  const other = await context.newPage();
  await other.goto(url);
  const second = other.getByRole("region", { name: "워크스페이스 알림 정책" });
  await expect(
    second.getByRole("checkbox", { name: "워크스페이스 멘션", exact: true }),
  ).not.toBeChecked();
  await save(f.teamId, f.owner, { kinds: { chat: false } });
  await second
    .getByRole("checkbox", { name: "워크스페이스 멘션", exact: true })
    .check();
  await second
    .getByRole("button", { name: "알림 설정 저장", exact: true })
    .click();
  await expect(second.getByRole("alert")).toContainText("다른 창");
  await expect(
    second.getByRole("checkbox", { name: "워크스페이스 멘션", exact: true }),
  ).toBeChecked();
  await expect(
    second.getByRole("button", { name: "알림 설정 저장", exact: true }),
  ).toBeDisabled();
  other.once("dialog", (dialog) => dialog.accept());
  await second.getByRole("button", { name: "최신 설정 다시 불러오기" }).click();
  await expect(
    second.getByRole("checkbox", {
      name: "워크스페이스 일반 채팅·DM",
      exact: true,
    }),
  ).not.toBeChecked();
  await other.close();
  await page.goto(`/${f.teamId}/channel/${f.channelId}`);
  await page
    .getByRole("button", { name: "이 채팅방 알림 설정", exact: true })
    .click();
  const popover = page.getByRole("dialog", {
    name: "이 채팅방 알림 설정",
    exact: true,
  });
  await expect(
    popover.getByRole("combobox", { name: "이 방 멘션", exact: true }),
  ).toHaveValue("on");
  await popover
    .getByRole("button", { name: "이 방의 모든 예외 초기화", exact: true })
    .click();
  await expect(popover.getByRole("status")).toContainText("초기화했습니다");
  await expect(
    popover.getByRole("combobox", { name: "이 방 멘션", exact: true }),
  ).toHaveValue("inherit");
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await context.clearCookies();
  await loginWithSession(page, f.owner);
  await page.goto(url);
  await expect(
    workspace.getByRole("checkbox", { name: "워크스페이스 멘션", exact: true }),
  ).not.toBeChecked();
  await expect(
    workspace.getByRole("checkbox", {
      name: "워크스페이스 일반 채팅·DM",
      exact: true,
    }),
  ).not.toBeChecked();
});

async function instrumentDelivery(page: Page, native: boolean) {
  await page.addInitScript((isNative) => {
    const deliveries: string[] = [];
    (window as any).__notificationDeliveries = deliveries;
    if (isNative)
      (window as any).slacordDesktop = {
        isDesktop: true,
        platform: "linux",
        notify: async (_title: string, body: string) => {
          deliveries.push(body);
          return true;
        },
        setBadgeCount: async () => true,
      };
    else {
      class BrowserNotification {
        static permission = "granted";
        constructor(_title: string, options: { body: string }) {
          deliveries.push(options.body);
        }
        close() {}
      }
      (window as any).Notification = BrowserNotification;
      Object.defineProperty(document, "visibilityState", {
        get: () => "hidden",
      });
      document.hasFocus = () => false;
    }
  }, native);
}

for (const native of [false, true])
  test(`${native ? "desktop bridge" : "browser OS"} obeys saved mute on chat and inbox sockets`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const f = await createWorkspaceFixture();
    await instrumentDelivery(page, native);
    await loginWithSession(page, f.owner);
    await save(f.teamId, f.owner, { kinds: { mention: false } });
    await page.goto(`/${f.teamId}/channel/${f.channelId}`);
    await expect(
      page.getByRole("button", { name: "이 채팅방 알림 설정", exact: true }),
    ).toBeVisible();
    const deniedClaim = page.waitForResponse(
      (response) =>
        response.url().includes("/notification/delivery-claim") &&
        response.request().method() === "POST",
    );
    const muted = await sendSocketMessage({
      session: f.actor,
      teamId: f.teamId,
      channelId: f.channelId,
      content: `MUTED @${f.owner.username}`,
    });
    expect((await (await deniedClaim).json()).data.deliver).toBe(false);
    await expect
      .poll(async () =>
        (await jsonFetch<any[]>(`/team/${f.teamId}/notification`, {
          token: f.owner.token,
        }))!.data!.some(
          (notice) => notice.resourceId === muted.id && !notice.isRead,
        ),
      )
      .toBe(true);
    expect(
      await page.evaluate(() => (window as any).__notificationDeliveries),
    ).toEqual([]);
    await save(f.teamId, f.owner, {
      channelId: f.channelId,
      kinds: { mention: true },
    });
    const body = `ALLOWED @${f.owner.username}`;
    await sendSocketMessage({
      session: f.actor,
      teamId: f.teamId,
      channelId: f.channelId,
      content: body,
    });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__notificationDeliveries.filter((value: string) =>
              value.includes("ALLOWED"),
            ).length,
        ),
      )
      .toBe(1);
    await save(f.teamId, f.owner, { mode: "off" });
    const offClaim = page.waitForResponse(
      (response) =>
        response.url().includes("/notification/delivery-claim") &&
        response.request().method() === "POST",
    );
    await sendSocketMessage({
      session: f.actor,
      teamId: f.teamId,
      channelId: f.channelId,
      content: `WORKSPACE-OFF @${f.owner.username}`,
    });
    expect((await (await offClaim).json()).data.deliver).toBe(false);
    expect(
      await page.evaluate(() =>
        (window as any).__notificationDeliveries.some((value: string) =>
          value.includes("WORKSPACE-OFF"),
        ),
      ),
    ).toBe(false);
  });

test("load/save failures preserve choices and a late room response cannot replace another room on a phone", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const f = await createWorkspaceFixture();
  const b = await createChannel({
    teamId: f.teamId,
    token: f.owner.token,
    name: `second-${Date.now()}`,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await loginWithSession(page, f.owner);
  let failLoad = true;
  let failedSave = false;
  let holdSave = false;
  let release: (() => void) | undefined;
  await page.route(
    `**/api/team/${f.teamId}/notification/preferences`,
    async (route) => {
      if (route.request().method() === "GET" && failLoad) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "load failure" }),
        });
      }
      if (route.request().method() === "PATCH" && !failedSave) {
        failedSave = true;
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "저장 실패 검증" }),
        });
      }
      if (route.request().method() === "PATCH" && holdSave) {
        const response = await route.fetch();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return route.fulfill({ response });
      }
      return route.continue();
    },
  );
  await page.goto(`/${f.teamId}/settings?section=notifications`);
  const workspace = page.getByRole("region", {
    name: "워크스페이스 알림 정책",
  });
  await expect(workspace.getByRole("alert")).toContainText(
    "불러오지 못했습니다",
  );
  failLoad = false;
  await workspace
    .getByRole("button", { name: "최신 설정 다시 불러오기" })
    .click();
  await workspace
    .getByRole("checkbox", { name: "워크스페이스 멘션", exact: true })
    .uncheck();
  await workspace
    .getByRole("button", { name: "알림 설정 저장", exact: true })
    .click();
  await expect(workspace.getByRole("alert")).toContainText("저장 실패 검증");
  await expect(
    workspace.getByRole("checkbox", { name: "워크스페이스 멘션", exact: true }),
  ).not.toBeChecked();
  expect((await preferences(f.teamId, f.owner)).kinds.mention).toBe(true);
  await workspace
    .getByRole("button", { name: "알림 설정 저장", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toContainText("저장했습니다");
  const selector = page.getByRole("combobox", { name: "알림을 설정할 채팅방" });
  await selector.selectOption(f.channelId);
  const room = page.getByRole("region", { name: "이 방 알림 정책" });
  await room
    .getByRole("combobox", { name: "이 방 알림 방식", exact: true })
    .selectOption("off");
  holdSave = true;
  await room
    .getByRole("button", { name: "알림 설정 저장", exact: true })
    .click();
  await expect.poll(() => !!release).toBe(true);
  await selector.selectOption(b);
  await expect(
    room.getByRole("combobox", { name: "이 방 알림 방식", exact: true }),
  ).toHaveValue("inherit");
  release!();
  holdSave = false;
  await expect(
    room.getByRole("combobox", { name: "이 방 알림 방식", exact: true }),
  ).toHaveValue("inherit");
  const saved = await preferences(f.teamId, f.owner);
  expect(saved.channelModes[f.channelId]).toBe("off");
  expect(saved.channelModes[b]).toBeUndefined();
  await page.goto(`/${f.teamId}/channel/${f.channelId}`);
  await page
    .getByRole("button", { name: "이 채팅방 알림 설정", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "이 채팅방 알림 설정",
    exact: true,
  });
  await expect(
    dialog.getByRole("combobox", { name: "이 방 알림 방식", exact: true }),
  ).toHaveValue("off");
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(7);
  expect(box.x + box.width).toBeLessThanOrEqual(383);
  await dialog
    .getByRole("button", { name: "이 방의 모든 예외 초기화", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    dialog.getByRole("button", {
      name: "이 방의 모든 예외 초기화",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/notification-preferences-mobile.png",
  });
});
