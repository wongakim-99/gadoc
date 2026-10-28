import { test, expect } from 'playwright/test';
import { createWorkspaceFixture, e2eBaseUrl, jsonFetch } from './support/slacord-api';

test('issue deletion and announcement/channel editing preserve failures and enforce permissions', async ({ page }) => {
    test.setTimeout(90000);
    const f = await createWorkspaceFixture();
    if (process.env.SLACORD_E2E_PROXY_API) {
        await page.route('**/api/**', async route => {
            const url = new URL(route.request().url());
            const response = await route.fetch({ url: process.env.SLACORD_E2E_PROXY_API + url.pathname + url.search });
            await route.fulfill({ response });
        });
    }
    await page.context().addCookies([{ name: 'access_token', value: f.owner.token, url: e2eBaseUrl, httpOnly: true, sameSite: 'Lax' }]);
    const announcement = await jsonFetch<{ id: string }>(`/team/${f.teamId}/announcement`, {
        method: 'POST', token: f.owner.token, body: { title: '공지 CRUD 검증', content: '원본 내용' },
    });
    const announcementId = announcement!.data!.id;
    await expect(jsonFetch(`/team/${f.teamId}/announcement/${announcementId}`, {
        method: 'DELETE', token: f.actor.token,
    })).rejects.toThrow('403');
    await page.goto(`/${f.teamId}/announcements`);
    const card = page.locator(`#announcement-${announcementId}`);
    await card.getByRole('button', { name: '수정', exact: true }).click();
    await page.getByPlaceholder('공지 제목', { exact: true }).fill('수정된 공지');
    const failedSave = async (route: import('playwright/test').Route) => route.request().method() === 'PATCH'
        ? route.fulfill({ status: 503, json: { success: false, message: '잠시 후 다시 시도' } }) : route.fallback();
    await page.route(`**/announcement/${announcementId}`, failedSave);
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: '작성 내용은 유지' })).toBeVisible();
    await expect(page.getByPlaceholder('공지 제목', { exact: true })).toHaveValue('수정된 공지');
    await page.unroute(`**/announcement/${announcementId}`, failedSave);
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(card.getByRole('heading', { name: '수정된 공지' })).toBeVisible();
    await card.getByRole('button', { name: '삭제', exact: true }).click();
    await page.getByRole('dialog', { name: '공지를 삭제할까요?' }).getByRole('button', { name: '삭제', exact: true }).click();
    await expect(card).toHaveCount(0);
    const issue = await jsonFetch<{ id: string }>(`/team/${f.teamId}/issue`, {
        method: 'POST', token: f.owner.token, body: { title: '삭제할 이슈', priority: 'medium', status: 'todo' },
    });
    const issueId = issue!.data!.id;
    await page.goto(`/${f.teamId}/issues?issue=${issueId}`);
    await page.getByRole('dialog', { name: '이슈 상세', exact: true }).getByRole('button', { name: '편집', exact: true }).click();
    await page.getByRole('dialog', { name: '이슈 수정', exact: true }).getByRole('button', { name: '삭제', exact: true }).click();
    const failDelete = async (route: import('playwright/test').Route) => route.request().method() === 'DELETE'
        ? route.fulfill({ status: 503, json: { success: false, message: '삭제 실패' } }) : route.fallback();
    await page.route(`**/issue/${issueId}`, failDelete);
    await page.getByRole('dialog', { name: '이슈를 삭제할까요?' }).getByRole('button', { name: '삭제', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '이슈 수정', exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: '삭제 실패' })).toBeVisible();
    await page.unroute(`**/issue/${issueId}`, failDelete);
    await page.getByRole('dialog', { name: '이슈 수정', exact: true }).getByRole('button', { name: '삭제', exact: true }).click();
    await page.getByRole('dialog', { name: '이슈를 삭제할까요?' }).getByRole('button', { name: '삭제', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '이슈 수정', exact: true })).toHaveCount(0);
    const issues = await jsonFetch<Array<{ id: string }>>(`/team/${f.teamId}/issue`, { token: f.owner.token });
    expect(issues!.data!.some(item => item.id === issueId)).toBe(false);
    await expect(jsonFetch(`/team/${f.teamId}/channel/${f.channelId}`, { method: 'DELETE', token: f.actor.token })).rejects.toThrow('403');
    await page.goto(`/${f.teamId}/channel/${f.channelId}`);
    await page.getByRole('button', { name: '채널 관리', exact: true }).click();
    await page.getByRole('textbox', { name: '채널 이름', exact: true }).fill('renamed-channel');
    await page.getByRole('textbox', { name: '채널 설명', exact: true }).fill('설명 수정');
    await page.getByRole('button', { name: '변경 저장', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '채널 관리', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '채널 이름', exact: true })).toHaveValue('renamed-channel');
    await page.getByRole('button', { name: '채널 삭제', exact: true }).click();
    await page.getByRole('button', { name: '영구 삭제', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${f.teamId}/channel$`));
    const channels = await jsonFetch<Array<{ id: string }>>(`/team/${f.teamId}/channel`, { token: f.owner.token });
    expect(channels!.data!.some(item => item.id === f.channelId)).toBe(false);
    await expect(jsonFetch(`/channel/${f.channelId}/message`, { token: f.owner.token })).rejects.toThrow('400');
});
