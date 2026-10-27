import { expect, test } from "playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  createWorkspaceFixture,
  e2eApiUrl,
  jsonFetch,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import { randomBytes } from "node:crypto";

test("MCP extends the existing inline database with relations, rollups and calendar without duplicating it", async () => {
  const fixture = await createWorkspaceFixture();
  const issued = await jsonFetch<{ token: string }>(
    `/team/${fixture.teamId}/integrations/tokens`,
    {
      token: fixture.owner.token,
      method: "POST",
      body: {
        name: "Database assistant",
        scopes: ["databases:read", "databases:write"],
      },
    },
  );
  const client = new Client({ name: "gadoc-database-test", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${e2eApiUrl}/mcp`), {
      requestInit: {
        headers: { Authorization: `Bearer ${issued!.data!.token}` },
      },
    }),
  );
  const call = async (name: string, args: Record<string, unknown>) => {
    const reply = await client.callTool({ name, arguments: args });
    expect(reply.isError, JSON.stringify(reply.content)).not.toBe(true);
    return (reply.structuredContent as any).result;
  };
  try {
    const creationId = randomBytes(12).toString("hex");
    const container = await call("database_create", {
      name: "기존 WBS",
      creationId,
      parentDocumentId: fixture.documentId,
    });
    const again = await call("database_create", {
      name: "기존 WBS",
      creationId,
      parentDocumentId: fixture.documentId,
    });
    expect(again.id).toBe(container.id);
    const databaseId = container.sources[0].id;
    const query = () => call("database_query", { databaseId });
    const add = async (property: Record<string, unknown>) =>
      call("database_property_add", {
        databaseId,
        revision: (await query()).revision,
        ...property,
      });
    const date = await add({ name: "일정", type: "date" });
    const hours = await add({ name: "시간", type: "number" });
    const relation = await add({
      name: "선행 작업",
      type: "relation",
      targetDatabaseId: databaseId,
    });
    const rollup = await add({
      name: "선행 소요",
      type: "rollup",
      relationPropertyId: relation.id,
      targetPropertyId: hours.id,
      aggregation: "sum",
    });
    const first = await call("database_row_create", {
      databaseId,
      title: "설계",
      creationId: randomBytes(12).toString("hex"),
      values: { [date.id]: "2026-10-27", [hours.id]: 4 },
    });
    const second = await call("database_row_create", {
      databaseId,
      title: "구현",
      creationId: randomBytes(12).toString("hex"),
      values: { [relation.id]: [first.documentId] },
    });
    let data = await query();
    const row = data.rows.find(
      (row: any) => row.documentId === second.documentId,
    );
    expect(row.values[rollup.id]).toBe(4);
    await call("database_row_update", {
      databaseId,
      documentId: second.documentId,
      revision: row.revision,
      values: { [date.id]: "2026-10-28" },
    });
    const stale = await client.callTool({
      name: "database_row_update",
      arguments: {
        databaseId,
        documentId: second.documentId,
        revision: row.revision,
        values: { [date.id]: "2026-10-29" },
      },
    });
    expect(stale.isError).toBe(true);
    data = await query();
    await call("database_view_save", {
      databaseId,
      revision: data.revision,
      name: "작업 일정",
      layout: "calendar",
      dateProperty: date.id,
    });
    expect(
      (await query()).views.some((view: any) => view.layout === "calendar"),
    ).toBe(true);
    expect(
      (await call("databases_list", {})).filter(
        (db: any) => db.id === databaseId,
      ),
    ).toHaveLength(1);
  } finally {
    await client.close();
  }
});

test("AI settings issue a scoped key; real MCP client creates, updates, uploads and rejects stale edits and revoked keys", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const fixture = await createWorkspaceFixture();
  await loginWithSession(page, fixture.owner);
  await page.goto(`/${fixture.teamId}/settings?section=ai`);
  await page
    .getByLabel("연결 이름", { exact: true })
    .fill("MCP 실제 클라이언트");
  await page.getByLabel("문서 작성과 수정", { exact: true }).check();
  await page.getByLabel("문서에 파일 첨부", { exact: true }).check();
  await page.getByRole("button", { name: "연결 키 발급", exact: true }).click();
  const token = await page.getByLabel("발급된 MCP 연결 키").inputValue();
  expect(token).toMatch(/^gd_mcp_/);
  const client = new Client({ name: "gadoc-e2e", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${e2eApiUrl}/mcp`),
    { requestInit: { headers: { Authorization: `Bearer ${token}` } } },
  );
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain(
      "document_upload_file",
    );
    const created = await client.callTool({
      name: "document_create",
      arguments: {
        title: "AI 회의록",
        content: "첫 본문",
        parentId: fixture.documentId,
      },
    });
    expect(created.isError).not.toBe(true);
    const doc = (created.structuredContent as any).result;
    expect(doc.parentId).toBe(fixture.documentId);
    const changed = await client.callTool({
      name: "document_update",
      arguments: {
        documentId: doc.id,
        expectedUpdatedAt: doc.updatedAt,
        content: "AI가 정리한 회의록",
      },
    });
    expect(changed.isError).not.toBe(true);
    const stale = await client.callTool({
      name: "document_update",
      arguments: {
        documentId: doc.id,
        expectedUpdatedAt: doc.updatedAt,
        content: "stale overwrite",
      },
    });
    expect(stale.isError).toBe(true);
    const saved = await jsonFetch<{ content: string }>(
      `/team/${fixture.teamId}/document/${doc.id}`,
      { token: fixture.owner.token },
    );
    expect(saved?.data?.content).toBe("AI가 정리한 회의록");
    const attachment = await client.callTool({
      name: "document_upload_file",
      arguments: {
        documentId: doc.id,
        filename: "meeting.txt",
        mimeType: "text/plain",
        base64: Buffer.from("MCP private attachment").toString("base64"),
      },
    });
    expect(attachment.isError).not.toBe(true);
    expect((attachment.structuredContent as any).result.url).toContain(
      "/api/files?key=",
    );
    const list = await jsonFetch<
      Array<{ id: string; digest?: string; token?: string }>
    >(`/team/${fixture.teamId}/integrations/tokens`, {
      token: fixture.owner.token,
    });
    expect(list?.data?.[0].digest).toBeUndefined();
    expect(list?.data?.[0].token).toBeUndefined();
    await jsonFetch(
      `/team/${fixture.teamId}/integrations/tokens/${list!.data![0].id}`,
      { token: fixture.owner.token, method: "DELETE" },
    );
    const denied = await fetch(`${e2eApiUrl}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    expect(denied.status).toBe(401);
  } finally {
    await client.close();
  }
});

test("read-only MCP cannot invoke writes or disclose a private document", async () => {
  const fixture = await createWorkspaceFixture();
  await jsonFetch(`/team/${fixture.teamId}/document/${fixture.documentId}`, {
    token: fixture.owner.token,
    method: "PATCH",
    body: { visibility: "restricted", allowedViewerIds: [] },
  });
  const issued = await jsonFetch<{ token: string }>(
    `/team/${fixture.teamId}/integrations/tokens`,
    {
      token: fixture.actor.token,
      method: "POST",
      body: { name: "Read only", scopes: ["documents:read"] },
    },
  );
  const client = new Client({
    name: "gadoc-permission-test",
    version: "1.0.0",
  });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${e2eApiUrl}/mcp`), {
      requestInit: {
        headers: { Authorization: `Bearer ${issued!.data!.token}` },
      },
    }),
  );
  try {
    expect(
      (await client.listTools()).tools.map((tool) => tool.name),
    ).not.toContain("document_create");
    const denied = await client.callTool({
      name: "document_get",
      arguments: { documentId: fixture.documentId },
    });
    expect(denied.isError).toBe(true);
    const listed = await client.callTool({
      name: "documents_list",
      arguments: {},
    });
    expect((listed.structuredContent as any).result.items).toHaveLength(0);
  } finally {
    await client.close();
  }
});
