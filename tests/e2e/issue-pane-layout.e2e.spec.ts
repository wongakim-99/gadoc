import { expect, test } from 'playwright/test';

test('issue board adapts to its pane width and exposes unassigned filtering', async ({ page }, testInfo) => {
    const queries: string[] = [];
    await page.route('**/api/**', async (route) => {
        const url = new URL(route.request().url());
        let data: unknown = [];
        if (url.pathname === '/api/auth/me') data = { id: 'review-user', username: 'Reviewer' };
        else if (url.pathname.endsWith('/member')) data = [{ userId: 'review-user', role: 'owner', user: { username: 'Reviewer' } }];
        else if (url.pathname === '/api/team/review-team') data = { id: 'review-team', name: 'Review workspace' };
        else if (url.pathname.endsWith('/issue')) {
            queries.push(url.search);
            data = [{ id: 'issue-one', teamId: 'review-team', title: 'A narrow pane issue', description: '', status: 'todo', priority: 'medium', assigneeIds: [], labels: [] }];
        }
        await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/review-team/issues');
    await expect(page.locator('.issue-board-columns')).toBeVisible();
    await page.getByRole('combobox', { name: '담당자 필터' }).click();
    await page.getByRole('listbox', { name: '담당자 필터' }).getByRole('option', { name: '미할당', exact: true }).click();
    await expect.poll(() => queries.some((query) => query.includes('assigneeId=unassigned'))).toBe(true);
    await page.getByRole('button', { name: '이슈 옆에 열기', exact: true }).click();
    await expect(page.locator('.issue-board-stacked')).toBeVisible();
    await expect(page.locator('.issue-board-columns')).toBeHidden();
    await expect(page.frameLocator('iframe').locator('.issue-board-stacked')).toBeVisible();
    await expect(page.locator('.issue-board-stacked').getByText('미할당', { exact: true })).toBeVisible();
    const primary = await page.locator('.connection-primary').boundingBox();
    const secondary = await page.locator('.connection-secondary').boundingBox();
    expect(primary!.x + primary!.width).toBeLessThanOrEqual(secondary!.x);
    await page.screenshot({ path: testInfo.outputPath('split-issues.png') });
    await page.setViewportSize({ width: 400, height: 800 });
    await expect(page.frameLocator('iframe').locator('.issue-board-stacked')).toBeVisible();
    const widths = await page.frameLocator('iframe').locator('.issue-workspace').evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
    await page.screenshot({ path: testInfo.outputPath('compact-issues.png') });
});
