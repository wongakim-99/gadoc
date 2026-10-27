import { test, expect, type Page } from "playwright/test";
import sharp from "sharp";
import { createWorkspaceFixture } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

test.setTimeout(60_000);

async function sendPhotos(page: Page) {
  const fixture = await createWorkspaceFixture();
  await loginWithSession(page, fixture.owner);
  const channel = `/${fixture.teamId}/channel/${fixture.channelId}`;
  await page.goto(channel);
  const portrait = await sharp({
    create: { width: 320, height: 1280, channels: 3, background: "#157b8a" },
  })
    .png()
    .toBuffer();
  const landscape = await sharp({
    create: { width: 1280, height: 320, channels: 3, background: "#d79753" },
  })
    .png()
    .toBuffer();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "파일 첨부", exact: true }).click();
  await (
    await chooser
  ).setFiles([
    { name: "portrait.png", mimeType: "image/png", buffer: portrait },
    { name: "landscape.png", mimeType: "image/png", buffer: landscape },
  ]);
  await expect(page.getByText("2개 파일")).toBeVisible();
  await page
    .getByRole("button", { name: "메시지 보내기", exact: true })
    .click();
  const photo = page.getByRole("button", {
    name: "portrait.png 사진 보기",
    exact: true,
  });
  await expect(photo).toBeVisible();
  await expect
    .poll(() =>
      photo
        .locator("img")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  return { channel, portrait, photo };
}

test("chat photos keep their aspect ratio and open in an accessible in-app viewer without losing the conversation", async ({
  page,
  context,
}) => {
  const { channel, photo } = await sendPhotos(page);
  const pagesBefore = context.pages().length;
  await expect(photo.locator("img")).toHaveCSS("object-fit", "contain");
  await expect(photo.locator("img")).toHaveJSProperty("naturalHeight", 1280);
  await photo.click();
  const viewer = page.getByRole("dialog", { name: "사진 미리보기" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("button", { name: "사진 닫기" })).toBeFocused();
  await expect(viewer.getByRole("button", { name: "원본 크기" })).toBeEnabled();
  const original = viewer.getByRole("img", { name: "portrait.png" });
  await expect
    .poll(async () => {
      const bounds = await original.boundingBox();
      return bounds
        ? Math.abs(bounds.width / bounds.height - 0.25) < 0.01
        : false;
    })
    .toBe(true);
  await viewer.getByRole("button", { name: "원본 크기" }).click();
  await expect(original).toHaveCSS("max-height", "none");
  await viewer.getByRole("button", { name: "화면에 맞추기" }).click();
  await page.keyboard.press("ArrowRight");
  await expect(
    viewer.getByRole("img", { name: "landscape.png" }),
  ).toBeVisible();
  await expect(viewer.getByText("2 / 2")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(viewer.getByRole("img", { name: "portrait.png" })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "원본 크기" })).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(viewer.getByRole("button", { name: "원본 크기" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(viewer.getByRole("button", { name: "다음 사진" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(photo).toBeFocused();
  expect(new URL(page.url()).pathname).toBe(channel);
  expect(context.pages()).toHaveLength(pagesBefore);
  const download = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "portrait.png 다운로드", exact: true })
    .click();
  expect(await (await download).failure()).toBeNull();
  expect(new URL(page.url()).pathname).toBe(channel);
});

test("thread and mobile photo previews fit narrow containers and recover from a failed authorized request", async ({
  page,
}) => {
  const { channel, photo, portrait } = await sendPhotos(page);
  const message = page.locator("[data-message-id]").filter({ has: photo });
  await message.hover();
  await message.getByRole("button", { name: "스레드", exact: true }).click();
  const thread = page.locator("aside").filter({
    has: page.getByRole("heading", { name: "스레드", exact: true }),
  });
  const threadPhoto = thread.getByRole("button", {
    name: "portrait.png 사진 보기",
    exact: true,
  });
  const bounds = await threadPhoto.boundingBox();
  expect(bounds!.width).toBeGreaterThan(200);
  await threadPhoto.click();
  const viewer = page.getByRole("dialog", { name: "사진 미리보기" });
  await expect(viewer.getByRole("button", { name: "원본 크기" })).toBeEnabled();
  const fileUrl = await viewer.locator("img").getAttribute("src");
  await viewer.getByRole("button", { name: "사진 닫기" }).click();
  await expect(threadPhoto).toBeFocused();
  let fail = true;
  await page.route(
    (url) =>
      url.pathname === "/api/files" &&
      url.search === new URL(fileUrl!, page.url()).search,
    (route) =>
      fail
        ? route.fulfill({ status: 403, body: "Access denied" })
        : route.continue(),
  );
  await threadPhoto.click();
  await expect(viewer.getByText(/사진을 불러오지 못했습니다/)).toBeVisible();
  fail = false;
  await viewer.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(viewer.getByRole("button", { name: "원본 크기" })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const image = await viewer.locator("img").boundingBox();
      return (
        !!image &&
        image.x >= 0 &&
        image.x + image.width <= 390 &&
        image.height < 844
      );
    })
    .toBe(true);
  await page.screenshot({ path: "test-results/attachment-preview-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(threadPhoto).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await thread.getByRole("button", { name: "파일 첨부", exact: true }).click();
  await (
    await chooser
  ).setFiles({ name: "reply.png", mimeType: "image/png", buffer: portrait });
  await expect(thread.getByText("1개 파일")).toBeVisible();
  await thread
    .getByRole("button", { name: "메시지 보내기", exact: true })
    .click();
  const replyPhoto = thread.getByRole("button", {
    name: "reply.png 사진 보기",
    exact: true,
  });
  await expect(replyPhoto).toBeVisible();
  await replyPhoto.click();
  await expect(
    viewer.getByRole("img", { name: "reply.png", exact: true }),
  ).toBeVisible();
  await viewer.getByRole("button", { name: "사진 닫기" }).click();
  await expect(replyPhoto).toBeFocused();
  expect(new URL(page.url()).pathname).toBe(channel);
});
