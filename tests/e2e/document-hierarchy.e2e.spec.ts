import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

test("create nested pages, preserve parent edits, retry failures and navigate the hierarchy", async ({
  page,
}, testInfo) => {
  const fixture = await createWorkspaceFixture();
  await loginWithSession(page, fixture.owner);
  const rootUrl = `/${fixture.teamId}/docs/${fixture.documentId}`;
  await page.goto(rootUrl);
  const title = page.getByRole("textbox", { name: "페이지 제목", exact: true });
  await expect(title).toBeEnabled();
  await title.fill("제품 가이드");
  const create = page.getByRole("button", {
    name: "하위 페이지 추가",
    exact: true,
  });
  await page.route(`**/api/team/${fixture.teamId}/document`, async (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({
        status: 503,
        json: { success: false, message: "생성 시험 오류" },
      });
    return route.continue();
  });
  await create.click();
  await expect(
    page.getByRole("alert").filter({ hasText: /생성|하위/ }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(rootUrl + "$"));
  await expect(title).toHaveValue("제품 가이드");
  await page.unroute(`**/api/team/${fixture.teamId}/document`);
  const ancestors = [{ id: fixture.documentId, title: "제품 가이드" }];
  for (const nextTitle of ["시작하기", "설치 방법", "문제 해결"]) {
    await create.click();
    await expect(page).toHaveURL(/\?new=1$/);
    await expect(title).toBeEnabled();
    await expect(title).toBeFocused();
    const id = new URL(page.url()).pathname.split("/").at(-1)!;
    const saved = await jsonFetch<{ parentId: string }>(
      `/team/${fixture.teamId}/document/${id}`,
      { token: fixture.owner.token },
    );
    expect(saved?.data?.parentId).toBe(ancestors.at(-1)!.id);
    const breadcrumbs = page.getByRole("navigation", { name: "페이지 경로" });
    for (const parent of ancestors)
      await expect(
        breadcrumbs.getByRole("link", { name: parent.title, exact: true }),
      ).toBeVisible();
    await title.fill(nextTitle);
    ancestors.push({ id, title: nextTitle });
  }
  await expect(page.locator('header [role="status"]')).toHaveText("저장됨");
  await page.reload();
  await expect(title).toHaveValue("문제 해결");
  const sidebar = page.getByRole("complementary", {
    name: "워크스페이스 사이드바",
  });
  await expect(
    sidebar.getByRole("img", { name: "GaDoc", exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("link", {
      name: `${fixture.teamName} · 워크스페이스 전환`,
    }),
  ).toBeVisible();
  for (const parent of ancestors)
    await expect(
      sidebar.getByRole("link", { name: parent.title, exact: true }),
    ).toBeVisible();
  await title.blur();
  await page.screenshot({
    path: testInfo.outputPath("document-hierarchy.png"),
  });
  await page
    .getByRole("navigation", { name: "페이지 경로" })
    .getByRole("link", { name: "제품 가이드", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "하위 페이지", exact: true })
      .getByRole("link", { name: "시작하기", exact: true }),
  ).toBeVisible();
  const add = sidebar.getByRole("link", {
    name: "제품 가이드 아래 페이지 추가",
    exact: true,
  });
  await sidebar.getByRole("link", { name: "제품 가이드", exact: true }).hover();
  await add.click();
  await expect(
    page.getByText("생성 위치: 제품 가이드 / 하위 페이지"),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "문서 제목", exact: true })
    .fill("팀 운영");
  await page.getByRole("button", { name: "생성", exact: true }).click();
  await expect(title).toHaveValue("팀 운영");
  await expect(
    page
      .getByRole("navigation", { name: "페이지 경로" })
      .getByRole("link", { name: "제품 가이드", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "워크스페이스 탐색", exact: true })
    .click();
  await expect(
    sidebar.getByRole("link", {
      name: "제품 가이드 아래 페이지 추가",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
