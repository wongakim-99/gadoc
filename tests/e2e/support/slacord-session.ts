import { test, type Page } from 'playwright/test';
import { pacedAuthRequest } from './auth-request';
import type { AuthSession } from './slacord-api';

export async function loginWithSession(page: Page, session: AuthSession) {
    await page.goto('/auth/login');
    await page.getByPlaceholder('team@company.com').fill(session.email);
    await page.getByPlaceholder('비밀번호 입력').fill(session.password);
    const response = await pacedAuthRequest(async () => {
        const [result] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/auth/login') && response.request().method() === 'POST'),
            page.getByRole('button', { name: '로그인', exact: true }).click(),
        ]);
        return new Response(null, { status: result.status(), headers: result.headers() });
    }, async (milliseconds) => {
        const info = test.info();
        if (info.timeout > 0) info.setTimeout(info.timeout + milliseconds);
        await new Promise(resolve => setTimeout(resolve, milliseconds));
    });
    if (!response.ok) throw new Error(`E2E login failed: HTTP ${response.status}`);
    await page.waitForURL('**/dashboard');
}
