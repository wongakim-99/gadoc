import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import type {
  DatabaseContainer,
  DatabaseDetail,
} from "../../packages/web/src/features/database/model/types";
test("containers link independent sources without copying rows and unlink preserves the original", async ({
  page,
}) => {
  test.setTimeout(90000);
  const f = await createWorkspaceFixture();
  const base = `/team/${f.teamId}`;
  const call = <T>(
    path: string,
    body?: unknown,
    method = body ? "POST" : "GET",
  ) => jsonFetch<T>(base + path, { token: f.owner.token, method, body });
  const first = (await call<DatabaseContainer>("/database-container", {
    name: "제품 업무",
  }))!.data!;
  const second = (await call<DatabaseContainer>("/database-container", {
    name: "운영 자료",
  }))!.data!;
  expect(first.id).not.toBe(first.sources[0].id);
  const sourceId = first.sources[0].id;
  await call(`/database/${sourceId}/row`, { documentId: f.documentId });
  await call(`/database-container/${second.id}/source/link`, {
    sourceId,
    revision: 0,
  });
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs?database=${second.id}`);
  await page.getByRole("button",{name:"보기 옵션",exact:true}).click();
  await page.getByText("데이터 소스 · 운영 자료", { exact: true }).click();
  await page
    .getByLabel("표시할 데이터 소스", { exact: true })
    .selectOption(sourceId);
  await expect(page).toHaveURL(new RegExp(`source=${sourceId}`));
  const row = (await call<DatabaseDetail>(`/database/${sourceId}`))!.data!
    .rows[0];
  await page
    .getByRole("combobox", { name: `${row.title} · 상태`, exact: true })
    .selectOption("검토 중");
  await expect
    .poll(
      async () =>
        (await call<DatabaseDetail>(`/database/${sourceId}`))!.data!.rows[0]
          .values.status,
    )
    .toBe("검토 중");
  await page.reload();
  await page.getByRole("button",{name:"보기 옵션",exact:true}).click();
  await page.getByText("데이터 소스 · 제품 업무", { exact: true }).click();
  await expect(
    page.getByLabel("표시할 데이터 소스", { exact: true }),
  ).toHaveValue(sourceId);
  await page.getByRole("button", { name: "현재 소스 연결 해제" }).click();
  await expect
    .poll(
      async () =>
        (await call<DatabaseContainer>(`/database-container/${second.id}`))!
          .data!.sources.length,
    )
    .toBe(1);
  expect(
    (await call<DatabaseDetail>(`/database/${sourceId}`))!.data!.rows[0].values
      .status,
  ).toBe("검토 중");
  expect(
    (await call<DatabaseContainer>(`/database-container/${first.id}`))!.data!
      .sources,
  ).toHaveLength(1);
  await expect(
    call(`/database-container/${first.id}/source/unlink`, {
      sourceId,
      revision: 0,
    }),
  ).rejects.toThrow("400");
  await expect(
    call(`/database-container/${second.id}/source`, {
      name: "오래된 수정",
      revision: 0,
    }),
  ).rejects.toThrow("409");
});

test("container and source creation reuse request identities after concurrent retries", async () => {
  const f = await createWorkspaceFixture();
  const root = `/team/${f.teamId}/database-container`;
  const creationId = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  const requests = await Promise.all(
    [1, 2].map(() =>
      jsonFetch<DatabaseContainer>(root, {
        method: "POST",
        token: f.owner.token,
        body: { name: "중복 방지", creationId },
      }),
    ),
  );
  expect(requests[0]!.data!.id).toBe(requests[1]!.data!.id);
  expect(requests[0]!.data!.sources[0].id).toBe(
    requests[1]!.data!.sources[0].id,
  );
  const sourceId = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  const path = `${root}/${creationId}/source`;
  const body = { name: "추가 원본", revision: 0, creationId: sourceId };
  await jsonFetch(path, { method: "POST", token: f.owner.token, body });
  await jsonFetch(path, { method: "POST", token: f.owner.token, body });
  const read = (await jsonFetch<DatabaseContainer>(`${root}/${creationId}`, {
    token: f.owner.token,
  }))!.data!;
  expect(read.sources).toHaveLength(2);
  expect(read.sources.filter((source) => source.id === sourceId)).toHaveLength(
    1,
  );
});
