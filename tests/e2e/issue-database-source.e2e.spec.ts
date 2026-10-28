import { test, expect } from 'playwright/test';
import { createWorkspaceFixture, createGuestSessionForTeam, sendSocketMessage, jsonFetch } from './support/slacord-api';
import { loginWithSession } from './support/slacord-session';
import type { DatabaseDetail } from '../../packages/web/src/features/database/model/types';

test('chat issues and database views edit the same records and retain their source', async ({ page, browser }, testInfo) => {
    test.setTimeout(90000);
    const f = await createWorkspaceFixture();
    const message = await sendSocketMessage({ session: f.owner, teamId: f.teamId, channelId: f.channelId, content: '이슈 DB 연동 검토 원문' });
    await loginWithSession(page, f.owner);
    await page.goto(`/${f.teamId}/channel/${f.channelId}`);
    await page.locator('textarea').last().fill('보존되어야 할 채팅 초안');
    await page.goto(`/${f.teamId}/issues`);
    await page.goto(`/${f.teamId}/channel/${f.channelId}`);
    await expect(page.locator('textarea').last()).toHaveValue('보존되어야 할 채팅 초안');
    await page.reload();
    await expect(page.locator('textarea').last()).toHaveValue('보존되어야 할 채팅 초안');
    const messageRow = page.locator('[data-message-id]').filter({ hasText: '이슈 DB 연동 검토 원문' });
    await messageRow.hover();
    await messageRow.getByRole('button', { name: '메시지 후속 업무', exact: true }).click();
    await messageRow.getByRole('button', { name: '이 메시지에서 이슈 만들기' }).click();
    const side = page.frameLocator('iframe');
    await side.getByPlaceholder('이슈 제목', { exact: true }).fill('채팅에서 시작한 작업');
    await side.getByRole('button', { name: '생성', exact: true }).click();
    await expect(side.getByRole('region', { name: '이슈 수정', exact: true })).toBeVisible();
    await expect(page.locator('textarea').last()).toHaveValue('보존되어야 할 채팅 초안');
    const issues = () => jsonFetch<Array<{ id: string; title: string; status: string; assigneeIds: string[] }>>(`/team/${f.teamId}/issue`, { token: f.owner.token });
    const issue = (await issues())!.data!.find((item) => item.title === '채팅에서 시작한 작업')!;
    expect(issue).toBeTruthy();
    await page.goto(`/${f.teamId}/issues`);
    await page.getByRole('button', { name: 'DB로 보기', exact: true }).click();
    await expect(page).toHaveURL(/docs\?database=/);
    const databaseId = new URL(page.url()).searchParams.get('database')!;
    const read = async () => (await jsonFetch<DatabaseDetail>(`/team/${f.teamId}/database/${databaseId}`, { token: f.owner.token }))!.data!;
    expect((await read()).rows.map((row) => row.documentId)).toContain(issue.id);
    const row = page.getByRole('row').filter({ has: page.getByRole('textbox', { name: '채팅에서 시작한 작업 페이지 이름', exact: true }) });
    await row.getByLabel('채팅에서 시작한 작업 · 상태', { exact: true }).selectOption('진행 중');
    await expect.poll(async () => (await issues())!.data!.find((item) => item.id === issue.id)?.status).toBe('in_progress');
    await row.getByRole('button', { name: '채팅에서 시작한 작업 · 담당자', exact: true }).click();
    await page.getByRole('checkbox', { name: f.actor.username, exact: true }).check();
    await expect.poll(async () => (await issues())!.data!.find((item) => item.id === issue.id)?.assigneeIds).toContain(f.actor.userId);
    await page.keyboard.press('Escape');
    await row.getByRole('textbox', { name: '채팅에서 시작한 작업 페이지 이름', exact: true }).fill('DB에서 수정한 작업');
    await page.getByRole('heading', { name: '워크스페이스 이슈', exact: true }).click();
    await expect.poll(async () => (await issues())!.data!.find((item) => item.id === issue.id)?.title).toBe('DB에서 수정한 작업');
    const context = await browser.newContext();
    const other = await context.newPage();
    try {
        await loginWithSession(other, f.actor);
        await other.goto(`/${f.teamId}/issues`);
        const current = (await read()).rows.find((item) => item.documentId === issue.id)!;
        await jsonFetch(`/team/${f.teamId}/database/${databaseId}/row/${issue.id}`, { token: f.owner.token, method: 'PATCH', body: { values: { status: '완료' }, revision: current.revision } });
        await expect(other.locator('[data-rfd-droppable-id="done"]').getByText('DB에서 수정한 작업', { exact: true })).toBeVisible();
        await expect.poll(async () => (await issues())!.data!.find((item) => item.id === issue.id)?.status).toBe('done');
        await expect(page.getByLabel('DB에서 수정한 작업 · 상태', { exact: true })).toHaveValue('완료');
        await expect(jsonFetch(`/team/${f.teamId}/database/${databaseId}/row/${issue.id}`, { token: f.owner.token, method: 'PATCH', body: { values: { status: '할 일' }, revision: current.revision } })).rejects.toThrow('409');
        await jsonFetch(`/team/${f.teamId}/issue/${issue.id}`, { token: f.actor.token, method: 'PATCH', body: { status: 'in_review' } });
        await expect(page.getByLabel('DB에서 수정한 작업 · 상태', { exact: true })).toHaveValue('리뷰 중');
    } finally { await context.close(); }
    const links = (await jsonFetch<Array<{ resourceId: string }>>(`/team/${f.teamId}/issue/${issue.id}/links`, { token: f.owner.token }))!.data!;
    expect(links.some((link) => link.resourceId === message.id)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('issue-database.png') });
    await page.reload();
    await expect(page.getByLabel('DB에서 수정한 작업 · 상태', { exact: true })).toHaveValue('리뷰 중');
    const documentsBefore = (await jsonFetch<unknown[]>(`/team/${f.teamId}/document`, { token: f.owner.token }))!.data!.length;
    await page.getByRole('button', { name: '새 이슈', exact: true }).click();
    await expect.poll(async () => (await issues())!.data!.length).toBe(2);
    expect((await jsonFetch<unknown[]>(`/team/${f.teamId}/document`, { token: f.owner.token }))!.data!.length).toBe(documentsBefore);
    await page.goto(`/${f.teamId}/docs/${f.documentId}`);
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await page.getByRole('option', { name: '이슈 데이터베이스 워크스페이스 이슈를 같은 원본으로 보기', exact: true }).click();
    await expect(page.locator('[data-inline-database]').getByLabel('DB에서 수정한 작업 · 상태', { exact: true })).toHaveValue('리뷰 중');
    await expect.poll(async () => (await jsonFetch<{ content: string }>(`/team/${f.teamId}/document/${f.documentId}`, { token: f.owner.token }))!.data!.content).toContain(databaseId);
    await page.reload();
    await expect(page.locator('[data-inline-database]').getByLabel('DB에서 수정한 작업 · 상태', { exact: true })).toHaveValue('리뷰 중');
    await page.screenshot({ path: testInfo.outputPath('inline-issue-database.png') });
});

test('issue database custom properties create immediately, persist on the issue and restore their values', async ({ page }) => {
    test.setTimeout(90000);
    const f = await createWorkspaceFixture();
    const team = `/team/${f.teamId}`;
    const issue = (await jsonFetch<{ id: string }>(`${team}/issue`, {
        token: f.owner.token, method: 'POST', body: { title: '확장 속성 검증' },
    }))!.data!;
    const provision = async () => (await jsonFetch<{ id: string }>(`${team}/database/issue-source`, {
        token: f.owner.token, method: 'POST',
    }))!.data!;
    const source = await provision();
    const read = async () => (await jsonFetch<DatabaseDetail>(`${team}/database/${source.id}`, { token: f.owner.token }))!.data!;
    await loginWithSession(page, f.owner);
    await page.goto(`/${f.teamId}/docs?database=${source.id}`);

    // Default names and one type click must be sufficient; no setup/submit step.
    const add = page.getByRole('button', { name: '속성 추가', exact: true });
    const picker = page.getByRole('dialog', { name: '속성 추가', exact: true });
    await add.click();
    await picker.getByRole('textbox', { name: '속성 유형 검색', exact: true }).fill('숫자');
    await picker.getByRole('button', { name: '숫자', exact: true }).click();
    await expect(picker).toHaveCount(0);
    const number = page.getByRole('spinbutton', { name: '확장 속성 검증 · 숫자', exact: true });
    await number.fill('13.5');
    await number.press('Tab');
    await expect.poll(async () => {
        const db = await read();
        const property = db.properties.find((item) => item.name === '숫자')!;
        return db.rows.find((item) => item.documentId === issue.id)?.values[property.id];
    }).toBe(13.5);

    await add.click();
    await picker.getByRole('button', { name: '날짜', exact: true }).click();
    await expect(picker).toHaveCount(0);
    const date = page.getByLabel('확장 속성 검증 · 날짜', { exact: true });
    await date.fill('2026-11-20');
    await page.getByRole('heading', { name: '워크스페이스 이슈', exact: true }).click();
    await expect(date).not.toBeFocused();
    await expect.poll(async () => {
        const db = await read();
        const property = db.properties.find((item) => item.name === '날짜')!;
        return db.rows.find((item) => item.documentId === issue.id)?.values[property.id];
    }).toBe('2026-11-20');

    await add.click();
    await picker.getByRole('button', { name: '다중 선택', exact: true }).click();
    await expect(picker).toHaveCount(0);
    const multiSelect = page.getByRole('button', { name: '확장 속성 검증 · 다중 선택', exact: true });
    await multiSelect.click();
    await page.getByRole('textbox', { name: '다중 선택 검색', exact: true }).fill('출시 준비');
    await page.getByRole('button', { name: '“출시 준비” 만들기', exact: true }).click();
    await expect.poll(async () => {
        const db = await read();
        const property = db.properties.find((item) => item.name === '다중 선택')!;
        return { options: property.options, value: db.rows.find((item) => item.documentId === issue.id)?.values[property.id] };
    }).toEqual({ options: ['출시 준비'], value: ['출시 준비'] });
    await page.keyboard.press('Escape');

    const before = await read();
    const numberProperty = before.properties.find((item) => item.name === '숫자')!;
    const dateProperty = before.properties.find((item) => item.name === '날짜')!;
    expect((await provision()).id).toBe(source.id);
    await jsonFetch(`${team}/issue/${issue.id}`, { token: f.owner.token, method: 'PATCH', body: { status: 'in_progress' } });
    await page.reload();
    await expect(number).toHaveValue('13.5');
    await expect(date).toHaveValue('2026-11-20');
    await expect(multiSelect).toHaveText('출시 준비');
    await expect(page.getByLabel('확장 속성 검증 · 상태', { exact: true })).toHaveValue('진행 중');

    await page.getByRole('button', { name: '숫자 속성 편집', exact: true }).click();
    await page.getByRole('dialog', { name: '속성 설정', exact: true })
        .getByRole('button', { name: '속성 삭제', exact: true }).click();
    await expect(number).toHaveCount(0);
    let archived = await read();
    expect(archived.properties.some((item) => item.id === numberProperty.id)).toBe(false);
    expect(archived.archivedProperties?.map((item) => item.id)).toContain(numberProperty.id);
    expect(archived.rows.find((item) => item.documentId === issue.id)?.values[numberProperty.id]).toBeUndefined();
    await page.reload();
    await page.getByText('삭제된 속성 (1)', { exact: true }).click();
    await page.getByRole('button', { name: '숫자 속성 복원', exact: true }).click();
    await expect(number).toHaveValue('13.5');
    await page.reload();
    await expect(number).toHaveValue('13.5');
    await expect(date).toHaveValue('2026-11-20');
    archived = await read();
    expect(archived.properties.find((item) => item.id === numberProperty.id)?.type).toBe('number');
    expect(archived.properties.find((item) => item.id === dateProperty.id)?.type).toBe('date');
    expect(archived.archivedProperties).toHaveLength(0);
    expect(archived.rows.map((item) => item.documentId)).toEqual([issue.id]);

    // Canonical issue fields remain protected, and guests cannot extend the schema.
    await expect(jsonFetch(`${team}/database/${source.id}/property/status`, {
        token: f.owner.token, method: 'PATCH', body: { name: '변경 차단', revision: archived.revision },
    })).rejects.toThrow('403');
    const guest = await createGuestSessionForTeam({ ownerToken: f.owner.token, teamId: f.teamId });
    await expect(jsonFetch(`${team}/database/${source.id}/property`, {
        token: guest.token, method: 'POST', body: { name: '게스트 추가 차단', type: 'text', revision: archived.revision },
    })).rejects.toThrow('403');
    expect((await read()).revision).toBe(archived.revision);
});
