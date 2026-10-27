import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import type { DatabaseDetail } from "../../packages/web/src/features/database/model/types";
test("templates edit as pages, copy content and defaults, and preserve access and retry identity", async ({
  page,
}) => {
  test.setTimeout(90000);
  const f = await createWorkspaceFixture();
  const root = `/team/${f.teamId}`;
  const call = <T>(
    path: string,
    body?: unknown,
    method = body ? "POST" : "GET",
    token = f.owner.token,
  ) => jsonFetch<T>(root + path, { body, method, token });
  const db = (await call<{ id: string }>("/database", { name: "팀 회의록" }))!
    .data!;
  const api = `/database/${db.id}`;
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs?database=${db.id}`);
  await page.getByLabel("템플릿", { exact: true }).click();
  await page.getByLabel("템플릿 이름").fill("주간 회의");
  await page.getByRole("button", { name: "새 템플릿", exact: true }).click();
  await expect(page.locator("iframe")).toBeVisible();
  let read = (await call<DatabaseDetail>(api))!.data!;
  expect(read.templates).toHaveLength(1);
  expect(read.rows).toHaveLength(0);
  const template = read.templates![0];
  const content = JSON.stringify([
    {
      type: "heading",
      props: { level: 2 },
      content: [{ type: "text", text: "회의 목표", styles: {} }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "결정 사항과 다음 액션을 기록합니다.",
          styles: {},
        },
      ],
    },
  ]);
  await call(
    `/document/${template.documentId}`,
    { contentFormat: "json", content },
    "PATCH",
  );
  await call(
    `${api}/row/${template.documentId}`,
    { values: { status: "검토 중", owner: [f.owner.userId] }, revision: 0 },
    "PATCH",
  );
  await page.goto(`/${f.teamId}/docs?database=${db.id}`);
  await page.getByLabel("템플릿", { exact: true }).click();
  await page
    .getByRole("button", { name: "주간 회의 템플릿 사용", exact: true })
    .click();
  await expect(
    page.frameLocator("iframe").getByText("회의 목표", { exact: true }),
  ).toBeVisible();
  read = (await call<DatabaseDetail>(api))!.data!;
  expect(read.rows).toHaveLength(1);
  const created = read.rows[0];
  expect(created.values.status).toBe("검토 중");
  expect(created.values.owner).toEqual([f.owner.userId]);
  const copied = (await call<{ content: string }>(
    `/document/${created.documentId}`,
  ))!.data!;
  expect(JSON.parse(copied.content)).toEqual(JSON.parse(content));
  await call(`${api}/template/${template.id}/page`, {
    creationId: created.documentId,
  });
  expect((await call<DatabaseDetail>(api))!.data!.rows).toHaveLength(1);
  await call(
    `/document/${template.documentId}`,
    {
      visibility: "restricted",
      allowedViewerIds: [f.owner.userId],
      editPolicy: "restricted",
      allowedEditorIds: [f.owner.userId],
    },
    "PATCH",
  );
  expect(
    (await call<DatabaseDetail>(api, undefined, "GET", f.actor.token))!.data!
      .templates,
  ).toHaveLength(0);
  await expect(
    call(
      `${api}/template/${template.id}/page`,
      { creationId: crypto.randomUUID().replaceAll("-", "").slice(0, 24) },
      "POST",
      f.actor.token,
    ),
  ).rejects.toThrow("404");
  const restricted = (await call<{ documentId: string }>(
    `${api}/template/${template.id}/page`,
    { creationId: crypto.randomUUID().replaceAll("-", "").slice(0, 24) },
  ))!.data!;
  const privateCopy = (await call<{
    visibility: string;
    allowedViewerIds: string[];
  }>(`/document/${restricted.documentId}`))!.data!;
  expect(privateCopy.visibility).toBe("restricted");
  expect(privateCopy.allowedViewerIds).toEqual([f.owner.userId]);
  await expect(
    call(`/document/${restricted.documentId}`, undefined, "GET", f.actor.token),
  ).rejects.toThrow("403");
});
