import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import type {
  DatabaseDetail,
  DatabaseProperty,
} from "../../packages/web/src/features/database/model/types";
test("server invalidations update another browser and preserve conflicting drafts", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const f = await createWorkspaceFixture();
  const root = `/team/${f.teamId}/database`;
  const db = (await jsonFetch<{ id: string }>(root, {
    method: "POST",
    token: f.owner.token,
    body: { name: "공동 편집" },
  }))!.data!;
  const api = `${root}/${db.id}`;
  const prop = (await jsonFetch<DatabaseProperty>(`${api}/property`, {
    method: "POST",
    token: f.owner.token,
    body: { name: "공유 메모", type: "text", revision: 0 },
  }))!.data!;
  await jsonFetch(`${api}/row`, {
    method: "POST",
    token: f.owner.token,
    body: { documentId: f.documentId },
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  let subscription = false;
  page.on("websocket", (socket) =>
    socket.on("framereceived", (event) => {
      if (String(event.payload).includes("database:changed"))
        subscription = true;
    }),
  );
  try {
    await loginWithSession(page, f.actor);
    await page.goto(`/${f.teamId}/docs?database=${db.id}`);
    const field = page.getByRole("textbox", { name: /· 공유 메모$/ });
    await expect(field).toBeVisible();
    await expect.poll(() => subscription).toBe(true);
    const write = (value: string, revision: number) =>
      jsonFetch(`${api}/row/${f.documentId}/${prop.id}`, {
        method: "PATCH",
        token: f.owner.token,
        body: { value, revision },
      });
    await write("서버에서 변경", 0);
    await expect(field).toHaveValue("서버에서 변경");
    await field.fill("내 작성 중인 초안");
    await write("다른 사용자의 변경", 1);
    await expect(
      page.getByText("다른 사용자가 이 항목을 변경했습니다.", { exact: false }),
    ).toBeVisible();
    await expect(field).toHaveValue("내 작성 중인 초안");
    await field.press("Tab");
    await expect(
      page.getByRole("alert").filter({ hasText: "다른 사용자가 수정했습니다" }),
    ).toBeVisible();
    let read = (await jsonFetch<DatabaseDetail>(api, { token: f.owner.token }))!
      .data!;
    expect(read.rows[0].values[prop.id]).toBe("다른 사용자의 변경");
    await page
      .getByRole("button", { name: "내 값으로 다시 저장", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await jsonFetch<DatabaseDetail>(api, { token: f.owner.token }))!
            .data!.rows[0].values[prop.id],
      )
      .toBe("내 작성 중인 초안");
    await expect(
      page.getByText("다른 사용자가 이 항목을 변경했습니다.", { exact: false }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});
