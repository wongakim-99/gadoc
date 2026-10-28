import { expect, test, type Locator } from "playwright/test";
import { createWorkspaceFixture } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

async function pasteScreenshot(input: Locator, itemsOnly: boolean) {
  return input.evaluate(async (element, onlyItems) => {
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 32;
    canvas.getContext("2d")!.fillRect(0, 0, 48, 32);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/png"),
    );
    const clipboard = new DataTransfer();
    clipboard.items.add(
      new File([blob], "clipboard-capture.png", { type: "image/png" }),
    );
    if (onlyItems) Object.defineProperty(clipboard, "files", { value: [] });
    const event = new ClipboardEvent("paste", {
      clipboardData: clipboard,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  }, itemsOnly);
}

for (const itemsOnly of [false, true]) {
  test(`pastes and uploads a captured image without a focus rectangle (items-only=${itemsOnly})`, async ({
    page,
  }) => {
    const fixture = await createWorkspaceFixture();
    await loginWithSession(page, fixture.owner);
    await page.goto(`/${fixture.teamId}/channel/${fixture.channelId}`);
    const input = page.locator("textarea.chat-composer-input");
    await input.fill("Screenshot draft");
    await input.focus();
    await expect(input).toHaveCSS("outline-style", "none");
    await expect(input).toHaveCSS("box-shadow", "none");
    expect(await pasteScreenshot(input, itemsOnly)).toBe(true);
    const preview = page.getByRole("img", {
      name: "clipboard-capture.png",
      exact: true,
    });
    await expect(preview).toHaveCount(1);
    await expect(input).toHaveValue("Screenshot draft");
    if (itemsOnly) {
      await page.route(
        "**/api/channel/*/message/attachment",
        (route) =>
          route.fulfill({
            status: 503,
            json: { success: false, message: "Synthetic retry failure" },
          }),
        { times: 1 },
      );
      await input.press("Enter");
      await expect(page.locator('p[role="alert"]')).toBeVisible();
      await expect(input).toHaveValue("Screenshot draft");
      await expect(preview).toHaveCount(1);
    }
    await input.press("Enter");
    await expect(input).toHaveValue("");
    await expect(
      page.locator('[id^="message-"]').filter({ hasText: "Screenshot draft" }),
    ).toHaveCount(1);
    await expect
      .poll(() =>
        preview.evaluate(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  });
}

test("ordinary text paste is not intercepted", async ({ page }) => {
  const fixture = await createWorkspaceFixture();
  await loginWithSession(page, fixture.owner);
  await page.goto(`/${fixture.teamId}/channel/${fixture.channelId}`);
  const input = page.locator("textarea.chat-composer-input");
  await expect(input).toBeVisible();
  const prevented = await input.evaluate((element) => {
    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", "normal text");
    const event = new ClipboardEvent("paste", {
      clipboardData: clipboard,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
});
