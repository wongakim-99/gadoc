import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import type {
  DatabaseDetail,
  DatabaseProperty,
} from "../../packages/web/src/features/database/model/types";

test("archived properties retain values, invalidate dependent formulas, and restore through UI", async ({
  page,
}) => {
  test.setTimeout(90000);
  const f = await createWorkspaceFixture();
  const base = `/team/${f.teamId}/database`;
  const db = (await jsonFetch<{ id: string }>(base, {
    method: "POST",
    token: f.owner.token,
    body: { name: "속성 복구" },
  }))!.data!;
  const endpoint = `${base}/${db.id}`;
  const call = <T>(
    path: string,
    body?: unknown,
    method = body ? "POST" : "GET",
  ) => jsonFetch<T>(endpoint + path, { method, body, token: f.owner.token });
  const p = (await call<DatabaseProperty>("/property", {
    name: "예산",
    type: "number",
    revision: 0,
  }))!.data!;
  const formula = (await call<DatabaseProperty>("/property", {
    name: "두 배",
    type: "formula",
    formula: 'prop("예산") * 2',
    revision: 1,
  }))!.data!;
  await call("/row", { documentId: f.documentId });
  await call(
    `/row/${f.documentId}/${p.id}`,
    { value: 42, revision: 0 },
    "PATCH",
  );
  await call(`/property/${p.id}/archive`, { revision: 2 });
  let read = (await call<DatabaseDetail>(""))!.data!;
  expect(read.properties.find((x) => x.id === p.id)).toBeUndefined();
  expect(read.archivedProperties?.find((x) => x.id === p.id)).toBeTruthy();
  expect(read.rows[0].values[p.id]).toBeUndefined();
  expect(read.rows[0].formulaErrors?.[formula.id]).toContain("삭제");
  await expect(
    call(`/row/${f.documentId}/${p.id}`, { value: 99, revision: 1 }, "PATCH"),
  ).rejects.toThrow("400");
  await expect(
    call(`/property/${p.id}/restore`, { revision: 2 }),
  ).rejects.toThrow("409");
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs?database=${db.id}`);
  await page.getByText("삭제된 속성 (1)", { exact: true }).click();
  await page.getByRole("button", { name: "예산 속성 복원" }).click();
  await expect(
    page.getByRole("table").getByText("84", { exact: true }),
  ).toBeVisible();
  await page.reload();
  read = (await call<DatabaseDetail>(""))!.data!;
  expect(read.rows[0].values[p.id]).toBe(42);
  expect(read.rows[0].values[formula.id]).toBe(84);
  expect(read.archivedProperties).toHaveLength(0);
  await page
    .getByRole("button", { name: "두 배 속성 편집", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "속성 설정" });
  await dialog
    .getByLabel("수식", { exact: true })
    .fill('let(multiplier, 3, prop("예산") * multiplier)');
  await dialog.getByRole("button", { name: "변경 적용" }).click();
  await expect(
    page.getByRole("table").getByText("126", { exact: true }),
  ).toBeVisible();
  await page.reload();
  read = (await call<DatabaseDetail>(""))!.data!;
  expect(read.rows[0].values[formula.id]).toBe(126);
});

test("structure lock preserves cell editing and row initialization and patches are atomic", async () => {
  const f = await createWorkspaceFixture();
  const root = `/team/${f.teamId}/database`;
  const db = (await jsonFetch<{ id: string }>(root, {
    method: "POST",
    token: f.owner.token,
    body: { name: "잠금 확인" },
  }))!.data!;
  const endpoint = `${root}/${db.id}`;
  const call = <T>(
    path: string,
    body?: unknown,
    method = body ? "POST" : "GET",
  ) => jsonFetch<T>(endpoint + path, { token: f.owner.token, body, method });
  await call("/lock", { locked: true, revision: 0 }, "PATCH");
  await expect(
    call("/property", { name: "차단", type: "text", revision: 1 }),
  ).rejects.toThrow("403");
  await expect(
    call("/row", {
      documentId: f.documentId,
      values: { status: "없는 상태", owner: [f.owner.userId] },
    }),
  ).rejects.toThrow("400");
  expect((await call<DatabaseDetail>(""))!.data!.rows).toHaveLength(0);
  await call("/row", {
    documentId: f.documentId,
    values: { status: "초안", owner: [f.owner.userId] },
  });
  await call(
    `/row/${f.documentId}`,
    { values: { status: "검토 중", reviewDate: "2026-10-30" }, revision: 0 },
    "PATCH",
  );
  await expect(
    call(
      `/row/${f.documentId}`,
      { values: { status: "게시됨", reviewDate: "invalid" }, revision: 1 },
      "PATCH",
    ),
  ).rejects.toThrow("400");
  let read = (await call<DatabaseDetail>(""))!.data!;
  expect(read.rows[0].values.status).toBe("검토 중");
  expect(read.rows[0].values.reviewDate).toBe("2026-10-30");
  expect(read.rows[0].revision).toBe(1);
  await call("/row", { documentId: f.documentId, values: { status: "초안" } });
  read = (await call<DatabaseDetail>(""))!.data!;
  expect(read.rows[0].values.status).toBe("검토 중");
  await call("/lock", { locked: false, revision: 1 }, "PATCH");
  await call("/property", { name: "허용", type: "text", revision: 2 });
});
