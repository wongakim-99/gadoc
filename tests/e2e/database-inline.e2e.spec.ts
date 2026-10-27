import { test, expect } from "playwright/test";
import { createWorkspaceFixture, jsonFetch } from "./support/slacord-api";
import { loginWithSession } from "./support/slacord-session";

test("linked blocks keep independent views and persist view edits without a save button", async ({
  page,
}) => {
  test.setTimeout(90000);
  const f = await createWorkspaceFixture();
  const db = (await jsonFetch<{ id: string }>(`/team/${f.teamId}/database`, {
    method: "POST",
    token: f.owner.token,
    body: { name: "공유 업무" },
  }))!.data!;
  await jsonFetch(`/team/${f.teamId}/document/${f.documentId}`, {
    method: "PATCH",
    token: f.owner.token,
    body: {
      contentFormat: "json",
      content: JSON.stringify([
        { type: "database", props: { databaseId: db.id } },
        { type: "paragraph" },
        { type: "database", props: { databaseId: db.id } },
      ]),
    },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs/${f.documentId}`);
  const first = page.locator("[data-inline-database]").nth(0);
  const second = page.locator("[data-inline-database]").nth(1);
  await expect(first.getByRole("table")).toBeVisible();
  const search=async(block:typeof first,value?:string)=>{
    await block.getByRole("button",{name:"검색",exact:true}).click();
    const input=page.getByRole("dialog",{name:"검색",exact:true}).getByLabel("데이터베이스 검색");
    if(value!==undefined)await input.fill(value);
    const actual=await input.inputValue();await page.keyboard.press("Escape");return actual;
  };
  const options=async()=>{
    await first.getByRole("button",{name:"보기 옵션",exact:true}).click();
    const menu=page.getByRole("dialog",{name:"보기 옵션",exact:true});
    if(!await menu.getByLabel("현재 보기 이름").isVisible())await menu.getByText("보기 설정",{exact:true}).click();
    return menu;
  };
  let menu=await options();
  await menu.getByLabel("현재 보기 이름").fill("검토 대기");await page.keyboard.press("Escape");
  await search(first,"검토");expect(await search(second)).toBe("");
  menu=await options();
  await menu.getByRole("button",{name:"보기 복제",exact:true}).click();
  await menu.getByLabel("현재 보기 이름").fill("전체 문서");
  await menu.getByText("열 설정",{exact:true}).click();
  await menu.getByRole("checkbox",{name:"담당자",exact:true}).uncheck();await page.keyboard.press("Escape");
  await first.getByLabel("상태 열 계산",{exact:true}).selectOption("count");
  await search(first,"");
  await expect(first.getByRole("button",{name:"담당자 속성 편집",exact:true})).toHaveCount(0);
  await first.getByRole("button",{name:"검토 대기",exact:true}).click();
  expect(await search(first)).toBe("검토");
  await expect(first.getByLabel("상태 열 계산",{exact:true})).toHaveValue("");
  await expect(first.getByRole("button",{name:"담당자 속성 편집",exact:true})).toBeVisible();
  await expect.poll(async()=>{
    const doc=(await jsonFetch<{content:string}>(`/team/${f.teamId}/document/${f.documentId}`,{token:f.owner.token}))!.data!;
    const blocks=JSON.parse(doc.content).filter((block:{type:string})=>block.type==='database');
    return blocks.length===2 && !!blocks[0].props.viewState && !!blocks[1].props.viewState && JSON.parse(blocks[0].props.viewState).views.length===2 && JSON.parse(blocks[1].props.viewState).views.length===1;
  }).toBe(true);
  await page.reload();
  expect(await search(first)).toBe("검토");expect(await search(second)).toBe("");
  await first.getByRole("button",{name:"전체 문서",exact:true}).click();
  await expect(first.getByLabel("상태 열 계산",{exact:true})).toHaveValue("count");
  await expect(first.getByRole("button",{name:"담당자 속성 편집",exact:true})).toHaveCount(0);
  expect(await search(first)).toBe("");
  await first.getByRole("button", { name: "새 페이지", exact: true }).click();
  await first.getByLabel("제목 없음 페이지 이름").fill("동기화 업무");
  await first.getByLabel("제목 없음 페이지 이름").press("Enter");
  await expect(
    second.getByRole("link", { name: "동기화 업무", exact: true }),
  ).toBeVisible();
  await first.getByLabel("동기화 업무 페이지 이름").fill("수정한 업무");
  await first.getByLabel("동기화 업무 페이지 이름").press("Enter");
  await expect(
    second.getByRole("link", { name: "수정한 업무", exact: true }),
  ).toBeVisible();
  await first.getByRole("link", { name: "수정한 업무", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/docs/${f.documentId}`));
  await expect(page.locator("iframe")).toBeVisible();
  expect(errors).toEqual([]);
});

test("slash database stays in the document and survives reload with editable rows", async ({
  page,
}) => {
  test.setTimeout(90000);
  const f = await createWorkspaceFixture();
  await loginWithSession(page, f.owner);
  await page.goto(`/${f.teamId}/docs/${f.documentId}`);
  const editor = page.locator('.bn-editor[contenteditable="true"]');
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/database");
  await page.getByRole("option", { name: /데이터베이스/ }).click();
  await page.getByLabel("본문 데이터베이스 이름").fill("문서 안 프로젝트");
  await page
    .getByRole("button", { name: "새 데이터베이스", exact: true })
    .click();
  const block = page.locator("[data-inline-database]").first();
  await expect(
    block.getByRole("heading", { name: "문서 안 프로젝트" }),
  ).toBeVisible();
  await expect(block.getByRole('columnheader')).toHaveCount(2);
  await expect(block.getByRole('button',{name:'담당자 속성 편집',exact:true})).toHaveCount(0);
  await block.getByRole("button", { name: "새 페이지", exact: true }).click();
  await block.getByLabel("제목 없음 페이지 이름").fill("첫 업무");
  await block.getByLabel("제목 없음 페이지 이름").press("Enter");
  await expect(
    block
      .getByRole("table")
      .getByRole("link", { name: "첫 업무", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/docs/${f.documentId}$`));
  await expect
    .poll(async () => {
      const result = await jsonFetch<{ content: string }>(
        `/team/${f.teamId}/document/${f.documentId}`,
        { token: f.owner.token },
      );
      return result?.data?.content;
    })
    .toMatch(/"databaseId":"[a-f0-9]{24}"/);
  await page.reload();
  await expect(
    page
      .locator("[data-inline-database]")
      .getByRole("table")
      .getByRole("link", { name: "첫 업무", exact: true }),
  ).toBeVisible();
  await page.route("**/api/team/*/document/*", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 503,
          json: { success: false, message: "제목 저장 실패 시험" },
        })
      : route.continue(),
  );
  const titleInput = page
    .locator("[data-inline-database]")
    .getByLabel("첫 업무 페이지 이름");
  await titleInput.fill("유지할 제목");
  await titleInput.press("Enter");
  await expect(titleInput).toHaveValue("유지할 제목");
  await expect(
    page.getByRole("alert").filter({ hasText: "제목 저장 실패 시험" }),
  ).toBeVisible();
  await page
    .locator("[data-inline-database]")
    .getByRole("link", { name: "첫 업무", exact: true })
    .click();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(titleInput).toHaveValue("유지할 제목");
  await page.unrouteAll({ behavior: "wait" });
  await expect(titleInput).toBeEnabled();
  await titleInput.focus();
  await titleInput.press("Enter");
  await expect(
    page
      .locator("[data-inline-database]")
      .getByRole("link", { name: "유지할 제목", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/design-system/assets/database-inline.png",
    fullPage: true,
  });
});
