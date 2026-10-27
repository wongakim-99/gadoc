import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import type { DatabaseDetail } from "../../packages/web/src/features/database/model/types";

test("advanced query preserves nested filters and priority sorting across saved-view reload", async ({
  page,
}) => {
  test.setTimeout(90000);
  const f = await createWorkspaceFixture();
  const root = `/team/${f.teamId}/database`;
  const db = (await jsonFetch<{ id: string }>(root, {
    method: "POST",
    token: f.owner.token,
    body: { name: "고급 조회 검증" },
  }))!.data!;
  const api = `${root}/${db.id}`;
  for (const [title, status] of [
    ["계획 A", "초안"],
    ["계획 B", "게시됨"],
    ["기록 C", "검토 중"],
  ]) {
    const doc = (await jsonFetch<{ id: string }>(`/team/${f.teamId}/document`, {
      method: "POST",
      token: f.owner.token,
      body: { title, content: "", contentFormat: "json" },
    }))!.data!;
    await jsonFetch(`${api}/row`, {
      method: "POST",
      token: f.owner.token,
      body: { documentId: doc.id },
    });
    await jsonFetch(`${api}/row/${doc.id}/status`, {
      method: "PATCH",
      token: f.owner.token,
      body: { value: status, revision: 0 },
    });
  }
  const filter = {
    conjunction: "and",
    rules: [
      { propertyId: "title", operator: "contains", value: "계획" },
      {
        conjunction: "or",
        rules: [
          { propertyId: "status", operator: "equals", value: "초안" },
          { propertyId: "status", operator: "equals", value: "게시됨" },
        ],
      },
    ],
  };
  const result = (await jsonFetch<
    DatabaseDetail & { total: number; nextOffset: number | null }
  >(`${api}/query`, {
    method: "POST",
    token: f.owner.token,
    body: {
      filter,
      sorts: [{ propertyId: "title", direction: "descending" }],
      limit: 1,
    },
  }))!.data!;
  expect(result.total).toBe(2);
  expect(result.nextOffset).toBe(1);
  expect(result.rows[0].title).toBe("계획 B");
  await expect(
    jsonFetch(`${api}/query`, {
      method: "POST",
      token: f.owner.token,
      body: {
        filter: {
          conjunction: "or",
          rules: [{ propertyId: "missing", operator: "equals" }],
        },
      },
    }),
  ).rejects.toThrow("400");
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs?database=${db.id}`);
  await page.getByRole("button",{name:"필터",exact:true}).click();
  const builder = page.getByLabel("고급 조회 설정");
  await builder.getByRole("button", { name: "조건 추가", exact: true }).click();
  await builder.getByLabel("필터 값", { exact: true }).fill("계획");
  await expect(
    page.getByRole("table").getByRole("link", { name: "기록 C", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"정렬",exact:true}).click();
  await builder.getByRole("button", { name: "정렬 추가", exact: true }).click();
  await builder.getByLabel("정렬 방향").selectOption("descending");
  await expect(
    page
      .getByRole("table")
      .locator("tbody tr")
      .first()
      .getByRole("link", { name: "계획 B", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "+ 보기 추가", exact: true })
    .click();
  await page.getByLabel("보기 이름", { exact: true }).fill("계획만");
  await page.getByRole("button", { name: "보기 저장", exact: true }).click();
  await page.getByRole("button", { name: "계획만", exact: true }).click();
  await expect(page).toHaveURL(/view=/);
  await page.reload();
  await page.getByRole("button",{name:"필터",exact:true}).click();
  await expect(builder.getByLabel("필터 값", { exact: true })).toHaveValue(
    "계획",
  );
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(3);
  await expect(
    page
      .getByRole("table")
      .locator("tbody tr")
      .first()
      .getByRole("link", { name: "계획 B", exact: true }),
  ).toBeVisible();
});
