import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import type {
  DatabaseDetail,
  DatabaseProperty,
} from "../../packages/web/src/features/database/model/types";

test("formula results follow cell edits and stable references survive property renaming", async ({
  page,
}) => {
  test.setTimeout(90000);
  const f = await createWorkspaceFixture();
  const base = `/team/${f.teamId}/database`;
  const db = (await jsonFetch<{ id: string }>(base, {
    method: "POST",
    token: f.owner.token,
    body: { name: "수식 검증" },
  }))!.data!;
  const endpoint = `${base}/${db.id}`;
  let revision = 0;
  const property = async (name: string, type: string, formula?: string) =>
    (await jsonFetch<DatabaseProperty>(`${endpoint}/property`, {
      method: "POST",
      token: f.owner.token,
      body: { name, type, formula, revision: revision++ },
    }))!.data!;
  const price = await property("단가", "number");
  const qty = await property("수량", "number");
  const total = await property(
    "합계",
    "formula",
    'prop("단가") * prop("수량")',
  );
  const conditional = await property(
    "안내",
    "formula",
    'if(prop("합계") >= 100, "승인 필요", "바로 진행")',
  );
  const invalid = await property("오류 확인", "formula", '1 / prop("수량")');
  const created = await property("생성 일시", "created_time");
  const email = await property("연락 이메일", "email");
  await jsonFetch(`${endpoint}/row`, {
    method: "POST",
    token: f.owner.token,
    body: { documentId: f.documentId },
  });
  await jsonFetch(`${endpoint}/row/${f.documentId}/${price.id}`, {
    method: "PATCH",
    token: f.owner.token,
    body: { value: 30, revision: 0 },
  });
  await jsonFetch(`${endpoint}/row/${f.documentId}/${qty.id}`, {
    method: "PATCH",
    token: f.owner.token,
    body: { value: 4, revision: 1 },
  });
  let read = (await jsonFetch<DatabaseDetail>(endpoint, {
    token: f.owner.token,
  }))!.data!;
  expect(read.rows[0].values[total.id]).toBe(120);
  expect(read.rows[0].values[conditional.id]).toBe("승인 필요");
  expect(read.rows[0].values[created.id]).toMatch(/^\d{4}-/);
  await jsonFetch(`${endpoint}/property/${price.id}`, {
    method: "PATCH",
    token: f.owner.token,
    body: { name: "판매 가격", revision: revision++ },
  });
  read = (await jsonFetch<DatabaseDetail>(endpoint, { token: f.owner.token }))!
    .data!;
  expect(read.rows[0].values[total.id]).toBe(120);
  await expect(
    jsonFetch(`${endpoint}/row/${f.documentId}/${total.id}`, {
      method: "PATCH",
      token: f.owner.token,
      body: { value: 999, revision: 2 },
    }),
  ).rejects.toThrow("400");
  await expect(
    jsonFetch(`${endpoint}/row/${f.documentId}/${email.id}`, {
      method: "PATCH",
      token: f.owner.token,
      body: { value: "invalid", revision: 2 },
    }),
  ).rejects.toThrow("400");
  await jsonFetch(`${endpoint}/row/${f.documentId}/${qty.id}`, {
    method: "PATCH",
    token: f.owner.token,
    body: { value: 0, revision: 2 },
  });
  read = (await jsonFetch<DatabaseDetail>(endpoint, { token: f.owner.token }))!
    .data!;
  expect(read.rows[0].values[total.id]).toBe(0);
  expect(read.rows[0].formulaErrors?.[invalid.id]).toContain("0으로");
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs?database=${db.id}`);
  await expect(
    page.getByRole("table").getByText("수식 오류:", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "속성 추가", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "속성 추가" });
  await dialog.getByLabel("속성 이름", { exact: true }).fill("수식 UI");
  await dialog.getByRole("button", { name: "수식", exact: true }).click();
  await dialog
    .getByLabel("수식", { exact: true })
    .fill('prop("판매 가격") + 1');
  await dialog.getByRole("button", { name: "속성 만들기" }).click();
  await expect(
    page.getByRole("table").getByText("31", { exact: true }),
  ).toBeVisible();
});
