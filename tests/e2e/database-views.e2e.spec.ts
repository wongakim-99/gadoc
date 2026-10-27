import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import type { DatabaseDetail } from "../../packages/web/src/features/database/model/types";

test("calendar drag changes the date, saved view reloads, and alternate layouts use the same rows", async ({
  page,
}) => {
  test.setTimeout(90000);
  const f = await createWorkspaceFixture();
  const root = `/team/${f.teamId}/database`;
  const db = (await jsonFetch<{ id: string }>(root, {
    method: "POST",
    token: f.owner.token,
    body: { name: "보기 검증" },
  }))!.data!;
  const api = `${root}/${db.id}`;
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await jsonFetch(`${api}/row`, {
    method: "POST",
    token: f.owner.token,
    body: { documentId: f.documentId },
  });
  await jsonFetch(`${api}/row/${f.documentId}/reviewDate`, {
    method: "PATCH",
    token: f.owner.token,
    body: { value: `${prefix}-15`, revision: 0 },
  });
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs?database=${db.id}`);
  await page.getByRole("button", {name:"보기 옵션",exact:true}).click();
  await page.getByLabel("레이아웃", { exact: true }).selectOption("calendar");
  await page.keyboard.press("Escape");
  const calendar = page.getByRole("region", { name: "데이터베이스 달력" });
  await expect(calendar).toBeVisible();
  const original = calendar.locator(
    `[data-calendar-date="${prefix}-15"] [draggable="true"]`,
  );
  await original.dragTo(
    calendar.locator(`[data-calendar-date="${prefix}-17"]`),
  );
  await expect
    .poll(
      async () =>
        (await jsonFetch<DatabaseDetail>(api, { token: f.owner.token }))!.data!
          .rows[0].values.reviewDate,
    )
    .toBe(`${prefix}-17`);
  await expect(
    calendar.locator(`[data-calendar-date="${prefix}-17"] [draggable="true"]`),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "+ 보기 추가", exact: true })
    .click();
  await page.getByLabel("보기 이름", { exact: true }).fill("일정");
  await page.getByRole("button", { name: "보기 저장", exact: true }).click();
  await page.getByRole("button", { name: "일정", exact: true }).click();
  await expect(page).toHaveURL(/view=/);
  await page.reload();
  await expect(calendar).toBeVisible();
  for (const [layout, label] of [
    ["list", "데이터베이스 목록"],
    ["gallery", "데이터베이스 갤러리"],
    ["timeline", "데이터베이스 타임라인"],
    ["chart", "상태별 항목 수 차트"],
  ]) {
    await page.getByRole("button", {name:"보기 옵션",exact:true}).click();
    await page.getByLabel("레이아웃", { exact: true }).selectOption(layout);
    await page.keyboard.press("Escape");
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  }
});
