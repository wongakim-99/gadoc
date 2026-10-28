import { test, expect } from 'playwright/test';
import { createWorkspaceFixture, e2eBaseUrl, jsonFetch } from './support/slacord-api';

test('database records stay in the table and a reordered title retains its cell boundary', async ({ page }) => {
    const f = await createWorkspaceFixture();
    if (process.env.SLACORD_E2E_PROXY_API) {
        await page.route('**/api/**', async route => {
            const url = new URL(route.request().url());
            const response = await route.fetch({ url: process.env.SLACORD_E2E_PROXY_API + url.pathname + url.search });
            await route.fulfill({ response });
        });
    }
    const call = async <T>(path: string, body?: unknown) => (await jsonFetch<T>(`/team/${f.teamId}${path}`, {
        token: f.owner.token, method: body ? 'POST' : 'GET', body,
    }))!.data!;
    const db = await call<{ id: string }>('/database', { name: '탐색 검증 데이터베이스' });
    await call(`/database/${db.id}/row/page`, { title: '데이터베이스 전용 항목', creationId: crypto.randomUUID().replaceAll('-', '').slice(0, 24), values: {} });
    const documents = await call<Array<{ title: string; isDatabasePage?: boolean }>>('/document');
    expect(documents.find(doc => doc.title === '데이터베이스 전용 항목')?.isDatabasePage).toBe(true);
    await page.context().addCookies([{ name: 'access_token', value: f.owner.token, url: e2eBaseUrl, httpOnly: true, sameSite: 'Lax' }]);
    await page.goto(`/${f.teamId}/docs?database=${db.id}`);
    const sidebar = page.getByRole('complementary', { name: '워크스페이스 사이드바' });
    await expect(sidebar.getByRole('link', { name: '탐색 검증 데이터베이스', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: '데이터베이스 전용 항목', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('데이터베이스 전용 항목 페이지 이름')).toBeVisible();
    const actionCenters = await sidebar.locator('.workspace-inline-open').evaluateAll(buttons => buttons.map(button => {
        const rect = button.getBoundingClientRect();
        return rect.x + rect.width / 2;
    }));
    expect(actionCenters.length).toBeGreaterThan(2);
    expect(Math.max(...actionCenters) - Math.min(...actionCenters)).toBeLessThanOrEqual(1);
    const add = sidebar.getByRole('link', { name: '페이지 추가', exact: true });
    const addBounds = await add.boundingBox();
    expect(addBounds!.width).toBe(32);
    expect(addBounds!.x + addBounds!.width / 2).toBe(actionCenters[0]);
    await expect(sidebar.locator('[aria-current="location"]')).toHaveCSS('box-shadow', 'none');

    const brandBounds = await sidebar.getByTestId('workspace-brand-header').boundingBox();
    const headerBounds = await page.locator('[data-database-instance] > header').boundingBox();
    expect(Math.abs(brandBounds!.height - headerBounds!.height)).toBeLessThanOrEqual(1);
    const headers = page.getByRole('columnheader');
    await headers.nth(0).dragTo(headers.nth(2));
    await expect(headers.nth(2)).toContainText('이름');
    await expect(headers.nth(2)).toHaveCSS('border-left-width', '1px');
    await expect(page.getByLabel('데이터베이스 전용 항목 페이지 이름').locator('xpath=ancestor::td')).toHaveCSS('border-left-width', '1px');
    const geometry = await page.getByRole('table').evaluate(table => {
        const bounds = (selector: string) => Array.from(table.querySelectorAll(selector)).map(cell => {
            const rect = cell.getBoundingClientRect();
            return { x: rect.x, width: rect.width };
        });
        return { headers: bounds('thead th'), footer: bounds('tfoot td') };
    });
    expect(geometry.footer).toEqual(geometry.headers);
    await page.screenshot({ path: test.info().outputPath('database-navigation.png'), fullPage: true });
});
