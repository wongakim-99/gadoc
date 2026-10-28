import { expect, test, type Page } from "playwright/test";
import {
  createUserSession,
  createWorkspaceFixture,
  e2eApiUrl,
  e2eBaseUrl,
  jsonFetch,
  sendSocketMessage,
  type AuthSession,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const serverRequire = createRequire(resolve("packages/server/package.json"));

// Synthetic data only: opt-in local stack, or the repository's disposable CI stack.
const localProfileStack = process.env.SLACORD_PROFILE_VERIFY === "1";
const disposableCiStack =
  process.env.GITHUB_ACTIONS === "true" &&
  process.env.MONGODB_URI === "mongodb://127.0.0.1:27017/slacord_ci" &&
  process.env.MINIO_BUCKET === "slacord-ci";
test.skip(
  !localProfileStack && !disposableCiStack,
  "Requires the dedicated local or disposable CI verification stack.",
);
test.beforeAll(() => {
  if (
    localProfileStack &&
    (e2eApiUrl !== "http://127.0.0.1:18095/api" ||
      e2eBaseUrl !== "http://127.0.0.1:3203")
  ) {
    throw new Error(
      "Use the dedicated local profile verification DB/bucket and API18095/web3203.",
    );
  }
  if (
    disposableCiStack &&
    (e2eApiUrl !== "http://127.0.0.1:8084/api" ||
      e2eBaseUrl !== "http://127.0.0.1:3002")
  )
    throw new Error("Unexpected CI verification origins.");
});
test.use({ trace: "off", video: "off", screenshot: "off" });

const headers = (session: AuthSession) => ({
  Authorization: `Bearer ${session.token}`,
});
const apiUrl = (url: string) => new URL(url, e2eApiUrl).href;
async function upload(
  session: AuthSession,
  bytes: Buffer,
  type = "image/png",
  extra?: [string, string],
) {
  const body = new FormData();
  body.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type }),
    "synthetic-image",
  );
  if (extra) body.append(...extra);
  return fetch(`${e2eApiUrl}/auth/me/avatar`, {
    method: "POST",
    headers: headers(session),
    body,
  });
}
async function image(
  page: Page,
  type = "image/png",
  width = 8,
  height = 8,
  color = "#4668d9",
) {
  const data = await page.evaluate(
    ({ type, width, height, color }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d")!;
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
      return canvas.toDataURL(type);
    },
    { type, width, height, color },
  );
  expect(data.startsWith(`data:${type};`)).toBe(true);
  return Buffer.from(data.split(",")[1], "base64");
}
function gif(frames = 1, side = 1) {
  const header = Buffer.alloc(19);
  header.write("GIF89a");
  header.writeUInt16LE(side, 6);
  header.writeUInt16LE(side, 8);
  header[10] = 0x80;
  header[16] = header[17] = header[18] = 255;
  const frame = Buffer.from([
    0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0,
  ]);
  return Buffer.concat([
    header,
    ...Array.from({ length: frames }, () => frame),
    Buffer.from([0x3b]),
  ]);
}
async function current(session: AuthSession) {
  return (
    await jsonFetch<{ avatarUrl: string | null }>("/auth/me", {
      token: session.token,
    })
  ).data!.avatarUrl;
}
async function remove(session: AuthSession) {
  return fetch(`${e2eApiUrl}/auth/me/avatar`, {
    method: "DELETE",
    headers: headers(session),
  });
}
function avatar(page: Page, id: string) {
  return page.locator(`[data-avatar-user="${id}"] img`);
}
async function assertImage(page: Page, id: string, url: string) {
  await expect(avatar(page, id).first()).toHaveAttribute("src", url);
  await expect
    .poll(() =>
      avatar(page, id)
        .first()
        .evaluate(
          (element: HTMLImageElement) =>
            element.complete && element.naturalWidth > 0,
        ),
    )
    .toBe(true);
}

test("profile API validates images and enforces self writes, current image ACL and private storage", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const fixture = await createWorkspaceFixture();
  const personal = await createUserSession("profile-personal");
  const png = await image(page);
  let previous: string | null = null;
  for (const [type, bytes] of [
    ["image/png", png],
    ["image/jpeg", await image(page, "image/jpeg")],
    ["image/webp", await image(page, "image/webp")],
    ["image/gif", gif(2)],
  ] as const) {
    const response = await upload(fixture.owner, bytes, type);
    expect(response.status).toBe(201);
    const identity = (await response.json()).data;
    expect(Object.keys(identity).sort()).toEqual([
      "avatarUrl",
      "id",
      "profileUpdatedAt",
      "username",
    ]);
    const url = identity.avatarUrl as string;
    expect(url).toMatch(
      new RegExp(`^/api/profile/${fixture.owner.userId}/avatar/`),
    );
    expect((await fetch(apiUrl(url))).status).toBe(401);
    expect(
      (await fetch(apiUrl(url), { headers: headers(personal) })).status,
    ).toBe(404);
    for (const session of [fixture.owner, fixture.actor]) {
      const file = await fetch(apiUrl(url), { headers: headers(session) });
      expect(file.status).toBe(200);
      expect(file.headers.get("content-type")).toContain(type);
      expect(file.headers.get("cache-control")).toBe("private, no-store");
      expect(file.headers.get("x-content-type-options")).toBe("nosniff");
      expect(Buffer.from(await file.arrayBuffer()).equals(bytes)).toBe(true);
    }
    if (previous)
      expect(
        (await fetch(apiUrl(previous), { headers: headers(fixture.owner) }))
          .status,
      ).toBe(404);
    previous = url;
  }
  const saved = previous!;
  const filename = saved.split("/").at(-1)!;
  const raw = `${disposableCiStack ? "http://127.0.0.1:9000/slacord-ci" : "http://127.0.0.1:19000/gadoc-profile-verify"}/gadoc/docs/profile-avatar/${fixture.owner.userId}/${filename}`;
  expect((await fetch(raw)).status).toBe(403);
  expect(
    (
      await fetch(
        `${e2eApiUrl}/files?key=${encodeURIComponent(`gadoc/docs/profile-avatar/${fixture.owner.userId}/${filename}`)}`,
        { headers: headers(fixture.actor) },
      )
    ).status,
  ).toBe(400);
  const identity = await fetch(`${e2eApiUrl}/profile/${fixture.owner.userId}`, {
    headers: headers(fixture.actor),
  });
  expect(identity.status).toBe(200);
  expect((await identity.json()).data).not.toHaveProperty("email");
  expect(
    (
      await fetch(`${e2eApiUrl}/profile/${fixture.owner.userId}`, {
        headers: headers(personal),
      })
    ).status,
  ).toBe(404);

  const invalid = [
    [
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
      "image/svg+xml",
      400,
    ],
    [Buffer.from("<svg/>"), "image/png", 400],
    [png, "image/jpeg", 400],
    [png.subarray(0, 8), "image/png", 400],
    [Buffer.alloc(0), "image/png", 400],
    [Buffer.alloc(2 * 1024 * 1024 + 1), "image/png", 413],
    [await image(page, "image/png", 2049, 1), "image/png", 400],
    [gif(101), "image/gif", 400],
    [gif(5, 2048), "image/gif", 400],
  ] as const;
  for (const [bytes, type, status] of invalid) {
    expect((await upload(fixture.owner, bytes, type)).status).toBe(status);
    expect(await current(fixture.owner)).toBe(saved);
  }
  for (const method of ["POST", "DELETE"]) {
    expect(
      (
        await fetch(`${e2eApiUrl}/profile/${fixture.owner.userId}/avatar`, {
          method,
          headers: headers(fixture.actor),
        })
      ).status,
    ).toBe(404);
    expect(
      (await fetch(`${e2eApiUrl}/auth/me/avatar`, { method })).status,
    ).toBe(401);
  }
  expect(
    (
      await upload(fixture.actor, png, "image/png", [
        "userId",
        fixture.owner.userId,
      ])
    ).status,
  ).toBe(400);
  const remote = await fetch(`${e2eApiUrl}/auth/me/avatar`, {
    method: "POST",
    headers: { ...headers(fixture.owner), "Content-Type": "application/json" },
    body: JSON.stringify({ avatarUrl: "http://127.0.0.1:9/never-fetch" }),
  });
  expect(remote.status).toBe(400);
  expect(await current(fixture.owner)).toBe(saved);
  expect((await upload(fixture.actor, png)).status).toBe(201);
  expect(await current(fixture.owner)).toBe(saved);
  expect((await remove(fixture.actor)).status).toBe(200);
  expect(await current(fixture.owner)).toBe(saved);
  // No workspace is needed to manage or read one's personal profile.
  const personalUpload = await upload(personal, png);
  expect(personalUpload.status).toBe(201);
  const personalUrl = (await personalUpload.json()).data.avatarUrl;
  expect(
    (await fetch(apiUrl(personalUrl), { headers: headers(personal) })).status,
  ).toBe(200);
  expect(
    (await fetch(apiUrl(personalUrl), { headers: headers(fixture.owner) }))
      .status,
  ).toBe(404);
  expect((await remove(personal)).status).toBe(200);
  // No removal API exists; revoke only this fresh fixture's membership in the explicitly isolated DB.
  const mongoose = serverRequire("mongoose");
  const connection = await mongoose
    .createConnection(
      disposableCiStack
        ? "mongodb://127.0.0.1:27017/slacord_ci"
        : "mongodb://127.0.0.1:27127/gadoc_profile_verify",
    )
    .asPromise();
  try {
    const revoked = await connection.collection("teams").updateOne(
      {
        _id: new mongoose.Types.ObjectId(fixture.teamId),
        "members.userId": fixture.actor.userId,
      },
      { $pull: { members: { userId: fixture.actor.userId } } },
    );
    expect(revoked.modifiedCount).toBe(1);
    expect(
      (await fetch(apiUrl(saved), { headers: headers(fixture.actor) })).status,
    ).toBe(404);
    expect(
      (await fetch(apiUrl(saved), { headers: headers(fixture.owner) })).status,
    ).toBe(200);
  } finally {
    await connection.close();
  }

  expect((await remove(fixture.owner)).status).toBe(200);
  expect(await current(fixture.owner)).toBeNull();
  expect(
    (await fetch(apiUrl(saved), { headers: headers(fixture.actor) })).status,
  ).toBe(404);
  expect((await remove(fixture.owner)).status).toBe(200);
  const { S3Client, HeadObjectCommand } = serverRequire("@aws-sdk/client-s3");
  const storage = new S3Client({
    endpoint: disposableCiStack
      ? "http://127.0.0.1:9000"
      : "http://127.0.0.1:19000",
    region: "us-east-1",
    forcePathStyle: true,
    credentials: disposableCiStack
      ? {
          accessKeyId: process.env.MINIO_ACCESS_KEY!,
          secretAccessKey: process.env.MINIO_SECRET_KEY!,
        }
      : {
          accessKeyId: "gadoc-verify",
          secretAccessKey: "gadoc-local-verification-only",
        },
  });
  try {
    const cleared = await storage.send(
      new HeadObjectCommand({
        Bucket: disposableCiStack ? "slacord-ci" : "gadoc-profile-verify",
        Key: `gadoc/docs/profile-avatar/${fixture.owner.userId}/${filename}`,
      }),
    );
    expect(cleared.ContentLength).toBe(0);
  } finally {
    storage.destroy();
  }
});

for (const viewport of [
  { width: 1440, height: 960 },
  { width: 390, height: 844 },
]) {
  test(`profile editor preserves drafts, retries and synchronizes existing chat at ${viewport.width}px`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    const fixture = await createWorkspaceFixture();
    const first = await image(page, "image/png", 8, 8, "#20242b");
    const draft = await image(page, "image/png", 8, 8, "#4668d9");
    expect((await upload(fixture.owner, first)).status).toBe(201);
    const oldUrl = (await current(fixture.owner))!;
    const message = await sendSocketMessage({
      session: fixture.owner,
      teamId: fixture.teamId,
      channelId: fixture.channelId,
      content: "프로필 변경 전 작성한 검증 메시지",
    });
    const peerContext = await browser.newContext({
      baseURL: e2eBaseUrl,
      viewport,
    });
    const peer = await peerContext.newPage();
    const otherTab = await page.context().newPage();
    try {
      await loginWithSession(page, fixture.owner);
      await page.goto(`/${fixture.teamId}/settings?section=account`);
      const editor = page.getByRole("region", { name: "프로필 이미지 편집" });
      await expect(
        editor.getByRole("button", { name: "이미지 선택", exact: true }),
      ).toBeVisible();
      await assertImage(page, fixture.owner.userId, oldUrl);
      await loginWithSession(peer, fixture.actor);
      await peer.goto(`/${fixture.teamId}/channel/${fixture.channelId}`);
      await otherTab.goto(`/${fixture.teamId}/channel/${fixture.channelId}`);
      await expect(
        peer.locator(`[data-message-id="${message.id}"]`),
      ).toBeVisible();
      await assertImage(peer, fixture.owner.userId, oldUrl);
      await assertImage(otherTab, fixture.owner.userId, oldUrl);
      await expect(
        peer.getByText(fixture.owner.email, { exact: true }),
      ).toHaveCount(0);
      const chooser = page.waitForEvent("filechooser");
      await editor
        .getByRole("button", { name: "이미지 선택", exact: true })
        .focus();
      await expect(
        editor.getByRole("button", { name: "이미지 선택", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await (
        await chooser
      ).setFiles({
        name: "synthetic.png",
        mimeType: "image/png",
        buffer: draft,
      });
      const preview = editor.getByAltText("선택한 프로필 이미지 미리보기");
      await expect(preview).toBeVisible();
      const previewUrl = await preview.getAttribute("src");
      await page.route("**/api/auth/me/avatar", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "injected unavailable" }),
        }),
      );
      await editor
        .getByRole("button", { name: "이미지 저장", exact: true })
        .click();
      await expect(editor.getByRole("alert")).toContainText(
        "기존 프로필과 선택한 이미지를 유지",
      );
      await expect(preview).toHaveAttribute("src", previewUrl!);
      expect(await current(fixture.owner)).toBe(oldUrl);
      await assertImage(otherTab, fixture.owner.userId, oldUrl);
      await page.unroute("**/api/auth/me/avatar");
      await editor
        .getByRole("button", { name: "다시 저장", exact: true })
        .click();
      await expect(editor.getByRole("status")).toHaveText(
        "프로필 이미지를 저장했습니다.",
      );
      await expect(preview).toHaveCount(0);
      const newUrl = (await current(fixture.owner))!;
      expect(newUrl).not.toBe(oldUrl);
      await assertImage(page, fixture.owner.userId, newUrl);
      await assertImage(peer, fixture.owner.userId, newUrl);
      await assertImage(otherTab, fixture.owner.userId, newUrl);
      await expect(
        peer.locator(`[data-message-id="${message.id}"] img`),
      ).toHaveAttribute("src", newUrl);
      const unchangedMessage = await jsonFetch<{
        authorId: string;
        content: string;
      }>(`/channel/${fixture.channelId}/message/${message.id}`, {
        token: fixture.owner.token,
      });
      expect(unchangedMessage.data?.authorId).toBe(fixture.owner.userId);
      expect(unchangedMessage.data?.content).toBe(
        "프로필 변경 전 작성한 검증 메시지",
      );

      await page
        .getByLabel("프로필 이미지 선택", { exact: true })
        .setInputFiles({
          name: "synthetic.png",
          mimeType: "image/png",
          buffer: first,
        });
      await expect(preview).toBeVisible();
      const deleteDraft = await preview.getAttribute("src");
      await page.route("**/api/auth/me/avatar", (route) =>
        route.abort("failed"),
      );
      await editor
        .getByRole("button", { name: "이미지 삭제", exact: true })
        .click();
      await expect(editor.getByRole("alert")).toContainText(
        "삭제하지 못했습니다",
      );
      await expect(preview).toHaveAttribute("src", deleteDraft!);
      expect(await current(fixture.owner)).toBe(newUrl);
      await page.unroute("**/api/auth/me/avatar");
      await editor
        .getByRole("button", { name: "다시 삭제", exact: true })
        .click();
      await expect(editor.getByRole("status")).toHaveText(
        "프로필 이미지를 삭제했습니다.",
      );
      await expect(preview).toHaveAttribute("src", deleteDraft!);
      await expect(avatar(peer, fixture.owner.userId)).toHaveCount(0);
      await expect(avatar(otherTab, fixture.owner.userId)).toHaveCount(0);
      await editor
        .getByRole("button", { name: "선택 취소", exact: true })
        .click();
      await expect(preview).toHaveCount(0);
      await page
        .getByLabel("프로필 이미지 선택", { exact: true })
        .setInputFiles({
          name: "spoof.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from("<svg/>"),
        });
      await expect(editor.getByRole("alert")).toContainText(
        "PNG, JPEG, WebP 또는 GIF",
      );
      await expect(
        page.getByLabel("로그인 이메일", { exact: true }),
      ).toHaveText(fixture.owner.email);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.reload();
      await expect(avatar(page, fixture.owner.userId)).toHaveCount(0);
    } finally {
      await peerContext.close();
      await otherTab.close();
    }
  });
}
