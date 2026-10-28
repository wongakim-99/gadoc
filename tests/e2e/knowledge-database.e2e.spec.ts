import { test, expect } from "playwright/test";
import {
  createWorkspaceFixture,
  createGuestSessionForTeam,
  jsonFetch,
  e2eApiUrl,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import type {
  DatabaseDetail,
  DatabaseProperty,
  KnowledgeDatabase,
} from "../../packages/web/src/features/database/model/types";

test.setTimeout(90000);
test("creates a database and page in UI; failed cell saves retain drafts and block navigation", async ({
  page,
}, testInfo) => {
  const f = await createWorkspaceFixture();
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs/${f.documentId}`);
  await page.locator('.bn-editor[contenteditable="true"]').click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/database");
  await page.getByRole("option", { name: "데이터베이스 빈 데이터베이스 추가", exact: true }).click();
  const block = page.locator("[data-inline-database]");
  await expect(block.getByRole("table")).toBeVisible();
  await block.getByLabel("데이터베이스 제목", { exact: true }).fill("운영 지식베이스");
  await block.getByLabel("데이터베이스 제목", { exact: true }).press("Enter");
  await expect(block.getByLabel("데이터베이스 제목", { exact: true })).toBeEnabled();
  await expect(block.getByRole("status")).toHaveText("이름을 변경했습니다.");
  await block.getByRole("link", { name: "전체 페이지로 열기", exact: true }).click();
  await expect(page).toHaveURL(/database=/);
  const href = page.url();
  await page.getByRole("button", { name: "새 페이지", exact: true }).click();
  await page.getByLabel("제목 없음 페이지 이름").fill("배포 절차");
  await page.getByLabel("제목 없음 페이지 이름").press("Enter");
  await expect(
    page.getByRole("table").getByRole("link", { name: "배포 절차", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "속성 추가", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "속성 추가" });
  await modal.getByLabel("속성 이름", { exact: true }).fill("요약");
  await modal.getByRole("button", { name: "속성 만들기" }).click();
  const input = page.getByRole("textbox", {
    name: "배포 절차 · 요약",
    exact: true,
  });
  const endpoint = "**/api/team/*/database/*/row/*/*";
  await page.route(endpoint, (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 503,
          json: { success: false, message: "시험용 저장 실패" },
        })
      : route.continue(),
  );
  await input.fill("장애가 나도 유지할 초안");
  await input.press("Tab");
  await expect(
    page.getByRole("alert").filter({ hasText: "시험용 저장 실패" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "페이지 목록", exact: true }).click();
  await expect(page).toHaveURL(href);
  await expect(input).toHaveValue("장애가 나도 유지할 초안");
  await page.unroute(endpoint);
  await page.getByRole("link", { name: "페이지 목록", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${f.teamId}/docs$`));
  await page.goto(href);
  await expect(input).toHaveValue("장애가 나도 유지할 초안");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "운영 지식베이스" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("database-mobile.png") });
});

test("database UI persists owners, relations and rollups; dashboard shares workspace tokens", async ({
  page,
}, testInfo) => {
  const f = await createWorkspaceFixture();
  const call = <T>(
    path: string,
    body?: unknown,
    method: "GET" | "POST" | "PATCH" = body ? "POST" : "GET",
  ) =>
    jsonFetch<T>(`/team/${f.teamId}${path}`, {
      token: f.owner.token,
      body,
      method,
    });
  const source = (await call<KnowledgeDatabase>("/database", {
    name: "프로젝트",
  }))!.data!;
  const target = (await call<KnowledgeDatabase>("/database", {
    name: "지식베이스",
  }))!.data!;
  const number = (await call<DatabaseProperty>(
    `/database/${target.id}/property`,
    { name: "예상 시간", type: "number", revision: 0 },
  ))!.data!;
  await call(`/database/${target.id}/row`, { documentId: f.documentId });
  await call(
    `/database/${target.id}/row/${f.documentId}/${number.id}`,
    { value: 12, revision: 0 },
    "PATCH",
  );
  const doc = (await call<{ id: string }>("/document", {
    title: "출시 프로젝트",
  }))!.data!;
  await call(`/database/${source.id}/row`, { documentId: doc.id });
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs?database=${source.id}`);
  await page.getByRole("button", { name: "속성 추가", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "속성 추가" });
  await modal.getByLabel("속성 이름", { exact: true }).fill("참고 문서");
  await modal.getByLabel("유형", { exact: true }).selectOption("relation");
  await modal.getByLabel("연결할 데이터베이스").selectOption(target.id);
  await modal.getByRole("button", { name: "속성 만들기" }).click();
  await expect(modal).toHaveCount(0);
  const row = page
    .getByRole("row")
    .filter({
      has: page.getByRole("link", { name: "출시 프로젝트", exact: true }),
    });
  await row.getByLabel("출시 프로젝트 · 담당자", { exact: true }).click();
  await page.getByRole("dialog",{name:"출시 프로젝트 · 담당자",exact:true}).getByLabel(f.owner.username, { exact: true }).check();
  await expect(
    page.getByRole("status").filter({ hasText: "저장됨" }),
  ).toBeVisible();
  await row.getByLabel("출시 프로젝트 · 참고 문서", { exact: true }).click();
  const targetDoc = (await call<{ title: string }>(
    `/document/${f.documentId}`,
  ))!.data!;
  await page.getByRole("dialog",{name:"출시 프로젝트 · 참고 문서",exact:true}).getByLabel(targetDoc.title, { exact: true }).check();
  await expect(
    row.getByRole("link", { name: targetDoc.title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "속성 추가", exact: true }).click();
  await modal.getByLabel("속성 이름", { exact: true }).fill("총 시간");
  await modal.getByLabel("유형", { exact: true }).selectOption("rollup");
  await modal
    .getByLabel("관계형 속성", { exact: true })
    .selectOption({ label: "참고 문서" });
  await modal.getByLabel("계산", { exact: true }).selectOption("sum");
  await modal.getByLabel("집계할 숫자 속성").selectOption(number.id);
  await modal.getByRole("button", { name: "속성 만들기" }).click();
  await expect(
    row.getByLabel("출시 프로젝트 · 총 시간", { exact: true }),
  ).toHaveText("12");
  await page.reload();
  await expect(
    row.getByLabel("출시 프로젝트 · 총 시간", { exact: true }),
  ).toHaveText("12");
  await page.getByRole("button",{name:"필터",exact:true}).click();
  await page
    .getByRole("combobox", { name: "담당자 필터", exact: true })
    .selectOption(f.owner.userId);
  await page
    .getByRole("button", { name: "+ 보기 추가", exact: true })
    .click();
  await page.getByRole("textbox", { name: "보기 이름" }).fill("내 담당 문서");
  await page.getByRole("button", { name: "보기 저장", exact: true }).click();
  await page.getByRole("button", { name: "내 담당 문서", exact: true }).click();
  await expect(page).toHaveURL(/view=/);
  await page.reload();
  await page.getByRole("button",{name:"필터",exact:true}).click();
  await expect(
    page.getByRole("combobox", { name: "담당자 필터", exact: true }),
  ).toHaveValue(f.owner.userId);
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"담당자 속성 편집",exact:true}).click();
  const edit=page.getByRole("dialog");
  await edit.getByLabel("속성 이름",{exact:true}).fill("문서 담당자");
  await edit.getByRole("button",{name:"변경 적용",exact:true}).click();
  await expect(
    row.getByLabel("출시 프로젝트 · 문서 담당자", { exact: true }),
  ).toBeVisible();
  await row
    .getByRole("button", { name: `${targetDoc.title} 옆에 열기` })
    .click();
  await expect(page.locator("iframe")).toBeVisible();
  await expect(
    page.frameLocator("iframe").getByRole("textbox", { name: "페이지 제목" }),
  ).toHaveValue(targetDoc.title);
  const properties = page
    .frameLocator("iframe")
    .getByRole("region", { name: "데이터베이스 속성" });
  const hours = properties.getByRole("spinbutton", {
    name: `${targetDoc.title} · 예상 시간`,
  });
  await hours.fill("18");
  await hours.press("Tab");
  await expect(properties.getByRole("status")).toHaveText(
    "속성을 저장했습니다.",
  );

  await expect(
    row.getByLabel("출시 프로젝트 · 총 시간", { exact: true }),
  ).toHaveText("18");
  await page.screenshot({ path: testInfo.outputPath("database-split.png") });
  const tokens = await page
    .locator(".workspace-shell")
    .first()
    .evaluate((el) =>
      ["--color-bg-primary", "--color-action", "--color-border-primary"].map(
        (key) => getComputedStyle(el).getPropertyValue(key).trim(),
      ),
    );
  await page.goto("/dashboard");
  const dashboardTokens = await page
    .locator(".dashboard-shell")
    .evaluate((el) =>
      ["--color-bg-primary", "--color-action", "--color-border-primary"].map(
        (key) => getComputedStyle(el).getPropertyValue(key).trim(),
      ),
    );
  expect(dashboardTokens).toEqual(tokens);
  await page.screenshot({ path: testInfo.outputPath("dashboard.png") });
});

test("database API enforces document permissions, relation targets, typed cells and stale revision conflicts", async () => {
  const f = await createWorkspaceFixture();
  const guest = await createGuestSessionForTeam({
    ownerToken: f.owner.token,
    teamId: f.teamId,
  });
  const call = <T>(
    path: string,
    body?: unknown,
    method: "GET" | "POST" | "PATCH" = body ? "POST" : "GET",
    token = f.owner.token,
  ) => jsonFetch<T>(`/team/${f.teamId}${path}`, { token, body, method });
  const status = async (path: string, body: unknown, token = f.owner.token) =>
    (
      await fetch(`${e2eApiUrl}/team/${f.teamId}${path}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
    ).status;
  const a = (await call<KnowledgeDatabase>("/database", { name: "A" }))!.data!;
  const b = (await call<KnowledgeDatabase>("/database", { name: "B" }))!.data!;
  const source = (await call<{ id: string }>("/document", {
    title: "공유 문서",
  }))!.data!;
  const relation = (await call<DatabaseProperty>(`/database/${a.id}/property`, {
    name: "관계",
    type: "relation",
    targetDatabaseId: b.id,
    revision: 0,
  }))!.data!;
  const count = (await call<DatabaseProperty>(`/database/${a.id}/property`, {
    name: "개수",
    type: "rollup",
    relationPropertyId: relation.id,
    aggregation: "count",
    revision: 1,
  }))!.data!;
  await call(`/database/${a.id}/row`, { documentId: source.id });
  await Promise.all([
    call(`/database/${b.id}/row`, { documentId: f.documentId }),
    call(`/database/${b.id}/row`, { documentId: f.documentId }),
  ]);
  const cell = `/database/${a.id}/row/${source.id}`;
  expect(
    await status(`${cell}/${relation.id}`, { revision: 0, value: [source.id] }),
  ).toBe(404);
  expect(
    await status(
      `${cell}/owner`,
      { revision: 0, value: [f.owner.userId] },
      guest.token,
    ),
  ).toBe(403);
  expect(
    await status(`${cell}/owner`, { revision: 0, value: ["not-a-member"] }),
  ).toBe(400);
  expect(
    await status(`${cell}/reviewDate`, { revision: 0, value: "2026-02-31" }),
  ).toBe(400);
  expect(await status(`${cell}/${count.id}`, { revision: 0, value: 300 })).toBe(
    400,
  );
  await call(
    `${cell}/${relation.id}`,
    { revision: 0, value: [f.documentId] },
    "PATCH",
  );
  expect(await status(`${cell}/status`, { revision: 0, value: "게시됨" })).toBe(
    409,
  );
  await call(
    `/document/${f.documentId}`,
    { visibility: "restricted", allowedViewerIds: [] },
    "PATCH",
  );
  const actor = (await call<DatabaseDetail>(
    `/database/${a.id}`,
    undefined,
    "GET",
    f.actor.token,
  ))!.data!;
  expect(actor.rows[0].values[relation.id]).toEqual([]);
  expect(actor.rows[0].values[count.id]).toBe(0);
  expect(JSON.stringify(actor)).not.toContain(f.documentId);
  const own = (await call<DatabaseDetail>(`/database/${a.id}`))!.data!;
  expect(own.rows[0].values[count.id]).toBe(1);
  await call(
    `${cell}/${relation.id}`,
    { revision: 1, value: [] },
    "PATCH",
    f.actor.token,
  );
  const after = (await call<DatabaseDetail>(`/database/${a.id}`))!.data!;
  expect(after.rows[0].values[relation.id]).toEqual([f.documentId]);
  await call(
    `/document/${source.id}`,
    { visibility: "restricted", allowedViewerIds: [] },
    "PATCH",
  );
  expect(
    await status(`${cell}/owner`, { revision: 2, value: [guest.userId] }),
  ).toBe(400);
  await call(
    `/document/${source.id}`,
    { allowedViewerIds: [guest.userId, f.actor.userId] },
    "PATCH",
  );
  await call(
    `${cell}/owner`,
    { revision: 2, value: [guest.userId, f.actor.userId] },
    "PATCH",
  );
  const shared = (await call<DatabaseDetail>(`/database/${a.id}`))!.data!;
  expect(shared.rows[0].availablePersonIds).toContain(guest.userId);
  expect(shared.rows[0].values.owner).toEqual([guest.userId, f.actor.userId]);
  await call(`${cell}/mention`, { recipientIds: [guest.userId] });
  await expect
    .poll(async () => {
      const notifications = (await jsonFetch<
        Array<{ type: string; resourceId: string }>
      >(`/team/${f.teamId}/notification`, { token: guest.token }))!.data!;
      return notifications
        .filter((item) => item.resourceId === source.id)
        .map((item) => item.type)
        .sort();
    })
    .toEqual(["document_assigned", "mention"]);
});
