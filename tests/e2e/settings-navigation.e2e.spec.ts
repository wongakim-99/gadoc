import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

test("settings replaces the workspace menu without nesting another sidebar and preserves collapse preferences", async ({
  page,
}, info) => {
  const f = await createWorkspaceFixture();
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/channel/${f.channelId}`);
  await page
    .getByRole("button", { name: "사이드바 접기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "사이드바 펼치기", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "사용자 메뉴", exact: true }).click();
  await page.getByRole("link", { name: "내 계정", exact: true }).click();
  const sidebar = page.getByRole("complementary", {
    name: "워크스페이스 사이드바",
    exact: true,
  });
  const navigation = sidebar.getByRole("navigation", {
    name: "설정 섹션",
    exact: true,
  });
  await expect(navigation).toBeVisible();
  await expect(page.locator(".settings-layout aside")).toHaveCount(0);
  await expect(page.getByRole("complementary")).toHaveCount(1);
  await expect(
    navigation.getByRole("button", { name: "내 계정", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    sidebar.getByRole("link", { name: "채팅", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("로그인 이메일", { exact: true })).toHaveText(
    f.owner.email,
  );
  expect(
    (await page.locator(".settings-main").boundingBox())!.width,
  ).toBeGreaterThan(850);
  for (const label of [
    "화면과 테마",
    "알림",
    "초대와 권한",
    "전달과 연동",
    "AI 연결",
    "가져오기와 마이그레이션",
    "운영 이력",
  ]) {
    await navigation.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("button", { name: label, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "운영 이력", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("settings-single-sidebar-desktop.png"),
  });
  await sidebar
    .getByRole("link", { name: "워크스페이스로 돌아가기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "사이드바 펼치기", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "사이드바 펼치기", exact: true })
    .click();
  await expect(
    sidebar.getByRole("link", { name: "채팅", exact: true }),
  ).toBeVisible();
});

test("mobile settings uses one toggle, closes after section selection and keeps workspace switching available", async ({
  page,
}, info) => {
  const f = await createWorkspaceFixture();
  const other = (await jsonFetch<{ id: string }>("/team", {
    token: f.owner.token,
    method: "POST",
    body: {
      name: "설정 전환 검증",
      slug: `settings-${Date.now()}-${Math.round(Math.random() * 100000)}`,
      description: "isolated test",
    },
  }))!.data!;
  await loginWithSession(page, f.owner);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/${f.teamId}/settings?section=appearance`);
  const toggle = page.getByRole("button", {
    name: "워크스페이스 탐색",
    exact: true,
  });
  const nav = page.getByRole("navigation", { name: "설정 섹션", exact: true });
  await expect(nav).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "화면과 테마", exact: true }),
  ).toBeVisible();
  await toggle.click();
  await expect(nav).toBeVisible();
  await page.screenshot({
    path: info.outputPath("settings-single-sidebar-mobile-menu.png"),
  });
  await nav.getByRole("button", { name: "내 계정", exact: true }).click();
  await expect(page.getByLabel("로그인 이메일", { exact: true })).toHaveText(
    f.owner.email,
  );
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("settings-single-sidebar-mobile-content.png"),
  });
  await page
    .getByRole("button", { name: "워크스페이스 전환", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "워크스페이스 전환", exact: true })
    .getByRole("link", { name: "설정 전환 검증", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/${other.id}$`));
  await toggle.click();
  await expect(
    page
      .getByRole("navigation", { name: "워크스페이스 영역", exact: true })
      .getByRole("link", { name: "채팅", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "설정 섹션", exact: true }),
  ).toHaveCount(0);
});
