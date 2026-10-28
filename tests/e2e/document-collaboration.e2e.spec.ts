import { expect, test } from "playwright/test";
import { io } from "socket.io-client";
import {
  createWorkspaceFixture,
  e2eApiUrl,
  jsonFetch,
  createUserSession,
  sendSocketMessage,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

test("two editors merge offline edits, show presence, receive external edits and persist after reload", async ({
  browser,
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await createWorkspaceFixture();
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  try {
    await loginWithSession(page, fixture.owner);
    await loginWithSession(other, fixture.actor);
    const url = `/${fixture.teamId}/docs/${fixture.documentId}`;
    await page.goto(url);
    await other.goto(url);
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    const otherEditor = other.locator('.bn-editor[contenteditable="true"]');
    await expect(editor).toContainText("문서 검증 본문");
    await expect(otherEditor).toContainText("문서 검증 본문");
    await expect(page.getByLabel("공동 편집 참여자")).toContainText(
      fixture.actor.username,
    );
    await expect(other.getByLabel("공동 편집 참여자")).toContainText(
      fixture.owner.username,
    );
    await otherContext.setOffline(true);
    await expect(other.getByLabel("공동 편집 참여자")).toContainText(
      "재연결 중",
    );
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.insertText(" OWNER-EDIT");
    await otherEditor.click();
    await other.keyboard.press("ControlOrMeta+End");
    await other.keyboard.insertText(" ACTOR-OFFLINE");
    await otherContext.setOffline(false);
    await expect(editor).toContainText("ACTOR-OFFLINE");
    await expect(otherEditor).toContainText("OWNER-EDIT");
    await expect(page.getByText("저장됨", { exact: true })).toBeVisible();
    await expect
      .poll(async () =>
        JSON.stringify(
          (
            await jsonFetch<{ content: string }>(
              `/team/${fixture.teamId}/document/${fixture.documentId}`,
              { token: fixture.owner.token },
            )
          )?.data?.content,
        ),
      )
      .toContain("ACTOR-OFFLINE");
    const current = (await jsonFetch<{ updatedAt: string }>(
      `/team/${fixture.teamId}/document/${fixture.documentId}`,
      { token: fixture.owner.token },
    ))!.data!;
    await jsonFetch(`/team/${fixture.teamId}/document/${fixture.documentId}`, {
      method: "PATCH",
      token: fixture.owner.token,
      body: {
        content: "AI가 함께 정리한 본문",
        contentFormat: "plain",
        expectedUpdatedAt: current.updatedAt,
      },
    });
    await expect(editor).toContainText("AI가 함께 정리한 본문");
    await expect(otherEditor).toContainText("AI가 함께 정리한 본문");
    await other.reload();
    await expect(otherEditor).toContainText("AI가 함께 정리한 본문");
    const stale = await fetch(
      `${e2eApiUrl}/team/${fixture.teamId}/document/${fixture.documentId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${fixture.owner.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: "old client overwrite" }),
      },
    );
    expect(stale.status).toBe(409);
  } finally {
    await otherContext.close();
  }
});

test("collaboration refuses cross-user private access and rechecks revocation on every edit", async () => {
  const fixture = await createWorkspaceFixture();
  const socket = io(`${e2eApiUrl.replace(/\/api$/, "")}/document`, {
    transports: ["websocket"],
    auth: { token: fixture.actor.token },
    forceNew: true,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  try {
    const input = {
      teamId: fixture.teamId,
      documentId: fixture.documentId,
      clientId: 123456,
    };
    expect(
      (await socket.timeout(15_000).emitWithAck("document:join", input)).ok,
    ).toBe(true);
    await jsonFetch(`/team/${fixture.teamId}/document/${fixture.documentId}`, {
      token: fixture.owner.token,
      method: "PATCH",
      body: { visibility: "restricted", allowedViewerIds: [] },
    });
    expect(
      (
        await socket
          .timeout(5000)
          .emitWithAck("document:update", { update: new Uint8Array([0, 0]) })
      ).ok,
    ).toBe(false);
    expect(
      (await socket.timeout(5000).emitWithAck("document:join", input)).ok,
    ).toBe(false);
  } finally {
    socket.disconnect();
  }
});

test("concurrent desktop/browser claims display once without changing unread notifications", async () => {
  const fixture = await createWorkspaceFixture();
  const path = `/team/${fixture.teamId}/notification/delivery-claim`;
  const sender = await createUserSession("claim-sender");
  await jsonFetch(`/team/${fixture.teamSlug}/join`, {
    method: "POST",
    token: sender.token,
  });
  const message = await sendSocketMessage({
    session: sender,
    teamId: fixture.teamId,
    channelId: fixture.channelId,
    content: "실제 메시지 전달 중복 검증",
  });
  const claims = await Promise.all(
    Array.from({ length: 8 }, () =>
      jsonFetch<{ deliver: boolean }>(path, {
        method: "POST",
        token: fixture.owner.token,
        body: { key: `message:${message.id}` },
      }),
    ),
  );
  expect(claims.filter((claim) => claim?.data?.deliver)).toHaveLength(1);
  expect(
    (
      await jsonFetch<{ deliver: boolean }>(path, {
        method: "POST",
        token: fixture.actor.token,
        body: { key: `message:${message.id}` },
      })
    )?.data?.deliver,
  ).toBe(true);
  const unauthenticated = await fetch(`${e2eApiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: `message:${message.id}` }),
  });
  expect(unauthenticated.status).toBe(401);
});
