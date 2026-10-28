import { test, expect } from "playwright/test";
import {
  createWorkspaceFixture,
  sendSocketMessage,
  jsonFetch,
  createChannel,
  createGuestSessionForTeam,
  e2eApiUrl,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

test.setTimeout(90000);

test("message creates a sourced issue, retains failed drafts, links documents and reflects current status", async ({
  page,
}, testInfo) => {
  const f = await createWorkspaceFixture();
  const message = await sendSocketMessage({
    session: f.owner,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "운영 점검 논의의 원문",
  });
  const document = (await jsonFetch<{ title: string }>(
    `/team/${f.teamId}/document/${f.documentId}`,
    { token: f.owner.token },
  ))!.data!;
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/channel/${f.channelId}`);
  const row = page
    .locator("[data-message-id]")
    .filter({ hasText: "운영 점검 논의의 원문" });
  await row.hover();
  await row
    .getByRole("button", { name: "메시지 후속 업무", exact: true })
    .click();
  await row.getByRole("button", { name: "이 메시지에서 이슈 만들기" }).click();
  const side = page.frameLocator("iframe");
  const form = side.getByRole("region", { name: "이슈 생성", exact: true });
  await form
    .getByPlaceholder("이슈 제목", { exact: true })
    .fill("운영 점검 후속 업무");
  const endpoint = `**/api/team/${f.teamId}/issue`;
  await page.route(endpoint, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          json: { success: false, message: "시험용 저장 실패" },
        })
      : route.continue(),
  );
  await form.getByRole("button", { name: "생성", exact: true }).click();
  await expect(form.getByRole("alert")).toBeVisible();
  await expect(form.getByPlaceholder("이슈 제목", { exact: true })).toHaveValue(
    "운영 점검 후속 업무",
  );
  await page.unroute(endpoint);
  await form.getByRole("button", { name: "생성", exact: true }).click();
  await expect(form).toHaveCount(0);
  const issueForm = side.getByRole("region", { name: "이슈 상세" });
  await expect(issueForm.getByText("생성 근거", { exact: true })).toBeVisible();
  await expect(
    issueForm.getByRole("link").filter({ hasText: "운영 점검 논의의 원문" }),
  ).toBeVisible();
  await issueForm
    .getByRole("button", { name: "자료 연결", exact: true })
    .click();
  const picker = side.getByRole("dialog", { name: "자료 연결" });
  await picker
    .getByRole("radio", { name: document.title, exact: true })
    .check();
  await picker.getByRole("button", { name: "연결하기", exact: true }).click();
  await expect(
    issueForm.getByRole("link", { name: document.title, exact: true }),
  ).toBeVisible();
  const issues = (await jsonFetch<Array<{ id: string }>>(
    `/team/${f.teamId}/issue`,
    { token: f.owner.token },
  ))!.data!;
  const issueId = issues[0].id;
  const links = (await jsonFetch<Array<{ kind: string; resourceId: string }>>(
    `/team/${f.teamId}/issue/${issueId}/links`,
    { token: f.owner.token },
  ))!.data!;
  expect(
    links.some(
      (link) => link.resourceId === message.id && link.kind === "message",
    ),
  ).toBe(true);
  await page.goto(`/${f.teamId}/docs/${f.documentId}`);
  const related = page.getByRole("region", { name: "연결된 이슈" });
  await expect(
    related.getByRole("link", { name: "운영 점검 후속 업무" }),
  ).toBeVisible();
  await related
    .getByRole("button", { name: "운영 점검 후속 업무 옆에 열기" })
    .click();
  await side.getByRole("region", { name: "이슈 상세" }).getByRole("button", { name: "편집", exact: true }).click();
  await side
    .getByRole("region", { name: "이슈 수정" })
    .locator('select:has(option[value="done"])')
    .selectOption("done");
  await side.getByRole("button", { name: "저장", exact: true }).click();
  await expect(related.getByText("완료", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("linked-document-issue.png"),
  });
  await page.reload();
  await expect(related.getByText("완료", { exact: true })).toBeVisible();
  await related
    .getByRole("button", { name: "운영 점검 후속 업무 연결 해제" })
    .click();
  await expect(related.getByRole("link")).toHaveCount(0);
  await page.reload();
  await expect(related.getByRole("link")).toHaveCount(0);
});

test("API rejects hidden sources, cross-team issues, guests and malformed input; links are idempotent", async () => {
  const f = await createWorkspaceFixture();
  const guest = await createGuestSessionForTeam({
    ownerToken: f.owner.token,
    teamId: f.teamId,
  });
  const privateChannel = await createChannel({
    teamId: f.teamId,
    token: f.owner.token,
    name: "private-evidence",
    type: "private",
  });
  const message = await sendSocketMessage({
    session: f.owner,
    teamId: f.teamId,
    channelId: privateChannel,
    content: "비공개 근거",
  });
  const request = async (
    path: string,
    token: string,
    method = "GET",
    body?: unknown,
  ) =>
    fetch(`${e2eApiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  expect(
    (
      await request(`/team/${f.teamId}/issue`, f.actor.token, "POST", {
        title: "권한 없는 생성",
        sourceMessageId: message.id,
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await request(`/team/${f.teamId}/issue`, f.owner.token, "POST", {
        title: "잘못된 ID",
        sourceMessageId: "invalid",
      })
    ).status,
  ).toBe(400);
  expect(
    (await jsonFetch<unknown[]>(`/team/${f.teamId}/issue`, {
      token: f.owner.token,
    }))!.data,
  ).toHaveLength(0);
  const issue = (await jsonFetch<{ id: string }>(`/team/${f.teamId}/issue`, {
    method: "POST",
    token: f.owner.token,
    body: { title: "공유 업무", sourceMessageId: message.id },
  }))!.data!;
  const path = `/team/${f.teamId}/issue/${issue.id}/links`;
  const body = { kind: "document", resourceId: f.documentId };
  expect((await request(path, guest.token, "POST", body)).status).toBe(403);
  await Promise.all([
    jsonFetch(path, { method: "POST", token: f.owner.token, body }),
    jsonFetch(path, { method: "POST", token: f.owner.token, body }),
  ]);
  expect(
    (await jsonFetch<unknown[]>(path, { token: f.owner.token }))!.data,
  ).toHaveLength(2);
  const actorLinks = (await jsonFetch<Array<{ kind: string }>>(path, {
    token: f.actor.token,
  }))!.data!;
  expect(actorLinks).toHaveLength(1);
  expect(actorLinks[0].kind).toBe("document");
  await jsonFetch(`/team/${f.teamId}/document/${f.documentId}`, {
    method: "PATCH",
    token: f.owner.token,
    body: { visibility: "restricted", allowedViewerIds: [] },
  });
  expect(
    (await jsonFetch<unknown[]>(path, { token: f.actor.token }))!.data,
  ).toHaveLength(0);
  expect(
    (
      await request(
        `/team/${f.teamId}/issue/related?kind=document&resourceId=${f.documentId}`,
        f.actor.token,
      )
    ).status,
  ).toBe(404);
  const otherTeam = (await jsonFetch<{ id: string }>("/team", {
    method: "POST",
    token: f.owner.token,
    body: { name: "다른 팀", slug: `other-${Date.now()}` },
  }))!.data!;
  expect(
    (
      await request(
        `/team/${otherTeam.id}/issue/${issue.id}`,
        f.owner.token,
        "PATCH",
        { status: "done" },
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await request(
        `/team/${otherTeam.id}/issue/${issue.id}`,
        f.owner.token,
        "DELETE",
      )
    ).status,
  ).toBe(404);
  await jsonFetch(`/team/${f.teamId}/document/${f.documentId}/archive`, {
    method: "POST",
    token: f.owner.token,
  });
  expect(
    (await jsonFetch<unknown[]>(path, { token: f.owner.token }))!.data,
  ).toHaveLength(1);
});
