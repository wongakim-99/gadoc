import { test, expect } from 'playwright/test';
import { createWorkspaceFixture, jsonFetch } from './support/slacord-api';
import { loginWithSession } from './support/slacord-session';
import type { DatabaseDetail, DatabaseProperty } from '../../packages/web/src/features/database/model/types';

test('status category filters include multiple options and persist after reload', async ({ page }) => {
    const f = await createWorkspaceFixture();
    const root = `/team/${f.teamId}/database`;
    const db = (await jsonFetch<{ id: string }>(root, { method: 'POST', token: f.owner.token, body: { name: '상태 그룹 필터' } }))!.data!;
    const call = <T>(path: string, body?: unknown, method: 'GET' | 'POST' | 'PATCH' = body ? 'POST' : 'GET') => jsonFetch<T>(`${root}/${db.id}${path}`, { token: f.owner.token, method, body });
    const prop = (await call<DatabaseProperty>('/property', { name: '단계', type: 'status', options: ['준비', '검토', '수정'], revision: 0,
        statusGroups: [{ name: '준비', group: 'todo' }, { name: '검토', group: 'in_progress' }, { name: '수정', group: 'in_progress' }],
    }))!.data!;
    for (const [title, value] of [['준비 페이지', '준비'], ['검토 페이지', '검토'], ['수정 페이지', '수정']]) {
        const doc = (await jsonFetch<{ id: string }>(`/team/${f.teamId}/document`, { method: 'POST', token: f.owner.token, body: { title, content: '', contentFormat: 'json' } }))!.data!;
        await call('/row', { documentId: doc.id, values: { [prop.id]: value } });
    }
    const filter = { conjunction: 'and', rules: [{ propertyId: prop.id, operator: 'status_group_is', value: 'in_progress' }] };
    const result = (await call<DatabaseDetail & { total: number }>('/query', { filter }))!.data!;
    expect(result.total).toBe(2);
    expect(result.rows.map(row => row.title).sort()).toEqual(['검토 페이지', '수정 페이지'].sort());
    await expect(call('/query', { filter: { conjunction: 'and', rules: [{ propertyId: 'title', operator: 'status_group_is', value: 'todo' }] } })).rejects.toThrow('400');
    await loginWithSession(page, f.owner);
    await page.goto(`/${f.teamId}/docs?database=${db.id}`);
    await page.getByRole('button', { name: '필터', exact: true }).click();
    const builder = page.getByLabel('고급 조회 설정');
    await builder.getByRole('button', { name: '조건 추가', exact: true }).click();
    await builder.getByLabel('필터 속성', { exact: true }).selectOption(prop.id);
    await builder.getByLabel('필터 조건', { exact: true }).selectOption('status_group_is');
    await builder.getByLabel('필터 값', { exact: true }).selectOption('in_progress');
    const table = page.getByRole('table');
    await expect(table.getByRole('link', { name: '검토 페이지', exact: true })).toBeVisible();
    await expect(table.getByRole('link', { name: '수정 페이지', exact: true })).toBeVisible();
    await expect(table.getByRole('link', { name: '준비 페이지', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '+ 보기 추가', exact: true }).click();
    await page.getByLabel('보기 이름', { exact: true }).fill('진행 상태 전체');
    await page.getByRole('button', { name: '보기 저장', exact: true }).click();
    await page.getByRole('button', { name: '진행 상태 전체', exact: true }).click();
    await expect(page).toHaveURL(/view=/);
    await page.reload();
    await expect(table.getByRole('link', { name: '수정 페이지', exact: true })).toBeVisible();
    await expect(table.getByRole('link', { name: '준비 페이지', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '필터', exact: true }).click();
    await expect(builder.getByLabel('필터 조건', { exact: true })).toHaveValue('status_group_is');
    await expect(builder.getByLabel('필터 값', { exact: true })).toHaveValue('in_progress');
});
