import { test, expect } from "playwright/test";
import { loginWithSession } from "./support/slacord-session";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import type {
  DatabaseContainer,
  DatabaseDetail,
  DatabaseProperty,
  KnowledgeDatabase,
} from "../../packages/web/src/features/database/model/types";
const newId = () => crypto.randomUUID().replaceAll("-", "").slice(0, 24);
test("page-scoped sources and generated pages follow sharing changes without leaking through links", async ({
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
  ) => jsonFetch<T>(root + path, { token, method, body });
  await call(
    `/document/${f.documentId}`,
    { visibility: "restricted", allowedViewerIds: [f.owner.userId] },
    "PATCH",
  );
  const container = (await call<DatabaseContainer>("/database-container", {
    name: "비공개 업무",
    parentDocumentId: f.documentId,
  }))!.data!;
  const source = container.sources[0];
  await expect(
    call(
      `/database-container/${container.id}`,
      undefined,
      "GET",
      f.actor.token,
    ),
  ).rejects.toThrow("404");
  await expect(
    call(`/database/${source.id}`, undefined, "GET", f.actor.token),
  ).rejects.toThrow("404");
  expect(
    (await call<KnowledgeDatabase[]>(
      "/database",
      undefined,
      "GET",
      f.actor.token,
    ))!.data!.some((db) => db.id === source.id),
  ).toBe(false);
  const child = (await call<{ documentId: string }>(
    `/database/${source.id}/row/page`,
    { creationId: newId(), title: "비공개 기록" },
  ))!.data!;
  await expect(
    call(`/document/${child.documentId}`, undefined, "GET", f.actor.token),
  ).rejects.toThrow("403");
  await call(
    `/document/${f.documentId}`,
    { allowedViewerIds: [f.owner.userId, f.actor.userId] },
    "PATCH",
  );
  const actorPage = (await call<{ documentId: string }>(
    `/database/${source.id}/row/page`,
    { creationId: newId(), title: "공유 중 작성" },
    "POST",
    f.actor.token,
  ))!.data!;
  await call(`/document/${child.documentId}`, undefined, "GET", f.actor.token);
  let subscribed = false;
  page.on("websocket", (socket) =>
    socket.on("framereceived", (event) => {
      if (String(event.payload).includes("database:changed")) subscribed = true;
    }),
  );
  await loginWithSession(page, f.actor);
  await page.goto(`/${f.teamId}/docs?database=${container.id}`);
  await expect(page.getByRole("table")).toBeVisible();
  await expect.poll(() => subscribed).toBe(true);

  await call(
    `/document/${f.documentId}`,
    { allowedViewerIds: [f.owner.userId] },
    "PATCH",
  );
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(
    page.getByRole("alert").filter({ hasText: "상위 페이지" }),
  ).toBeVisible();

  await expect(
    call(`/document/${actorPage.documentId}`, undefined, "GET", f.actor.token),
  ).rejects.toThrow("403");
  const publicTarget = (await call<{ id: string }>("/document", {
    title: "공개 원본",
  }))!.data!;
  await call(`/database/${source.id}/row`, { documentId: publicTarget.id });
  const publicDb = (await call<{ id: string }>("/database", {
    name: "공개 연결",
  }))!.data!;
  await call(`/database/${publicDb.id}/row`, { documentId: publicTarget.id });
  const relation = (await call<DatabaseProperty>(
    `/database/${publicDb.id}/property`,
    {
      name: "비공개 데이터 연결",
      type: "relation",
      targetDatabaseId: source.id,
      revision: 0,
    },
  ))!.data!;
  await call(
    `/database/${publicDb.id}/row/${publicTarget.id}/${relation.id}`,
    { value: [publicTarget.id], revision: 0 },
    "PATCH",
  );
  const read = (await call<DatabaseDetail>(
    `/database/${publicDb.id}`,
    undefined,
    "GET",
    f.actor.token,
  ))!.data!;
  expect(read.rows[0].values[relation.id]).toEqual([]);
  await call(
    `/database/${publicDb.id}/row/${publicTarget.id}/${relation.id}`,
    { value: [], revision: 1 },
    "PATCH",
    f.actor.token,
  );
  expect(
    (await call<DatabaseDetail>(`/database/${publicDb.id}`))!.data!.rows[0]
      .values[relation.id],
  ).toEqual([publicTarget.id]);
});
