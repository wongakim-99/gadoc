import { test, expect } from "playwright/test";
import {
  createChannel,
  createWorkspaceFixture,
  jsonFetch,
  sendSocketMessage,
  type WorkspaceFixture,
} from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";
import type { WorkspaceProject } from "../../packages/web/src/entities/project/types";
import type { Issue } from "../../packages/web/src/entities/issue/types";
import type { DatabaseDetail } from "../../packages/web/src/features/database/model/types";

test.describe("workspace project scopes", () => {
  let f: WorkspaceFixture;
  let secondChannel: string;
  let gadoc: WorkspaceProject;
  let bigzami: WorkspaceProject;
  let gadocIssue: Issue;
  let bigzamiIssue: Issue;
  let bigzamiMessage: string;
  let sourceId: string;
  const body = (
    name: string,
    channelIds: string[],
    documentId: string | null = null,
  ) => ({ name, channelIds, documentId });
  const api = <T = unknown>(
    path: string,
    method: "GET" | "POST" | "PATCH" = "GET",
    data?: unknown,
    token?: string,
  ) =>
    jsonFetch<T>(`/team/${f.teamId}${path}`, {
      method,
      body: data,
      token: token ?? f.owner.token,
    });
  test.beforeAll(async () => {
    f = await createWorkspaceFixture();
    secondChannel = await createChannel({
      teamId: f.teamId,
      token: f.owner.token,
      name: "Bigzami3",
    });
    gadoc = (await api<WorkspaceProject>(
      "/project",
      "POST",
      body("GaDoc", [f.channelId], f.documentId),
    ))!.data!;
    bigzami = (await api<WorkspaceProject>(
      "/project",
      "POST",
      body("Bigzami3", [secondChannel]),
    ))!.data!;
    const first = await sendSocketMessage({
      session: f.owner,
      teamId: f.teamId,
      channelId: f.channelId,
      content: "GaDoc feedback origin",
    });
    const second = await sendSocketMessage({
      session: f.actor,
      teamId: f.teamId,
      channelId: secondChannel,
      content: "Bigzami3 policy origin",
    });
    bigzamiMessage = second.id;
    gadocIssue = (await api<Issue>("/issue", "POST", {
      title: "GaDoc scoped task",
      sourceMessageId: first.id,
      assigneeIds: [f.actor.userId],
    }))!.data!;
    bigzamiIssue = (await api<Issue>("/issue", "POST", {
      title: "Bigzami3 scoped task",
      sourceMessageId: second.id,
      status: "in_progress",
    }))!.data!;
    await api("/issue", "POST", { title: "Unclassified scoped task" });
    sourceId = (await api<{ id: string }>("/database/issue-source", "POST"))!
      .data!.id;
  });

  test("authorizes metadata, prevents duplicate bindings, and rejects stale or foreign writes", async () => {
    expect(gadocIssue.projectId).toBe(gadoc.id);
    expect(bigzamiIssue.projectId).toBe(bigzami.id);
    expect(bigzamiIssue.status).toBe("in_progress");
    await expect(
      api("/project", "POST", body("Member cannot manage", []), f.actor.token),
    ).rejects.toThrow("403");
    await expect(
      api("/project", "POST", body("Duplicate channel", [f.channelId])),
    ).rejects.toThrow("409");
    await expect(api("/project", "POST", body(" gadoc ", []))).rejects.toThrow(
      "409",
    );
    const empty1 = (await api<WorkspaceProject>(
      "/project",
      "POST",
      body("Empty one", []),
    ))!.data!;
    const empty2 = (await api<WorkspaceProject>(
      "/project",
      "POST",
      body("Empty two", []),
    ))!.data!;
    expect(empty1.id).not.toBe(empty2.id);
    await api(`/project/${empty1.id}`, "PATCH", {
      ...body("Empty renamed", []),
      revision: 0,
    });
    await expect(
      api(`/project/${empty1.id}`, "PATCH", {
        ...body("Lost update", []),
        revision: 0,
      }),
    ).rejects.toThrow("409");
    const privateChannel = await createChannel({
      teamId: f.teamId,
      token: f.owner.token,
      name: "Hidden binding",
      type: "private",
    });
    const hidden = (await api<WorkspaceProject>(
      "/project",
      "POST",
      body("Restricted resources", [privateChannel]),
    ))!.data!;
    const memberProjects = (await api<WorkspaceProject[]>(
      "/project",
      "GET",
      undefined,
      f.actor.token,
    ))!.data!;
    expect(memberProjects.find((p) => p.id === hidden.id)?.channelIds).toEqual(
      [],
    );
    const privateMessage = await sendSocketMessage({
      session: f.owner,
      teamId: f.teamId,
      channelId: privateChannel,
      content: "Private origin",
    });
    await expect(
      api(
        "/issue",
        "POST",
        { title: "Cannot read origin", sourceMessageId: privateMessage.id },
        f.actor.token,
      ),
    ).rejects.toThrow("404");
    const foreign = (await jsonFetch<{ id: string }>("/team", {
      token: f.owner.token,
      method: "POST",
      body: {
        name: "Foreign project team",
        slug: `foreign-project-${Date.now()}`,
      },
    }))!.data!.id;
    const foreignProject = (await jsonFetch<WorkspaceProject>(
      `/team/${foreign}/project`,
      {
        token: f.owner.token,
        method: "POST",
        body: body("Foreign", []),
      },
    ))!.data!;
    await expect(
      api("/issue", "POST", {
        title: "Foreign create",
        projectId: foreignProject.id,
      }),
    ).rejects.toThrow("404");
    await expect(
      api(`/issue/${gadocIssue.id}`, "PATCH", { projectId: foreignProject.id }),
    ).rejects.toThrow("404");
    await expect(
      api(`/database/${sourceId}?projectId=${foreignProject.id}`),
    ).rejects.toThrow("404");
    await expect(
      api(`/database/${sourceId}/row/page`, "POST", {
        title: "Foreign DB create",
        creationId: "1234567890abcdef12345678",
        values: {},
        projectId: foreignProject.id,
      }),
    ).rejects.toThrow("404");
    await expect(
      api("/project", "POST", body("Foreign document", [], foreignProject.id)),
    ).rejects.toThrow("400");
  });

  test("filters canonical issues without copies and keeps references independent of ownership", async () => {
    const before = (await api<Issue[]>("/issue"))!.data!;
    expect(
      (await api<Issue[]>(`/issue?projectId=${gadoc.id}`))!.data!.map(
        (i) => i.id,
      ),
    ).toEqual([gadocIssue.id]);
    expect(
      (await api<Issue[]>("/issue?projectId=unassigned"))!.data!.map(
        (i) => i.title,
      ),
    ).toEqual(["Unclassified scoped task"]);
    await api(`/issue/${gadocIssue.id}/links`, "POST", {
      kind: "message",
      resourceId: bigzamiMessage,
    });
    expect(
      (await api<Issue[]>(`/issue?projectId=${gadoc.id}`))!.data![0].id,
    ).toBe(gadocIssue.id);
    const rows = (await api<DatabaseDetail>(
      `/database/${sourceId}?projectId=${bigzami.id}`,
    ))!.data!.rows;
    expect(rows.map((r) => r.documentId)).toEqual([bigzamiIssue.id]);
    await api(`/database/${sourceId}/row/${bigzamiIssue.id}`, "PATCH", {
      values: { status: "리뷰 중" },
      revision: rows[0].revision,
    });
    expect(
      (await api<Issue[]>(`/issue?projectId=${bigzami.id}`))!.data![0].status,
    ).toBe("in_review");
    expect((await api<Issue[]>("/issue"))!.data!).toHaveLength(before.length);
    const current = (await api<Issue[]>(`/issue?projectId=${gadoc.id}`))!
      .data![0];
    await api(`/issue/${current.id}`, "PATCH", {
      projectId: bigzami.id,
      revision: current.revision,
    });
    expect(
      (await api<Issue[]>(`/issue?projectId=${gadoc.id}`))!.data!,
    ).toHaveLength(0);
    await api(`/issue/${current.id}`, "PATCH", { projectId: gadoc.id });
    const links = (await api<Array<{ resourceId: string }>>(
      `/issue/${current.id}/links`,
    ))!.data!;
    expect(links.some((link) => link.resourceId === bigzamiMessage)).toBe(true);
    expect((await api<Issue[]>("/issue"))!.data!).toHaveLength(before.length);
  });

  test("uses project grouping, scoped creation and the same scope in database views", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await loginWithSession(page, f.owner);
    await page.goto(`/${f.teamId}/channel/${f.channelId}`);
    const group = page.getByRole("region", { name: "GaDoc 업무", exact: true });
    await expect(
      group.getByRole("link", { name: `# ${f.channelName}`, exact: true }),
    ).toBeVisible();
    await expect(
      group.getByRole("link", { name: "# Bigzami3", exact: true }),
    ).toHaveCount(0);
    await group.getByRole("link", { name: "이슈·일정", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`project=${gadoc.id}`));
    await expect(
      page.getByRole("button", { name: /GaDoc scoped task/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Bigzami3 scoped task/ }).first(),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "이슈 생성", exact: true }).click();
    const form = page.getByRole("dialog", { name: "이슈 생성", exact: true });
    await expect(form.getByLabel("이슈 업무", { exact: true })).toHaveValue(
      gadoc.id,
    );
    await form
      .getByPlaceholder("이슈 제목", { exact: true })
      .fill("GaDoc UI creation");
    await form.getByRole("button", { name: "생성", exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect
      .poll(async () =>
        (await api<Issue[]>(`/issue?projectId=${gadoc.id}`))!.data!.some(
          (i) => i.title === "GaDoc UI creation",
        ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "DB로 보기", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`project=${gadoc.id}`));
    await expect(
      page.getByRole("textbox", {
        name: "GaDoc scoped task 페이지 이름",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", {
        name: "Bigzami3 scoped task 페이지 이름",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "업무 범위", exact: true })
      .click();
    await page.getByRole("option", { name: "Bigzami3", exact: true }).click();
    await expect(
      page.getByRole("textbox", {
        name: "Bigzami3 scoped task 페이지 이름",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", {
        name: "GaDoc scoped task 페이지 이름",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "새 이슈", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await api<Issue[]>(`/issue?projectId=${bigzami.id}`))!.data!.length,
      )
      .toBe(2);
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "업무 범위", exact: true }),
    ).toContainText("Bigzami3");
    await expect(
      page.getByRole("textbox", {
        name: "GaDoc scoped task 페이지 이름",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.screenshot({ path: "/tmp/gadoc-project-scoped-database.png" });
  });

  test("allows owner management and keeps member controls read-only on mobile", async ({
    page,
  }) => {
    await loginWithSession(page, f.owner);
    await page.goto(`/${f.teamId}/issues`);
    await page.getByRole("button", { name: "업무 관리", exact: true }).click();
    const form = page.getByRole("dialog", { name: "업무 관리", exact: true });
    await form
      .getByLabel("업무 이름", { exact: true })
      .fill("UI managed project");
    await form.getByRole("button", { name: "업무 저장", exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect
      .poll(async () =>
        (await api<WorkspaceProject[]>("/project"))!.data!.some(
          (p) => p.name === "UI managed project",
        ),
      )
      .toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginWithSession(page, f.actor);
    await page.goto(`/${f.teamId}/issues?project=${bigzami.id}`);
    await expect(
      page.getByRole("combobox", { name: "업무 범위", exact: true }),
    ).toContainText("Bigzami3");
    await expect(
      page.getByRole("button", { name: "업무 관리", exact: true }),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({ path: "/tmp/gadoc-project-mobile.png" });
  });

  test("retains the selected project across calendar and timeline views", async ({
    page,
  }) => {
    const read = async () =>
      (await api<DatabaseDetail>(`/database/${sourceId}`))!.data!;
    const date = (await api<{ id: string }>(
      `/database/${sourceId}/property`,
      "POST",
      {
        name: "Project schedule date",
        type: "date",
        revision: (await read()).revision,
      },
    ))!.data!.id;
    const today = new Date().toISOString().slice(0, 10);
    for (const issue of [gadocIssue, bigzamiIssue]) {
      const row = (await read()).rows.find((r) => r.documentId === issue.id)!;
      await api(`/database/${sourceId}/row/${issue.id}`, "PATCH", {
        values: { [date]: today },
        revision: row.revision,
      });
    }
    let calendar = "";
    for (const layout of ["calendar", "timeline"]) {
      const view = (await api<{ id: string }>(
        `/database/${sourceId}/view`,
        "POST",
        {
          name: `Project ${layout}`,
          layout,
          query: "",
          status: "",
          owner: "",
          sort: "manual",
          dateProperty: date,
          dataSourceId: sourceId,
          revision: (await read()).revision,
        },
      ))!.data!;
      if (layout === "calendar") calendar = view.id;
    }
    await loginWithSession(page, f.owner);
    await page.goto(
      `/${f.teamId}/docs?database=${sourceId}&project=${bigzami.id}&view=${calendar}`,
    );
    const calendarRegion = page.getByRole("region", {
      name: "데이터베이스 달력",
      exact: true,
    });
    await expect(
      calendarRegion.getByText("Bigzami3 scoped task", { exact: true }),
    ).toBeVisible();
    await expect(
      calendarRegion.getByText("GaDoc scoped task", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Project timeline", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`project=${bigzami.id}`));
    const timeline = page.getByRole("region", {
      name: "데이터베이스 타임라인",
      exact: true,
    });
    await expect(
      timeline.getByText("Bigzami3 scoped task", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      timeline.getByText("GaDoc scoped task", { exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(timeline).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "업무 범위", exact: true }),
    ).toContainText("Bigzami3");
    await page.screenshot({ path: "/tmp/gadoc-project-timeline.png" });
  });

  test("refreshes another member navigation and preserves stale local settings on conflict", async ({
    page,
    browser,
  }) => {
    await loginWithSession(page, f.owner);
    await page.goto(`/${f.teamId}/issues`);
    await page.getByRole("button", { name: "업무 관리", exact: true }).click();
    const form = page.getByRole("dialog", { name: "업무 관리", exact: true });
    await form
      .getByLabel("편집할 업무", { exact: true })
      .selectOption(bigzami.id);
    await form.getByLabel("업무 이름", { exact: true }).fill("Local conflict");
    const context = await browser.newContext();
    const other = await context.newPage();
    try {
      await loginWithSession(other, f.actor);
      await other.goto(`/${f.teamId}/channel/${secondChannel}`);
      await expect(
        other.getByRole("region", { name: "Bigzami3 업무", exact: true }),
      ).toBeVisible();
      await api(`/project/${bigzami.id}`, "PATCH", {
        ...body("Bigzami3 live", [secondChannel]),
        revision: bigzami.revision,
      });
      await expect(
        other.getByRole("region", { name: "Bigzami3 live 업무", exact: true }),
      ).toBeVisible();
      await form
        .getByRole("button", { name: "업무 저장", exact: true })
        .click();
      await expect(form.getByRole("alert")).toContainText(
        "다른 화면에서 업무가 변경",
      );
      await expect(form.getByLabel("업무 이름", { exact: true })).toHaveValue(
        "Local conflict",
      );
      page.once("dialog", (dialog) => dialog.accept());
      await form
        .getByRole("button", { name: "업무 관리 닫기", exact: true })
        .click();
      await expect(form).toHaveCount(0);
    } finally {
      const current = (await api<WorkspaceProject[]>("/project"))!.data!.find(
        (p) => p.id === bigzami.id,
      )!;
      if (current.name !== "Bigzami3")
        await api(`/project/${bigzami.id}`, "PATCH", {
          ...body("Bigzami3", [secondChannel]),
          revision: current.revision,
        });
      await context.close();
    }
  });
});
