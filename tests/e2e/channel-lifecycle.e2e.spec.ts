import { test, expect } from 'playwright/test';
import { createWorkspaceFixture, sendSocketMessage, jsonFetch } from './support/slacord-api';
import { loginWithSession } from './support/slacord-session';

test('reply notifications open the exact thread; clipboard stays a draft; channel archive preserves read access and can restore', async ({ page }) => {
    test.setTimeout(90000);
    const f = await createWorkspaceFixture();
    const privateChannel = await jsonFetch<{ id: string; name: string }>(`/team/${f.teamId}/channel`, {
        method: 'POST', token: f.owner.token,
        body: { name: 'private-review', type: 'private', memberIds: [f.actor.userId] },
    });
    f.channelId = privateChannel!.data!.id;
    f.channelName = privateChannel!.data!.name;
    const parent = await sendSocketMessage({ session: f.owner, teamId: f.teamId, channelId: f.channelId, content: '알림 이동 원문' });
    const reply = await sendSocketMessage({ session: f.actor, teamId: f.teamId, channelId: f.channelId, content: '답글 위치 확인', replyToId: parent.id });
    await loginWithSession(page, f.owner);
    await page.goto(`/${f.teamId}/channel/${f.channelId}`);
    await page.getByRole('button', { name: /^알림/ }).click();
    await page.getByRole('dialog', { name: '알림', exact: true }).getByRole('button').filter({ hasText: '답글 위치 확인' }).click();
    await expect(page).toHaveURL(new RegExp(`message=${reply.id}`));
    const thread = page.getByRole('complementary', { name: '스레드' });
    await expect(thread.locator(`[data-message-id="${reply.id}"]`)).toBeVisible();
    await thread.getByRole('button', { name: '스레드 닫기' }).click();
    await page.getByRole('button', { name: /^알림/ }).click();
    await page.getByRole('dialog', { name: '알림', exact: true }).getByRole('button').filter({ hasText: '답글 위치 확인' }).click();
    await expect(thread.locator(`[data-message-id="${reply.id}"]`)).toBeVisible();
    await thread.getByRole('button', { name: '스레드 닫기' }).click();
    const composer = page.getByPlaceholder(`#${f.channelName}에 메시지 보내기`, { exact: true });
    await composer.fill('붙여넣어도 자동 전송하지 않음');
    await composer.evaluate((element) => {
        const transfer = new DataTransfer();
        transfer.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'clipboard.png', { type: 'image/png' }));
        element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
    });
    await expect(page.getByRole('button', { name: 'clipboard.png 제거' })).toBeVisible();
    await expect(composer).toHaveValue('붙여넣어도 자동 전송하지 않음');
    await page.getByRole('button', { name: 'clipboard.png 제거' }).click();
    await composer.fill('');
    await page.getByRole('button', { name: '채널 관리' }).click();
    await page.getByRole('button', { name: '채널 보관', exact: true }).click();
    await expect(page.getByText('보관된 채널입니다. 기존 메시지는 계속 확인할 수 있습니다.')).toBeVisible();
    await expect(composer).not.toBeVisible();
    const messages = await jsonFetch<unknown[]>(`/channel/${f.channelId}/message`, { token: f.owner.token });
    expect(messages!.data!.length).toBeGreaterThan(0);
    await expect(jsonFetch(`/channel/${f.channelId}/message/${parent.id}`, { method: 'PATCH', token: f.owner.token, body: { content: '보관중 수정' } })).rejects.toThrow('403');
    await page.getByRole('button', { name: '채널 관리' }).click();
    await page.getByRole('button', { name: '채널 복원', exact: true }).click();
    await expect(composer).toBeEditable();
    await page.reload();
    await expect(composer).toBeEditable();
});
