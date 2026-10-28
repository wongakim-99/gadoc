import { expect, test } from "playwright/test";
import {
  createWorkspaceFixture,
  jsonFetch,
  type WorkspaceFixture,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

test.describe("issue filter controls", () => {
  let fixture: WorkspaceFixture;
  test.beforeAll(async () => {
    fixture = await createWorkspaceFixture();
    for (const [title, assigneeIds, status] of [
      ["Assigned open", [fixture.owner.userId], "todo"],
      ["Assigned complete", [fixture.owner.userId], "done"],
      ["Unassigned open", [], "todo"],
    ] as const) {
      const result = await jsonFetch<{ id: string }>(
        `/team/${fixture.teamId}/issue`,
        {
          method: "POST",
          token: fixture.owner.token,
          body: { title, priority: "medium", assigneeIds },
        },
      );
      if (status !== "todo")
        await jsonFetch(`/team/${fixture.teamId}/issue/${result.data!.id}`, {
          method: "PATCH",
          token: fixture.owner.token,
          body: { status },
        });
    }
  });

  test("uses consistent menus and combines assignee, status, search and reset", async ({
    page,
  }) => {
    await loginWithSession(page, fixture.owner);
    await page.goto(`/${fixture.teamId}/issues`);
    const assignee = page.getByRole("combobox", {
      name: "\ub2f4\ub2f9\uc790 \ud544\ud130",
    });
    const status = page.getByRole("combobox", {
      name: "\uc0c1\ud0dc \ud544\ud130",
    });
    const reset = page.getByRole("button", {
      name: "\ucd08\uae30\ud654",
      exact: true,
    });
    await expect(reset).toBeDisabled();
    await assignee.click();
    const list = page.getByRole("listbox", {
      name: "\ub2f4\ub2f9\uc790 \ud544\ud130",
    });
    await expect(list).toBeVisible();
    await page.screenshot({ path: "/tmp/gadoc-issue-filter-desktop.png" });
    await list
      .getByRole("option", { name: fixture.owner.username, exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Unassigned open/ }).first(),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Assigned open/ }).first(),
    ).toBeVisible();
    await status.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await expect(status).toContainText("\uc644\ub8cc");
    await expect(
      page.getByRole("button", { name: /Assigned complete/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Assigned open/ }).first(),
    ).toHaveCount(0);
    await status.click();
    await page.keyboard.press("Escape");
    await expect(status).toBeFocused();
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await reset.click();
    await expect(
      page.getByRole("button", { name: /Unassigned open/ }).first(),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "\uc774\uc288 \uac80\uc0c9" })
      .fill("Assigned complete");
    await expect(
      page.getByRole("button", { name: /Assigned open/ }).first(),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Assigned complete/ }).first(),
    ).toBeVisible();
  });

  test("fits mobile and preserves unassigned filtering and outside dismissal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginWithSession(page, fixture.owner);
    await page.goto(`/${fixture.teamId}/issues`);
    const assignee = page.getByRole("combobox", {
      name: "\ub2f4\ub2f9\uc790 \ud544\ud130",
    });
    await assignee.click();
    const list = page.getByRole("listbox", {
      name: "\ub2f4\ub2f9\uc790 \ud544\ud130",
    });
    await expect(list).toBeVisible();
    const box = (await list.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: "/tmp/gadoc-issue-filter-mobile.png" });
    await list
      .getByRole("option", { name: "\ubbf8\ud560\ub2f9", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Unassigned open/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Assigned open/ }).first(),
    ).toHaveCount(0);
    await assignee.click();
    await page
      .getByRole("textbox", { name: "\uc774\uc288 \uac80\uc0c9" })
      .click();
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  });
});
