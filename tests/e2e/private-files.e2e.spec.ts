import { expect, test } from "playwright/test";
import {
  createChannel,
  createUserSession,
  createWorkspaceFixture,
  e2eApiUrl,
  e2eBaseUrl,
  jsonFetch,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=",
  "base64",
);
async function upload(
  path: string,
  token: string,
  bytes = png,
  type = "image/png",
  teamId?: string,
) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), "verification.png");
  if (teamId) form.append("teamId", teamId);
  const response = await fetch(`${e2eApiUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  expect(response.ok, await response.clone().text()).toBe(true);
  const file = (await response.json()).data;
  expect(file.url).toMatch(/^\/api\/files\?key=/);
  expect(file.url).not.toMatch(/token|signature|credential/i);
  return file as { url: string; mimeType: string };
}

test("private attachments enforce team, channel and document permissions with media ranges", async ({
  page,
}) => {
  const fixture = await createWorkspaceFixture();
  const outsider = await createUserSession("file-outsider");
  const privateChannel = await createChannel({
    teamId: fixture.teamId,
    token: fixture.owner.token,
    name: `private-files-${Date.now()}`,
    type: "private",
  });
  const file = await upload(
    `/channel/${privateChannel}/message/attachment`,
    fixture.owner.token,
    png,
    "image/png",
    fixture.teamId,
  );
  const url = new URL(file.url, e2eApiUrl).href;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  expect((await fetch(url)).status).toBe(401);
  expect((await fetch(url, { method: "HEAD" })).status).toBe(401);
  expect((await fetch(url, { headers: auth(outsider.token) })).status).toBe(
    403,
  );
  expect(
    (await fetch(url, { headers: auth(fixture.actor.token) })).status,
  ).toBe(403);
  const allowed = await fetch(url, { headers: auth(fixture.owner.token) });
  expect(allowed.status).toBe(200);
  expect(allowed.headers.get("cache-control")).toBe("private, no-store");
  expect(allowed.headers.get("content-type")).toContain("image/png");
  expect(Buffer.from(await allowed.arrayBuffer())).toEqual(png);
  const ranged = await fetch(url, {
    headers: { ...auth(fixture.owner.token), Range: "bytes=0-7" },
  });
  expect(ranged.status).toBe(206);
  expect(ranged.headers.get("content-range")).toBe(`bytes 0-7/${png.length}`);
  expect(Buffer.from(await ranged.arrayBuffer())).toEqual(png.subarray(0, 8));
  expect(
    (
      await fetch(url, {
        headers: { ...auth(fixture.owner.token), Range: "bytes=999999-" },
      })
    ).status,
  ).toBe(416);

  const documentPath = `/team/${fixture.teamId}/document/${fixture.documentId}`;
  const docFile = await upload(`${documentPath}/file`, fixture.owner.token);
  await jsonFetch(documentPath, {
    method: "PATCH",
    token: fixture.owner.token,
    body: {
      visibility: "restricted",
      allowedViewerIds: [],
      content: `<img src="${docFile.url}">`,
      contentFormat: "html",
    },
  });
  expect(
    (
      await fetch(new URL(docFile.url, e2eApiUrl), {
        headers: auth(fixture.actor.token),
      })
    ).status,
  ).toBe(403);
  await loginWithSession(page, fixture.owner);
  const viaCookie = await page.request.get(
    new URL(docFile.url, e2eBaseUrl).href,
  );
  expect(viaCookie.status()).toBe(200);
  expect(viaCookie.headers()["cache-control"]).toBe("private, no-store");
  await page.goto(`/${fixture.teamId}/docs/${fixture.documentId}`);
  const inline = page.locator('img[src^="/api/files?key="]').first();
  await expect(inline).toBeVisible();
  await expect
    .poll(() =>
      inline.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true);

  const unsafe = await upload(
    `${documentPath}/file`,
    fixture.owner.token,
    Buffer.from('<svg onload="alert(1)"></svg>'),
    "image/png",
  );
  expect(unsafe.mimeType).toBe("application/octet-stream");
  const unsafeResponse = await fetch(new URL(unsafe.url, e2eApiUrl), {
    headers: auth(fixture.owner.token),
  });
  expect(unsafeResponse.headers.get("content-disposition")).toContain(
    "attachment",
  );
  expect(unsafeResponse.headers.get("x-content-type-options")).toBe("nosniff");
  const empty = await upload(
    `${documentPath}/file`,
    fixture.owner.token,
    Buffer.alloc(0),
    "text/plain",
  );
  const emptyResponse = await fetch(new URL(empty.url, e2eApiUrl), {
    headers: auth(fixture.owner.token),
  });
  expect(emptyResponse.status).toBe(200);
  expect((await emptyResponse.arrayBuffer()).byteLength).toBe(0);

  const endpoint = process.env.MINIO_ENDPOINT;
  const bucket = process.env.MINIO_BUCKET;
  if (endpoint && bucket) {
    const key = new URL(file.url, e2eApiUrl).searchParams.get("key")!;
    for (const method of ["GET", "HEAD"])
      expect(
        (await fetch(`${endpoint}/${bucket}/${key}`, { method })).status,
      ).toBe(403);
    expect((await fetch(`${endpoint}/${bucket}?list-type=2`)).status).toBe(403);
  }
  await jsonFetch(documentPath + "/archive", {
    method: "POST",
    token: fixture.owner.token,
  });
  await jsonFetch(documentPath, {
    method: "DELETE",
    token: fixture.owner.token,
  });
  expect(
    (
      await fetch(new URL(docFile.url, e2eApiUrl), {
        headers: auth(fixture.owner.token),
      })
    ).status,
  ).toBe(403);
});

test("untrusted origins cannot make state-changing requests", async () => {
  const response = await fetch(`${e2eApiUrl}/auth/login`, {
    method: "POST",
    headers: {
      Origin: "https://untrusted.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  expect(response.status).toBe(403);
});
