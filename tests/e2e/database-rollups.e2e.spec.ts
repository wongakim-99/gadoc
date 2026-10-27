import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import type {
  DatabaseDetail,
  DatabaseProperty,
} from "../../packages/web/src/features/database/model/types";
test("rollups preserve numeric types and exclude hidden related pages from every aggregation", async () => {
  const f = await createWorkspaceFixture();
  const root = `/team/${f.teamId}`;
  const call = <T>(
    path: string,
    body?: unknown,
    method = body ? "POST" : "GET",
    token = f.owner.token,
  ) => jsonFetch<T>(root + path, { token, method, body });
  const source = (await call<{ id: string }>("/database", { name: "집계" }))!
    .data!;
  const target = (await call<{ id: string }>("/database", { name: "항목" }))!
    .data!;
  const numeric = (await call<DatabaseProperty>(
    `/database/${target.id}/property`,
    { name: "수치", type: "number", revision: 0 },
  ))!.data!;
  const ids: string[] = [];
  for (let index = 0; index < 4; index++) {
    const doc = (await call<{ id: string }>("/document", {
      title: `항목 ${index}`,
    }))!.data!;
    ids.push(doc.id);
    await call(`/database/${target.id}/row`, { documentId: doc.id });
    if (index < 3) {
      await call(
        `/database/${target.id}/row/${doc.id}/${numeric.id}`,
        { value: index * 10, revision: 0 },
        "PATCH",
      );
      await call(
        `/database/${target.id}/row/${doc.id}/reviewDate`,
        { value: `2026-10-${10 + index}`, revision: 1 },
        "PATCH",
      );
    }
  }
  let revision = 0;
  const add = async (
    name: string,
    type: string,
    extra: Record<string, unknown> = {},
  ) =>
    (await call<DatabaseProperty>(`/database/${source.id}/property`, {
      name,
      type,
      ...extra,
      revision: revision++,
    }))!.data!;
  const relation = await add("항목", "relation", {
    targetDatabaseId: target.id,
  });
  const single = await add("대표 항목", "relation", {
    targetDatabaseId: target.id,
    cardinality: "one",
  });
  const expected: Record<string, unknown> = {
    count: 4,
    count_values: 3,
    count_unique: 3,
    count_empty: 1,
    count_not_empty: 3,
    percent_empty: 0.25,
    percent_not_empty: 0.75,
    sum: 30,
    average: 10,
    median: 10,
    min: 0,
    max: 20,
    range: 20,
    show_original: [0, 10, 20],
    show_unique: [0, 10, 20],
    earliest_date: "2026-10-10",
    latest_date: "2026-10-12",
    date_range: 2,
  };
  const properties = new Map<string, string>();
  for (const aggregation of Object.keys(expected)) {
    const p = await add(aggregation, "rollup", {
      relationPropertyId: relation.id,
      targetPropertyId: aggregation.includes("date")
        ? "reviewDate"
        : numeric.id,
      aggregation,
    });
    properties.set(aggregation, p.id);
  }
  await call(`/database/${source.id}/row`, { documentId: f.documentId });
  await expect(
    call(
      `/database/${source.id}/row/${f.documentId}/${single.id}`,
      { value: ids.slice(0, 2), revision: 0 },
      "PATCH",
    ),
  ).rejects.toThrow("400");
  await call(
    `/database/${source.id}/row/${f.documentId}/${relation.id}`,
    { value: ids, revision: 0 },
    "PATCH",
  );
  let read = (await call<DatabaseDetail>(
    `/database/${source.id}`,
    undefined,
    "GET",
    f.actor.token,
  ))!.data!;
  for (const [aggregation, value] of Object.entries(expected))
    expect(
      read.rows[0].values[properties.get(aggregation)!],
      aggregation,
    ).toEqual(value);
  await call(
    `/document/${ids[2]}`,
    { visibility: "restricted", allowedViewerIds: [f.owner.userId] },
    "PATCH",
  );
  read = (await call<DatabaseDetail>(
    `/database/${source.id}`,
    undefined,
    "GET",
    f.actor.token,
  ))!.data!;
  expect(read.rows[0].values[relation.id]).not.toContain(ids[2]);
  expect(read.rows[0].values[properties.get("sum")!]).toBe(10);
  expect(read.rows[0].values[properties.get("count")!]).toBe(3);
  expect(read.rows[0].values[properties.get("median")!]).toBe(5);
  expect(read.rows[0].values[properties.get("show_original")!]).toEqual([
    0, 10,
  ]);
  expect(read.rows[0].values[properties.get("latest_date")!]).toBe(
    "2026-10-11",
  );
});
