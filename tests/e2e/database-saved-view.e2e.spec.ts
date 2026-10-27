import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import type {
  DatabaseDetail,
  DatabaseView,
} from "../../packages/web/src/features/database/model/types";
test("a new database persists its default view without requiring a view creation step", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const db = (await jsonFetch<{ id: string }>(`/team/${f.teamId}/database`, {
    token: f.owner.token,
    method: "POST",
    body: { name: "Default view" },
  }))!.data!;
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs?database=${db.id}`);
  const resize = page.getByRole("separator", {
    name: "상태 열 너비",
    exact: true,
  });
  await expect(resize).toHaveAttribute("aria-valuenow", "140");
  await resize.focus();
  await resize.press("ArrowRight");
  await expect
    .poll(
      async () =>
        (await jsonFetch<DatabaseDetail>(
          `/team/${f.teamId}/database/${db.id}`,
          { token: f.owner.token },
        ))!.data!.views[0].columnWidths?.status,
    )
    .toBe(160);
  await page.reload();
  await expect(resize).toHaveAttribute("aria-valuenow", "160");
});
test("full page saved view settings autosave and survive reload without creating duplicate views", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const call = async <T>(
    path: string,
    body?: unknown,
    method = body ? "POST" : "GET",
  ) =>
    (await jsonFetch<T>(`/team/${f.teamId}${path}`, {
      token: f.owner.token,
      body,
      method,
    }))!.data!;
  const db = await call<{ id: string }>("/database", { name: "Saved views" });
  const api = `/database/${db.id}`;
  const config = {
    name: "Project table",
    layout: "table",
    query: "",
    status: "",
    owner: "",
    sort: "title",
    revision: 0,
  };
  const view = await call<DatabaseView>(`${api}/view`, config);
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs?database=${db.id}&view=${view.id}`);
  const resize = page.getByRole("separator", {
    name: "상태 열 너비",
    exact: true,
  });
  await expect(resize).toHaveAttribute("aria-valuenow", "140");
  await resize.focus();
  await resize.press("ArrowRight");
  await expect
    .poll(
      async () =>
        (await call<DatabaseDetail>(api)).views.find(
          (item) => item.id === view.id,
        )?.columnWidths?.status,
    )
    .toBe(160);
  await page.reload();
  await expect(resize).toHaveAttribute("aria-valuenow", "160");
  expect((await call<DatabaseDetail>(api)).views).toHaveLength(2);
  let rejected = false;
  await page.route(
    `**/api/team/${f.teamId}/database/${db.id}/view/${view.id}`,
    async (route) => {
      if (!rejected && route.request().method() === "PATCH") {
        rejected = true;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Temporary view save failure" }),
        });
      } else await route.continue();
    },
  );
  await resize.focus();
  await resize.press("ArrowRight");
  await page
    .getByRole("button", { name: "내 보기 설정으로 다시 저장", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await call<DatabaseDetail>(api)).views.find(
          (item) => item.id === view.id,
        )?.columnWidths?.status,
    )
    .toBe(180);
  await expect(
    call(`${api}/view/${view.id}`, { ...config, revision: 1 }, "PATCH"),
  ).rejects.toThrow("409");
  let detail = await call<DatabaseDetail>(api);
  await call(`${api}/view/default/remove`, { revision: detail.revision });
  detail = await call<DatabaseDetail>(api);
  await expect(
    call(`${api}/view/${view.id}/remove`, { revision: detail.revision }),
  ).rejects.toThrow("400");
  await call(`${api}/view`, {
    ...config,
    name: "Another view",
    revision: detail.revision,
  });
  detail = await call<DatabaseDetail>(api);
  await call(`${api}/view/${view.id}/remove`, { revision: detail.revision });
  expect((await call<DatabaseDetail>(api)).views).toHaveLength(1);
});
