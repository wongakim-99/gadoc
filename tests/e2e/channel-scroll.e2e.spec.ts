import { expect, test, type Page } from "playwright/test";
import {
  createChannel,
  createWorkspaceFixture,
  jsonFetch,
  sendSocketMessages,
  type WorkspaceFixture,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

test.describe("channel viewport restoration", () => {
  let fixture: WorkspaceFixture;
  let otherChannelId: string;
  let messageIds: string[];

  test.beforeAll(async () => {
    fixture = await createWorkspaceFixture();
    otherChannelId = await createChannel({
      teamId: fixture.teamId,
      token: fixture.owner.token,
      name: "scroll-other",
      type: "public",
    });
    messageIds = await sendSocketMessages({
      session: fixture.actor,
      teamId: fixture.teamId,
      channelId: fixture.channelId,
      contents: Array.from(
        { length: 85 },
        (_, index) => `Scroll message ${index}: line one\nline two\nline three`,
      ),
    });
    await sendSocketMessages({
      session: fixture.actor,
      teamId: fixture.teamId,
      channelId: otherChannelId,
      contents: Array.from(
        { length: 30 },
        (_, index) => `Other room ${index}\nAnother line`,
      ),
    });
    await jsonFetch(`/channel/${fixture.channelId}/read`, {
      method: "PATCH",
      token: fixture.owner.token,
    });
    await jsonFetch(`/channel/${otherChannelId}/read`, {
      method: "PATCH",
      token: fixture.owner.token,
    });
  });

  const channelPath = () => `/${fixture.teamId}/channel/${fixture.channelId}`;
  const storageKey = () =>
    `slacord:channel-viewport-anchor:v2:${JSON.stringify([fixture.owner.userId, fixture.teamId, fixture.channelId])}`;
  const scroller = (page: Page) =>
    page
      .locator('[id^="message-"]')
      .first()
      .locator('xpath=ancestor::div[contains(@class,"overflow-y-auto")][1]');
  const offset = (page: Page, messageId: string) =>
    page.locator(`#message-${messageId}`).evaluate((element) => {
      const parent = element.closest(".overflow-y-auto")!;
      return (
        element.getBoundingClientRect().top - parent.getBoundingClientRect().top
      );
    });

  test("first visit opens at the latest message with a bounded chat scroller", async ({
    page,
  }) => {
    await loginWithSession(page, fixture.owner);
    await page.goto(channelPath());
    await expect(
      page.locator(`#message-${messageIds.at(-1)}`),
    ).toBeInViewport();
    await expect
      .poll(() =>
        scroller(page).evaluate(
          (element) =>
            element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
      )
      .toBeLessThan(5);
    await expect
      .poll(() => scroller(page).evaluate((element) => element.clientHeight))
      .toBeLessThan(960);
  });

  test("restores the exact reading position after a sidebar round trip and reload", async ({
    page,
  }) => {
    await loginWithSession(page, fixture.owner);
    await page.goto(channelPath());
    await expect(page.locator(`#message-${messageIds.at(-1)}`)).toBeAttached();
    const anchorId = messageIds[60];
    await page.locator(`#message-${anchorId}`).evaluate((element) => {
      const parent = element.closest(".overflow-y-auto")!;
      parent.scrollTop +=
        element.getBoundingClientRect().top -
        parent.getBoundingClientRect().top +
        17;
    });
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(sessionStorage.getItem(key) || "null")?.messageId,
          storageKey(),
        ),
      )
      .toBe(anchorId);
    const savedOffset = await offset(page, anchorId);
    await page
      .getByRole("link", { name: "# scroll-other", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(otherChannelId));
    await page
      .getByRole("link", { name: `# ${fixture.channelName}`, exact: true })
      .click();
    await expect
      .poll(async () => Math.abs((await offset(page, anchorId)) - savedOffset))
      .toBeLessThan(3);
    await page.reload();
    await expect
      .poll(async () => Math.abs((await offset(page, anchorId)) - savedOffset))
      .toBeLessThan(3);
  });

  test("loads an old saved anchor beyond the first history page", async ({
    page,
  }) => {
    await loginWithSession(page, fixture.owner);
    const response = await jsonFetch<Array<{ id: string; createdAt: string }>>(
      `/channel/${fixture.channelId}/message?limit=100`,
      { token: fixture.owner.token },
    );
    const messages = response.data ?? [];
    const message = messages.find((item) => item.id === messageIds[10])!;
    expect(message).toBeTruthy();
    await page.evaluate(
      ({ key, anchor }) => sessionStorage.setItem(key, JSON.stringify(anchor)),
      {
        key: storageKey(),
        anchor: {
          messageId: message.id,
          createdAt: message.createdAt,
          offset: -11,
          atBottom: false,
        },
      },
    );
    await page.goto(channelPath());
    await expect(page.locator(`#message-${message.id}`)).toBeAttached();
    await expect
      .poll(async () => Math.abs((await offset(page, message.id)) + 11))
      .toBeLessThan(3);
  });

  test("an explicit message link takes precedence over a saved reading position", async ({
    page,
  }) => {
    await loginWithSession(page, fixture.owner);
    await page.goto(channelPath());
    const targetId = messageIds[65];
    await page.goto(`${channelPath()}?message=${targetId}`);
    await expect(page.locator(`#message-${targetId}`)).toBeInViewport();
  });

  test("keeps a reading position when a live message arrives", async ({
    page,
  }) => {
    await loginWithSession(page, fixture.owner);
    await page.goto(channelPath());
    const anchorId = messageIds[60];
    await expect(page.locator(`#message-${anchorId}`)).toBeAttached();
    await page.locator(`#message-${anchorId}`).evaluate((element) => {
      const parent = element.closest(".overflow-y-auto")!;
      parent.scrollTop +=
        element.getBoundingClientRect().top -
        parent.getBoundingClientRect().top +
        17;
    });
    const before = await offset(page, anchorId);
    const [newId] = await sendSocketMessages({
      session: fixture.actor,
      teamId: fixture.teamId,
      channelId: fixture.channelId,
      contents: ["Live message while reading history"],
    });
    await expect(page.locator(`#message-${newId}`)).toBeAttached();
    await expect
      .poll(async () => Math.abs((await offset(page, anchorId)) - before))
      .toBeLessThan(3);
    await expect(page.locator(`#message-${newId}`)).not.toBeInViewport();
  });

  test("returns to the bottom after leaving at the bottom, including on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginWithSession(page, fixture.owner);
    await page.goto(channelPath());
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(sessionStorage.getItem(key) || "null")?.atBottom,
          storageKey(),
        ),
      )
      .toBe(true);
    await page.goto(`/${fixture.teamId}/issues`);
    const [newId] = await sendSocketMessages({
      session: fixture.actor,
      teamId: fixture.teamId,
      channelId: fixture.channelId,
      contents: ["New message before returning to the bottom"],
    });
    await page.goto(channelPath());
    await expect(page.locator(`#message-${newId}`)).toBeInViewport();
    await expect
      .poll(() =>
        scroller(page).evaluate(
          (element) =>
            element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
      )
      .toBeLessThan(5);
  });
});
