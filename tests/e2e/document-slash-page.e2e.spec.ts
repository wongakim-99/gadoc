import { test, expect, type Page } from "playwright/test";
import {
  createWorkspaceFixture,
  jsonFetch,
  createGuestSessionForTeam,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import { failDocumentUpdates } from './support/document-socket';

test.setTimeout(90000);
async function slash(page: Page, query: string) {
  const editor = page.locator('.bn-editor[contenteditable="true"]');
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(`/${query}`);
  await expect(page.getByRole("option", { name: /페이지/ })).toBeVisible();
}

test("slash page creates a nested page, saves the inline link and focuses the new title", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs/${f.documentId}`);
  await expect(
    page.getByRole("textbox", { name: "페이지 제목" }),
  ).toBeEnabled();
  await slash(page, "page");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/docs\/[a-f0-9]+\?new=1$/);
  const childId = new URL(page.url()).pathname.split("/").at(-1)!;
  expect(childId).not.toBe(f.documentId);
  await expect(
    page.getByRole("textbox", { name: "페이지 제목" }),
  ).toBeFocused();
  const child = (await jsonFetch<{ parentId: string }>(
    `/team/${f.teamId}/document/${childId}`,
    { token: f.owner.token },
  ))!.data!;
  expect(child.parentId).toBe(f.documentId);
  const parent = (await jsonFetch<{ content: string }>(
    `/team/${f.teamId}/document/${f.documentId}`,
    { token: f.owner.token },
  ))!.data!;
  expect(parent.content).toContain(`/docs/${childId}`);
  expect(parent.content).not.toContain("/page");
  await page.goto(`/${f.teamId}/docs/${f.documentId}`);
  await expect(
    page.locator(`.bn-editor a[href="/${f.teamId}/docs/${childId}"]`),
  ).toBeVisible();
  await slash(page, "페이지");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(f.documentId));
});

test("slash creation stops on parent save failure and retries without losing content", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  let failUpdates = true;
  await failDocumentUpdates(page, () => failUpdates);
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs/${f.documentId}`);
  await expect(
    page.getByRole("textbox", { name: "페이지 제목" }),
  ).toBeEnabled();
  await page.route(
    `**/api/team/${f.teamId}/document/${f.documentId}`,
    (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 503, json: { success: false } })
        : route.continue(),
  );
  await slash(page, "page");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "다시 시도", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(f.documentId));
  expect(
    (await jsonFetch<Array<{ parentId: string }>>(
      `/team/${f.teamId}/document`,
      { token: f.owner.token },
    ))!.data!.filter((doc) => doc.parentId === f.documentId),
  ).toHaveLength(0);
  await page.unrouteAll({ behavior: "wait" });
  failUpdates = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await slash(page, "page");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\?new=1$/);
  expect(
    (await jsonFetch<Array<{ parentId: string }>>(
      `/team/${f.teamId}/document`,
      { token: f.owner.token },
    ))!.data!.filter((doc) => doc.parentId === f.documentId),
  ).toHaveLength(1);
});

test("read-only guests cannot create subpages from the editor", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const guest = await createGuestSessionForTeam({
    ownerToken: f.owner.token,
    teamId: f.teamId,
  });
  await loginWithSession(page, guest);
  await page.goto(`/${f.teamId}/docs/${f.documentId}`);
  await expect(page.getByTestId("document-content")).toBeVisible();
  await expect(page.locator('.bn-editor[contenteditable="true"]')).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "하위 페이지 추가", exact: true }),
  ).toHaveCount(0);
});

test("a created child remains recoverable when saving its parent link fails", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  let failUpdates = false;
  await failDocumentUpdates(page, () => failUpdates);
  page.on('response', (response) => {
    if (response.ok() && response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/team/${f.teamId}/document`) failUpdates = true;
  });
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs/${f.documentId}`);
  await expect(
    page.getByRole("textbox", { name: "페이지 제목" }),
  ).toBeEnabled();
  await page.route(
    `**/api/team/${f.teamId}/document/${f.documentId}`,
    (route) => {
      const body = route.request().postDataJSON();
      return route.request().method() === "PATCH" &&
        body?.content?.includes(`/docs/`)
        ? route.fulfill({ status: 503, json: { success: false } })
        : route.continue();
    },
  );
  await slash(page, "page");
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("하위 페이지는 생성됐지만 본문 링크 저장에 실패했습니다.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(f.documentId));
  const children = (await jsonFetch<Array<{ id: string; parentId: string }>>(
    `/team/${f.teamId}/document`,
    { token: f.owner.token },
  ))!.data!.filter((doc) => doc.parentId === f.documentId);
  expect(children).toHaveLength(1);
  await page.unrouteAll({ behavior: "wait" });
  failUpdates = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await jsonFetch<{ content: string }>(
          `/team/${f.teamId}/document/${f.documentId}`,
          { token: f.owner.token },
        ))!.data!.content,
    )
    .toContain(children[0].id);
  await page.reload();
  await expect(
    page.locator(`.bn-editor a[href="/${f.teamId}/docs/${children[0].id}"]`),
  ).toBeVisible();
});
