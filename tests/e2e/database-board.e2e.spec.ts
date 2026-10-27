import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import type {
  DatabaseDetail,
  DatabaseProperty,
} from "../../packages/web/src/features/database/model/types";
test("board cards move by dragging or keyboard controls and preserve custom grouping", async ({
  page,
}) => {
  test.setTimeout(90000);
  const f = await createWorkspaceFixture();
  const root = `/team/${f.teamId}/database`;
  const db = (await jsonFetch<{ id: string }>(root, {
    method: "POST",
    token: f.owner.token,
    body: { name: "프로젝트 보드" },
  }))!.data!;
  const api = `${root}/${db.id}`;
  const property = (await jsonFetch<DatabaseProperty>(`${api}/property`, {
    method: "POST",
    token: f.owner.token,
    body: {
      name: "단계",
      type: "select",
      options: ["대기", "진행", "완료"],
      revision: 0,
    },
  }))!.data!;
  await jsonFetch(`${api}/row`, {
    method: "POST",
    token: f.owner.token,
    body: { documentId: f.documentId },
  });
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs?database=${db.id}`);
  await page.getByRole("button", {name:"보기 옵션",exact:true}).click();
  await page.getByLabel("레이아웃", { exact: true }).selectOption("board");
  await page.keyboard.press("Escape");
  await page.getByLabel("보드 그룹 기준").selectOption(property.id);
  const source = page
    .getByRole("region", { name: "미지정 그룹" })
    .getByRole("button", { name: /카드 끌기/ });
  await source.dragTo(page.getByRole("region", { name: "진행 그룹" }));
  const value = async () =>
    (await jsonFetch<DatabaseDetail>(api, { token: f.owner.token }))!.data!
      .rows[0].values[property.id];
  await expect.poll(value).toBe("진행");
  await page
    .getByRole("region", { name: "진행 그룹" })
    .getByRole("combobox", { name: /그룹 이동/ })
    .selectOption("완료");
  await expect.poll(value).toBe("완료");
  await page
    .getByRole("button", { name: "+ 보기 추가", exact: true })
    .click();
  await page.getByLabel("보기 이름", { exact: true }).fill("단계별 보드");
  await page.getByRole("button", { name: "보기 저장", exact: true }).click();
  await page.getByRole("button", { name: "단계별 보드", exact: true }).click();
  await expect(page).toHaveURL(/view=/);
  await page.reload();
  await expect(page.getByLabel("보드 그룹 기준")).toHaveValue(property.id);
  await expect(
    page.getByRole("region", { name: "완료 그룹" }).getByRole("article"),
  ).toHaveCount(1);
});
