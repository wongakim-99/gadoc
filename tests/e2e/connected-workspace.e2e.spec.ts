import { test, expect, type Page } from "playwright/test";
import {
  createWorkspaceFixture,
  createAssignedIssue,
  sendSocketMessage,
  jsonFetch,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

test.setTimeout(90000);

test("issue references survive a failed save and persist after retry", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const issueId = await createAssignedIssue({
    actor: f.actor,
    owner: f.owner,
    teamId: f.teamId,
    title: "연결 저장 재시도",
  });
  const doc = await jsonFetch<{ title: string }>(
    `/team/${f.teamId}/document/${f.documentId}`,
    { token: f.owner.token },
  );
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs/${f.documentId}`);
  await expect(
    page.getByRole("textbox", { name: "페이지 제목" }),
  ).toBeEnabled();
  const side = await choose(page, "이슈", "연결 저장 재시도");
  await expect(side.getByPlaceholder("이슈 제목", { exact: true })).toHaveValue(
    "연결 저장 재시도",
  );
  await page
    .getByLabel(`${doc.data!.title} 연결 메뉴`, { exact: true })
    .click();
  await page.getByRole("button", { name: "다른 본문에 링크 넣기" }).click();
  await side
    .getByRole("button", { name: `본문에 링크 넣기: ${doc.data!.title}` })
    .click();
  const endpoint = `**/api/team/${f.teamId}/issue/${issueId}`;
  await page.route(endpoint, (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 503,
          json: { success: false, message: "시험용 저장 실패" },
        })
      : route.continue(),
  );
  await side.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    side.getByRole("alert").filter({ hasText: "시험용 저장 실패" }),
  ).toBeVisible();
  await expect(side.getByPlaceholder("이슈 설명을 입력해 주세요")).toHaveValue(
    new RegExp(f.documentId),
  );
  await page.unroute(endpoint);
  await side.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    side.getByRole("status").filter({ hasText: "변경 사항을 저장했습니다." }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (
          await jsonFetch<Array<{ id: string; description: string }>>(
            `/team/${f.teamId}/issue`,
            { token: f.owner.token },
          )
        )?.data?.find((item) => item.id === issueId)?.description,
    )
    .toContain(f.documentId);
});

async function choose(page: Page, kind: string, title: string) {
  const sidebar = page.getByRole("complementary", { name: "워크스페이스 사이드바" });
  const side = page.frameLocator('iframe[title="연결된 작업 화면"]');
  if (kind === "문서") {
    await sidebar.getByRole("button", { name: `${title} 옆에 열기`, exact: true }).click();
  } else {
    await sidebar.getByRole("button", { name: `${kind === "대화" ? "채팅" : kind} 옆에 열기`, exact: true }).click();
    if (kind === "이슈") await side.getByText(title, { exact: true }).filter({ visible: true }).click();
    if (kind === "대화") {
      await expect(side.getByRole("textbox")).toBeVisible();
      await side.getByRole("textbox").click();
      await sidebar.getByRole("button", { name: `# ${title} 옆에 열기`, exact: true }).click();
    }
  }
  return side;
}

test("document and chat exchange durable references without sending drafts automatically", async ({
  page,
}, testInfo) => {
  const fixture = await createWorkspaceFixture();
  const doc = await jsonFetch<{ title: string }>(
    `/team/${fixture.teamId}/document/${fixture.documentId}`,
    { token: fixture.owner.token },
  );
  await sendSocketMessage({
    session: fixture.actor,
    teamId: fixture.teamId,
    channelId: fixture.channelId,
    content: "분할 화면에서 결정 근거 연결 검증",
  });
  await loginWithSession(page, fixture.owner);
  await page.goto(`/${fixture.teamId}/docs/${fixture.documentId}`);
  await expect(
    page.getByRole("textbox", { name: "페이지 제목" }),
  ).toBeEnabled();
  const side = await choose(page, "대화", fixture.channelName);
  await expect(
    side.getByText("분할 화면에서 결정 근거 연결 검증", { exact: true }),
  ).toBeVisible();
  await expect(
    side.getByRole("complementary", { name: "워크스페이스 사이드바" }),
  ).toHaveCount(0);
  await page
    .getByLabel(`${doc.data!.title} 연결 메뉴`, { exact: true })
    .click();
  await page.getByRole("button", { name: "다른 본문에 링크 넣기" }).click();
  await side
    .getByRole("button", { name: `본문에 링크 넣기: ${doc.data!.title}` })
    .click();
  const composer = side.locator("textarea").last();
  await expect(composer).toHaveValue(new RegExp(fixture.documentId));
  await expect(
    side.locator("[data-message-id]").filter({ hasText: doc.data!.title }),
  ).toHaveCount(0);
  await composer.press("Enter");
  await expect(
    side.getByRole("link", { name: doc.data!.title, exact: true }),
  ).toBeVisible();
  const message = side
    .locator("[data-message-id]")
    .filter({ hasText: "분할 화면에서 결정 근거 연결 검증" });
  await message.hover();
  await message.getByLabel(/대화 원문 .* 연결 메뉴/).click();
  await side.getByRole("button", { name: "다른 본문에 링크 넣기" }).click();
  await page
    .getByRole("button", { name: /본문에 링크 넣기: 대화 원문/ })
    .click();
  await expect(page.locator(".bn-editor a")).toHaveAttribute(
    "href",
    /message=/,
  );
  await expect
    .poll(
      async () =>
        (
          await jsonFetch<{ content: string }>(
            `/team/${fixture.teamId}/document/${fixture.documentId}`,
            { token: fixture.owner.token },
          )
        )?.data?.content,
    )
    .toContain("message=");
  const divider = page.getByRole("separator", { name: "작업 영역 너비" });
  await divider.focus();
  await divider.press("ArrowRight");
  await expect(divider).toHaveAttribute("aria-valuenow", "55");
  await page.getByRole("button", { name: "좌우 바꾸기" }).click();
  await expect(page.locator(".connection-panes")).toHaveClass(/is-reversed/);
  await page.screenshot({ path: testInfo.outputPath("document-chat.png") });
  await composer.fill("전송하지 않은 초안");
  const dismissed = page
    .waitForEvent("dialog")
    .then((dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "분할 닫기" }).click();
  await dismissed;
  await expect(page.getByRole("button", { name: "분할 닫기" })).toBeEnabled();
  await expect(composer).toHaveValue("전송하지 않은 초안");
  const accepted = page
    .waitForEvent("dialog")
    .then((dialog) => dialog.accept());
  await page.getByRole("button", { name: "분할 닫기" }).click();
  await accepted;
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".bn-editor a")).toHaveAttribute(
    "href",
    /message=/,
  );
  await page.locator(".bn-editor a").click();
  await expect(
    page
      .frameLocator("iframe")
      .getByText("분할 화면에서 결정 근거 연결 검증", { exact: true }),
  ).toBeVisible();
});

test("two channel panes remain isolated and the side draft survives primary navigation", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const other = await jsonFetch<{ id: string }>(`/team/${f.teamId}/channel`, {
    method: "POST",
    token: f.owner.token,
    body: { name: "service-operations", type: "public" },
  });
  await sendSocketMessage({
    session: f.actor,
    teamId: f.teamId,
    channelId: f.channelId,
    content: "왼쪽 채널 전용 메시지",
  });
  await sendSocketMessage({
    session: f.actor,
    teamId: f.teamId,
    channelId: other.data!.id,
    content: "오른쪽 채널 전용 메시지",
  });
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/channel/${f.channelId}`);
  const side = await choose(page, "대화", "service-operations");
  await expect(
    side.getByText("오른쪽 채널 전용 메시지", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("왼쪽 채널 전용 메시지", { exact: true }),
  ).toBeVisible();
  await expect(
    side.getByText("왼쪽 채널 전용 메시지", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("오른쪽 채널 전용 메시지", { exact: true }),
  ).toHaveCount(0);
  await side.locator("textarea").fill("작업 중인 메시지 유지");
  await page.locator("main textarea").click();
  await page
    .getByRole("navigation", { name: "워크스페이스 영역", exact: true })
    .getByRole("link", { name: "공지", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "공지사항", exact: true }),
  ).toBeVisible();
  await expect(side.locator("textarea")).toHaveValue("작업 중인 메시지 유지");
});

test("issues and announcements connect through a published reference with mobile pane switching", async ({
  page,
}, testInfo) => {
  const fixture = await createWorkspaceFixture();
  const issueId = await createAssignedIssue({
    actor: fixture.actor,
    owner: fixture.owner,
    teamId: fixture.teamId,
    title: "서비스 배포 확인",
  });
  await loginWithSession(page, fixture.owner);
  await page.goto(`/${fixture.teamId}/issues?issue=${issueId}`);
  await expect(page.getByPlaceholder("이슈 제목", { exact: true })).toHaveValue(
    "서비스 배포 확인",
  );
  await page
    .getByRole("dialog", { name: "이슈 수정" })
    .getByLabel("서비스 배포 확인 연결 메뉴", { exact: true })
    .click();
  await page.getByRole("button", { name: "다른 본문에 링크 넣기" }).click();
  // The pane picker can be opened after closing the existing issue dialog.
  await page.getByRole("button", { name: "취소", exact: true }).click();
  const notice = await jsonFetch<{ id: string }>(
    `/team/${fixture.teamId}/announcement`,
    {
      method: "POST",
      token: fixture.owner.token,
      body: { title: "운영 안내", content: "기존 서비스 공지" },
    },
  );
  const side = await choose(page, "공지", "운영 안내");
  await expect(side.locator(`#announcement-${notice.data!.id}`)).toBeVisible();
  await side.getByRole("button", { name: "공지 작성", exact: true }).click();
  await side
    .getByRole("button", { name: "본문에 링크 넣기: 서비스 배포 확인" })
    .click();
  await side.getByPlaceholder("공지 제목").fill("배포 완료 안내");
  await expect(side.getByPlaceholder("공지 내용")).toHaveValue(
    new RegExp(issueId),
  );
  await side.getByRole("button", { name: "등록", exact: true }).click();
  await expect(
    side.getByRole("link", { name: "서비스 배포 확인", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      (
        await jsonFetch<Array<{ content: string }>>(
          `/team/${fixture.teamId}/announcement`,
          { token: fixture.owner.token },
        )
      )?.data?.some((item) => item.content.includes(issueId)),
    )
    .toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("group", { name: "작업 영역 전환" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "현재 작업", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "이슈 트래커" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "공지", exact: true }).click();
  await expect(side.getByText("배포 완료 안내", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("mobile-announcements.png"),
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});

test("closing a document pane flushes edits and preserves the pane on save failure", async ({
  page,
}) => {
  const fixture = await createWorkspaceFixture();
  const doc = await jsonFetch<{ title: string }>(
    `/team/${fixture.teamId}/document/${fixture.documentId}`,
    { token: fixture.owner.token },
  );
  await loginWithSession(page, fixture.owner);
  await page.goto(`/${fixture.teamId}/docs`);
  const side = await choose(page, "문서", doc.data!.title);
  const title = side.getByRole("textbox", { name: "페이지 제목" });
  await expect(title).toBeEnabled();
  await page.route(
    `**/api/team/${fixture.teamId}/document/${fixture.documentId}`,
    (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 503,
            json: { success: false, message: "테스트 저장 실패" },
          })
        : route.continue(),
  );
  await title.fill("저장 실패에도 유지할 초안");
  await page.getByRole("button", { name: "분할 닫기" }).click();
  await expect(title).toHaveValue("저장 실패에도 유지할 초안");
  await expect(side.getByRole("alert").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "분할 닫기" })).toBeEnabled();
  await page.unroute(
    `**/api/team/${fixture.teamId}/document/${fixture.documentId}`,
  );
  await page.getByRole("button", { name: "분할 닫기" }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (
          await jsonFetch<{ title: string }>(
            `/team/${fixture.teamId}/document/${fixture.documentId}`,
            { token: fixture.owner.token },
          )
        )?.data?.title,
    )
    .toBe("저장 실패에도 유지할 초안");
  await expect(
    page
      .getByRole("complementary", { name: "워크스페이스 사이드바" })
      .getByRole("link", { name: "저장 실패에도 유지할 초안", exact: true }),
  ).toBeVisible();
});
