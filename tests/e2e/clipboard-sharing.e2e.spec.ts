import { expect, test } from "playwright/test";
import {
  createWorkspaceFixture,
  e2eBaseUrl,
  jsonFetch,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

test("invite buttons copy their own unchanged codes, with native-denial fallback and honest total-failure UI", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await createWorkspaceFixture();
  const invite = await jsonFetch<{ code: string }>(
    `/team/${fixture.teamId}/invite-links`,
    {
      method: "POST",
      token: fixture.owner.token,
      body: {
        label: "복사 회귀 초대",
        defaultRole: "member",
        expiresInDays: 7,
      },
    },
  );
  const expected = `${e2eBaseUrl}/invite/${invite!.data!.code}`;
  await page.addInitScript(() => {
    const state = { copied: "", fallback: true };
    (window as any).__clipboardTest = state;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException(
            "Blocked by desktop policy",
            "NotAllowedError",
          );
        },
      },
    });
    document.execCommand = (command: string) => {
      if (command !== "copy" || !state.fallback) return false;
      state.copied = (document.activeElement as HTMLTextAreaElement).value;
      return true;
    };
  });
  await loginWithSession(page, fixture.owner);
  await page.goto(`/${fixture.teamId}/settings?section=access`);
  const item = page
    .locator("article")
    .filter({ has: page.getByText("복사 회귀 초대", { exact: true }) });
  await expect(item).toContainText(expected);
  await item.getByRole("button", { name: "링크 복사", exact: true }).click();
  await expect(item.getByRole("status")).toHaveText("복사했습니다.");
  expect(
    await page.evaluate(() => (window as any).__clipboardTest.copied),
  ).toBe(expected);
  await page
    .getByRole("button", { name: "활성 링크 복사", exact: true })
    .click();
  expect(
    await page.evaluate(() => (window as any).__clipboardTest.copied),
  ).toBe(expected);
  await page.evaluate(() => {
    (window as any).__clipboardTest.fallback = false;
  });
  await item.getByRole("button", { name: "링크 복사", exact: true }).click();
  await expect(item.getByRole("status")).toHaveCount(0);
  await expect(item.getByRole("alert")).toContainText("자동 복사가 차단");
  await expect(
    item.getByRole("textbox", { name: "직접 복사할 내용" }),
  ).toHaveValue(expected);
  await expect(
    item.getByRole("textbox", { name: "직접 복사할 내용" }),
  ).toBeFocused();
  await jsonFetch(
    `/team/${fixture.teamId}/invite-links/${invite!.data!.code}/revoke`,
    { method: "PATCH", token: fixture.owner.token },
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "활성 링크 복사", exact: true }),
  ).toBeDisabled();
  await expect(item).toContainText(expected);
});

test("native clipboard success is observable after an actual copy gesture", async ({
  page,
  context,
}) => {
  const fixture = await createWorkspaceFixture();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await jsonFetch(`/team/${fixture.teamId}/invite-links`, {
    method: "POST",
    token: fixture.owner.token,
    body: { label: "실제 복사 테스트", defaultRole: "member" },
  });
  await loginWithSession(page, fixture.owner);
  await page.goto(`/${fixture.teamId}/settings?section=access`);
  await page
    .getByRole("button", { name: "활성 링크 복사", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "복사했습니다." }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /\/invite\/[A-Za-z0-9_-]+$/,
  );
});
