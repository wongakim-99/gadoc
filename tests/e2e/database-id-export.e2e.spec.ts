import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import type {
  DatabaseDetail,
  DatabaseProperty,
} from "../../packages/web/src/features/database/model/types";
test("unique IDs survive concurrent additions and prefix changes, and view CSV downloads", async ({
  page,
}) => {
  const f = await createWorkspaceFixture();
  const root = `/team/${f.teamId}`;
  const call = <T>(
    path: string,
    body?: unknown,
    method = body ? "POST" : "GET",
  ) => jsonFetch<T>(root + path, { token: f.owner.token, body, method });
  const db = (await call<{ id: string }>("/database", { name: "기록 번호" }))!
    .data!;
  const base = `/database/${db.id}`;
  await call(`${base}/row`, { documentId: f.documentId });
  const prop = (await call<DatabaseProperty>(`${base}/property`, {
    name: "업무 ID",
    type: "unique_id",
    prefix: "TASK",
    revision: 0,
  }))!.data!;
  let read = (await call<DatabaseDetail>(base))!.data!;
  expect(read.rows[0].values[prop.id]).toBe("TASK-1");
  const docs = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      call<{ id: string }>("/document", { title: `추가 ${i}` }),
    ),
  );
  await Promise.all(
    docs.map((doc) => call(`${base}/row`, { documentId: doc!.data!.id })),
  );
  read = (await call<DatabaseDetail>(base))!.data!;
  expect(read.rows).toHaveLength(5);
  expect(new Set(read.rows.map((row) => row.values[prop.id])).size).toBe(5);
  const originals = new Map(
    read.rows.map((row) => [row.documentId, row.values[prop.id]]),
  );
  await call(
    `${base}/property/${prop.id}/configuration`,
    { name: "업무 ID", type: "unique_id", prefix: "ISSUE", revision: 1 },
    "PATCH",
  );
  read = (await call<DatabaseDetail>(base))!.data!;
  for (const row of read.rows)
    expect(row.values[prop.id]).toBe(
      String(originals.get(row.documentId)).replace("TASK", "ISSUE"),
    );
  await expect(
    call(
      `${base}/row/${f.documentId}/${prop.id}`,
      { value: "ISSUE-99", revision: 0 },
      "PATCH",
    ),
  ).rejects.toThrow("400");
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs?database=${db.id}`);
  await page.getByRole("button",{name:"보기 옵션",exact:true}).click();
  await page.getByText("내보내기", { exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "현재 보기 CSV 내보내기" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("기록 번호.csv");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain("업무 ID");
  expect(csv).toContain("ISSUE-1");
});
