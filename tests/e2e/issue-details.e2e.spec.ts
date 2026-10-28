import { test, expect } from "playwright/test";
import {
  createWorkspaceFixture,
  createGuestSessionForTeam,
  jsonFetch,
  sendSocketMessage,
  sendSocketMessages,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

test("issue opens as a spacious Markdown detail, edits safely and fits mobile and guest access", async ({
  page,
}, info) => {
  const f = await createWorkspaceFixture();
  const root = `/team/${f.teamId}/issue`;
  const markdown =
    "# 개발 계획\n\n## 완료 기준\n\n- [x] 원문 보존\n- [ ] 배포 검증\n\n> 근거를 남깁니다.\n\n```ts\nconst preserved = true;\n```\n\n| 기능 | 상태 |\n| --- | --- |\n| 상세 | 검증 |\n\n[GitHub](https://github.com/kscold/gadoc)\n\n![추적 금지](https://example.com/never-load.png)\n\n<script>window.issueUnsafe = true</script>\n\n[차단 링크](javascript:alert%281%29)";
  const issue = (await jsonFetch<{ id: string }>(root, {
    method: "POST",
    token: f.owner.token,
    body: {
      title: "읽기 좋은 상세",
      description: markdown,
      priority: "high",
      assigneeIds: [f.actor.userId],
      labels: ["UX"],
    },
  }))!.data!;
  let externalImages = 0;
  page.on("request", (request) => {
    if (request.url().includes("never-load.png")) externalImages++;
  });
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/issues?issue=${issue.id}`);
  const detail = page.getByRole("dialog", { name: "이슈 상세", exact: true });
  await expect(
    detail.getByRole("heading", { name: "개발 계획", exact: true }),
  ).toBeVisible();
  await expect(detail.getByRole("table")).toBeVisible();
  await expect(detail.getByRole("checkbox")).toHaveCount(2);
  await expect(detail.locator("pre")).toContainText("const preserved = true;");
  await expect(detail.getByRole("textbox")).toHaveCount(0);
  expect((await detail.boundingBox())!.width).toBeGreaterThan(850);
  expect(externalImages).toBe(0);
  expect(
    await page.evaluate(() => (window as any).issueUnsafe),
  ).toBeUndefined();
  await expect(detail.locator('a[href^="javascript:"]')).toHaveCount(0);
  await detail.getByRole("button", { name: "편집", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "이슈 수정", exact: true });
  const description = editor.getByPlaceholder("이슈 설명을 입력해 주세요");
  await expect(description).toHaveValue(markdown);
  expect((await description.boundingBox())!.height).toBeGreaterThan(250);
  await description.fill(markdown + "\n\n## 수정 내용\n초안 유지");
  await editor
    .getByRole("button", { name: "설명 미리 보기", exact: true })
    .click();
  await expect(
    editor
      .getByRole("region", { name: "설명 미리 보기" })
      .getByRole("heading", { name: "수정 내용" }),
  ).toBeVisible();
  await editor
    .getByRole("button", { name: "마크다운 원문 편집", exact: true })
    .click();
  const endpoint = `**/api${root}/${issue.id}`;
  let releaseSave!: () => void;
  const pendingSave = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route(endpoint, async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    await pendingSave;
    await route.fulfill({
      status: 503,
      json: { success: false, message: "검증용 저장 실패" },
    });
  });
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  try {
    await expect(editor).toHaveAttribute("aria-busy", "true");
    await expect(description).toBeDisabled();
    await expect(
      editor.getByRole("button", { name: "UX 라벨 제거" }),
    ).toBeDisabled();
  } finally {
    releaseSave();
  }
  await expect(editor.getByRole("alert")).toBeVisible();
  await expect(description).toHaveValue(
    markdown + "\n\n## 수정 내용\n초안 유지",
  );
  await page.unroute(endpoint);
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    detail.getByRole("heading", { name: "수정 내용", exact: true }),
  ).toBeVisible();
  await expect(detail.getByRole("status")).toContainText("저장");
  await detail.getByRole("button", { name: "편집", exact: true }).click();
  await editor
    .getByPlaceholder("이슈 설명을 입력해 주세요")
    .fill("저장하지 않은 새 초안");
  page.once("dialog", (dialog) => dialog.dismiss());
  await editor.getByRole("button", { name: "취소", exact: true }).click();
  await expect(
    editor.getByPlaceholder("이슈 설명을 입력해 주세요"),
  ).toHaveValue("저장하지 않은 새 초안");
  page.once("dialog", (dialog) => dialog.accept());
  await editor.getByRole("button", { name: "취소", exact: true }).click();
  await expect(
    detail.getByRole("heading", { name: "수정 내용", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("issue-detail-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(detail).toBeVisible();
  expect((await detail.boundingBox())!.width).toBeLessThanOrEqual(390);
  expect(
    await detail.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("issue-detail-mobile.png") });
  await detail.getByRole("button", { name: "이슈 상세 닫기" }).click();
  await expect(detail).toHaveCount(0);
  const guest = await createGuestSessionForTeam({
    ownerToken: f.owner.token,
    teamId: f.teamId,
  });
  await loginWithSession(page, guest);
  await page.goto(`/${f.teamId}/issues?issue=${issue.id}`);
  await expect(
    detail.getByRole("heading", { name: "수정 내용" }),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "편집", exact: true }),
  ).toHaveCount(0);
  await expect(
    detail.getByRole("button", { name: "자료 연결", exact: true }),
  ).toHaveCount(0);
});

test("linked reply and document show their location and open the exact thread or nested page", async ({
  page,
}) => {
  test.setTimeout(90000);
  const f = await createWorkspaceFixture();
  const parent = await sendSocketMessage({
    session: f.owner,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "이슈 근거 스레드 원문",
  });
  const reply = await sendSocketMessage({
    session: f.actor,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "정확한 답글 위치",
    replyToId: parent.id,
  });
  await sendSocketMessages({
    session: f.owner,
    teamId: f.teamId,
    channelId: f.channelId,
    contents: Array.from({ length: 55 }, (_, i) => `새 대화 ${i}`),
  });
  const child = (await jsonFetch<{ id: string }>(`/team/${f.teamId}/document`, {
    method: "POST",
    token: f.owner.token,
    body: {
      title: "연결된 하위 문서",
      parentId: f.documentId,
      content: "문서 원문",
    },
  }))!.data!;
  const issue = (await jsonFetch<{ id: string }>(`/team/${f.teamId}/issue`, {
    method: "POST",
    token: f.owner.token,
    body: { title: "정확한 근거 탐색", sourceMessageId: reply.id },
  }))!.data!;
  await jsonFetch(`/team/${f.teamId}/issue/${issue.id}/links`, {
    method: "POST",
    token: f.owner.token,
    body: { kind: "document", resourceId: child.id },
  });
  await loginWithSession(page, f.owner);
  const url = `/${f.teamId}/issues?issue=${issue.id}`;
  await page.goto(url);
  const resources = page.getByRole("region", {
    name: "연결된 자료",
    exact: true,
  });
  await expect(
    resources.getByText(new RegExp(`#${f.channelName} / 스레드 답글 /`)),
  ).toBeVisible();
  await expect(
    resources.getByText(new RegExp("문서 / .* / 연결된 하위 문서")),
  ).toBeVisible();
  let releaseHistory!: () => void;
  let historyHeld = false;
  const historyGate = new Promise<void>((resolve) => {
    releaseHistory = resolve;
  });
  await page.route(`**/api/channel/${f.channelId}/message?*`, async (route) => {
    if (new URL(route.request().url()).searchParams.has("before")) {
      historyHeld = true;
      await historyGate;
    }
    await route.continue();
  });
  await resources
    .getByRole("link")
    .filter({ hasText: "정확한 답글 위치" })
    .click();
  const thread = page.getByRole("complementary", {
    name: "스레드",
    exact: true,
  });
  try {
    await expect.poll(() => historyHeld).toBe(true);
    await expect(thread.locator(`[data-message-id="${reply.id}"]`)).toHaveCount(
      1,
    );
  } finally {
    releaseHistory();
  }
  await expect(page.locator(`#message-${parent.id}`)).toBeVisible();
  await expect(thread.locator(`[data-message-id="${reply.id}"]`)).toHaveCount(
    1,
  );
  await expect(thread.locator(`[data-message-id="${reply.id}"]`)).toBeVisible();
  await expect(thread.locator(`[data-message-id="${reply.id}"]`)).toContainText(
    "정확한 답글 위치",
  );
  await page.goto(url);
  await page
    .getByRole("region", { name: "연결된 자료", exact: true })
    .getByRole("link", { name: "연결된 하위 문서", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/docs/${child.id}$`));
  await expect(page.getByRole("textbox", { name: "페이지 제목" })).toHaveValue(
    "연결된 하위 문서",
  );
});

test("a concurrent issue edit cannot overwrite the stored version or discard the local Markdown", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const root = `/team/${f.teamId}/issue`;
  const issue = (await jsonFetch<{ id: string }>(root, {
    method: "POST",
    token: f.owner.token,
    body: { title: "동시 편집 보호", description: "## 초기 원문" },
  }))!.data!;
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/issues?issue=${issue.id}`);
  await page
    .getByRole("dialog", { name: "이슈 상세" })
    .getByRole("button", { name: "편집", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "이슈 수정" });
  await editor
    .getByPlaceholder("이슈 설명을 입력해 주세요")
    .fill("## 로컬 초안\n유지해야 함");
  await jsonFetch(`${root}/${issue.id}`, {
    method: "PATCH",
    token: f.actor.token,
    body: { description: "## 다른 사용자 원문" },
  });
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor.getByRole("alert")).toBeVisible();
  await expect(
    editor.getByPlaceholder("이슈 설명을 입력해 주세요"),
  ).toHaveValue("## 로컬 초안\n유지해야 함");
  const rows = (await jsonFetch<Array<{ id: string; description: string }>>(
    root,
    { token: f.owner.token },
  ))!.data!;
  expect(rows.find((row) => row.id === issue.id)?.description).toBe(
    "## 다른 사용자 원문",
  );
});
