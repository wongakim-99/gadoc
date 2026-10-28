import { test, expect } from 'playwright/test';
import { createWorkspaceFixture, jsonFetch } from './support/slacord-api';
import { loginWithSession } from './support/slacord-session';
import type { DatabaseDetail, DatabaseProperty } from '../../packages/web/src/features/database/model/types';

test('status membership persists across rename and board grouping preserves canonical values', async ({ page }) => {
    const f = await createWorkspaceFixture();
    const root = `/team/${f.teamId}/database`;
    const db = (await jsonFetch<{ id: string }>(root, { method: 'POST', token: f.owner.token, body: { name: '상태 범주' } }))!.data!;
    const call = <T>(path: string, body?: unknown, method: 'GET' | 'POST' | 'PATCH' = body ? 'POST' : 'GET') => jsonFetch<T>(`${root}/${db.id}${path}`, { token: f.owner.token, method, body });
    await expect(call('/property', { name: '거부', type: 'text', statusGroups: [], revision: 0 })).rejects.toThrow('400');
    expect((await call<DatabaseDetail>(''))!.data!.revision).toBe(0);
    const prop = (await call<DatabaseProperty>('/property', {
        name: '단계', type: 'status', options: ['준비', '검토', '게시'], revision: 0,
        statusGroups: [{ name: '준비', group: 'todo' }, { name: '검토', group: 'in_progress' }, { name: '게시', group: 'complete' }],
    }))!.data!;
    const optionId = prop.optionIdentities!.find(option => option.name === '검토')!.id;
    const stored = (await call<DatabaseDetail>(''))!.data!.properties.find(property => property.id === prop.id)!;
    expect(stored.statusOptionGroups!.find(item => item.optionId === optionId)!.group).toBe('in_progress');
    await call('/row', { documentId: f.documentId });
    await call(`/row/${f.documentId}/${prop.id}`, { value: '검토', revision: 0 }, 'PATCH');
    await call(`/property/${prop.id}/configuration`, { name: '단계', type: 'status', options: ['준비', '검수', '게시'], optionRenames: [{ id: optionId, name: '검수' }], revision: 1 }, 'PATCH');
    await loginWithSession(page, f.owner);
    await page.goto(`/${f.teamId}/docs?database=${db.id}`);
    await expect(page.getByLabel(/ · 단계$/)).toHaveValue('검수');
    await expect(page.locator('optgroup[label="진행 중"] option', { hasText: '검수' })).toHaveCount(1);
    await page.getByRole('button', { name: '단계 속성 편집', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '속성 설정' });
    await dialog.getByRole('combobox', { name: '검수 상태 그룹', exact: true }).selectOption('complete');
    await expect(dialog.getByRole('region', { name: '완료 상태 옵션', exact: true }).getByRole('textbox', { name: '검수 이름', exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('status-group-editor.png') });
    await dialog.getByRole('button', { name: '변경 적용' }).click();
    await expect(page.locator('optgroup[label="완료"] option', { hasText: '검수' })).toHaveCount(1);
    await page.getByRole('button', { name: '보기 옵션', exact: true }).click();
    await page.getByLabel('레이아웃', { exact: true }).selectOption('board');
    await page.keyboard.press('Escape');
    await page.getByLabel('보드 그룹 기준').selectOption(prop.id);
    await page.getByLabel('보드 상태 표시').selectOption('group');
    const completed = page.getByRole('region', { name: '완료 그룹', exact: true });
    await expect(completed.getByRole('article')).toHaveCount(1);
    await completed.getByRole('combobox', { name: /그룹 이동/ }).selectOption('todo');
    await expect.poll(async () => (await call<DatabaseDetail>(''))!.data!.rows[0].values[prop.id]).toBe('준비');
    await page.getByRole('button', { name: '+ 보기 추가', exact: true }).click();
    await page.getByLabel('보기 이름', { exact: true }).fill('범주별');
    await page.getByRole('button', { name: '보기 저장', exact: true }).click();
    await page.getByRole('button', { name: '범주별', exact: true }).click();
    await expect(page).toHaveURL(/view=/);
    await page.reload();
    await expect(page.getByLabel('보드 상태 표시')).toHaveValue('group');
    await expect(page.getByRole('region', { name: '할 일 그룹', exact: true }).getByRole('article')).toHaveCount(1);
    const card = page.getByRole('region', { name: '할 일 그룹', exact: true }).getByRole('article');
    await expect(card.getByText('검토일', { exact: true })).toHaveCount(0);
    await expect(card.getByText('단계', { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('status-group-board.png') });
    await page.getByRole('button', { name: '보기 옵션', exact: true }).click();
    await page.getByLabel('빈 그룹 숨기기', { exact: true }).check();
    await page.getByLabel('카드 크기', { exact: true }).selectOption('small');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: '완료 그룹', exact: true })).toHaveCount(0);
    await expect.poll(async () => {
        const updated = (await call<DatabaseDetail>(''))!.data!;
        const saved = updated.views.find(view => view.name === '범주별');
        return { hidden: saved?.hideEmptyGroups, size: saved?.cardSize };
    }).toEqual({ hidden: true, size: 'small' });
    await page.reload();
    await expect(page.getByRole('region', { name: '완료 그룹', exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name: '할 일 그룹', exact: true })).toHaveCSS('width', '224px');
    await page.getByRole('button', { name: '보기 옵션', exact: true }).click();
    await page.getByLabel('빈 그룹 숨기기', { exact: true }).uncheck();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: '완료 그룹', exact: true })).toBeVisible();
    expect((await call<DatabaseDetail>(''))!.data!.rows[0].values[prop.id]).toBe('준비');
    const todo = page.getByRole('region', { name: '할 일 그룹', exact: true });
    await todo.getByLabel('할 일 그룹 옵션', { exact: true }).click();
    await todo.getByRole('button', { name: '오른쪽으로 이동', exact: true }).click();
    await todo.getByRole('button', { name: '그룹 숨기기', exact: true }).click();
    await expect(todo).toHaveCount(0);
    await expect.poll(async () => {
        const saved = (await call<DatabaseDetail>(''))!.data!.views.find(view => view.name === '범주별');
        return { hidden: saved?.hiddenBoardGroups?.length, ordered: !!saved?.boardGroupOrder?.length };
    }).toEqual({ hidden: 1, ordered: true });
    await page.reload();
    await expect(todo).toHaveCount(0);
    await page.getByText('숨긴 그룹', { exact: true }).click();
    await page.getByRole('button', { name: '할 일 그룹 다시 표시', exact: true }).click();
    await expect(todo.getByRole('article')).toHaveCount(1);
    const board = page.getByLabel('데이터베이스 보드', { exact: true });
    await expect(board.locator(':scope > section').first()).toHaveAttribute('aria-label', '진행 중 그룹');
    await expect.poll(async () => (await call<DatabaseDetail>(''))!.data!.views.find(view => view.name === '범주별')?.hiddenBoardGroups).toEqual([]);
    await page.reload();
    await expect(board.locator(':scope > section').first()).toHaveAttribute('aria-label', '진행 중 그룹');
    await expect(todo.getByRole('article')).toHaveCount(1);



});
