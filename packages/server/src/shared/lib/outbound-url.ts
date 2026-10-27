import { BadRequestException } from '@nestjs/common';

function httpsUrl(value: string): URL {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash)
            throw new Error('unsafe URL');
        return url;
    } catch {
        throw new BadRequestException('허용된 HTTPS 서비스 주소를 입력해 주세요.');
    }
}

export function confluenceSite(value: string, env: NodeJS.ProcessEnv = process.env): string {
    if (env.NODE_ENV === 'test' && value === env.SLACORD_CONFLUENCE_TEST_ORIGIN) {
        const local = new URL(value);
        if (
            local.origin === value &&
            local.hostname === '127.0.0.1' &&
            local.protocol === 'http:' &&
            !local.username &&
            !local.password
        )
            return value;
    }
    const url = httpsUrl(value);
    if (!/^[a-z0-9-]+\.atlassian\.net$/.test(url.hostname) || url.pathname !== '/' || url.search) {
        throw new BadRequestException('Confluence Cloud의 https://팀이름.atlassian.net 주소를 입력해 주세요.');
    }
    return url.origin;
}

export function confluencePageUrl(value: string, origin: string): string {
    const url = new URL(value, origin);
    if (url.origin !== origin || url.username || url.password || !url.pathname.startsWith('/wiki/api/v2/')) {
        throw new BadRequestException('Confluence 응답의 페이지 주소가 올바르지 않습니다.');
    }
    return url.href;
}

export function bridgeWebhookUrl(platform: string, value: string, env: NodeJS.ProcessEnv = process.env): string {
    if (env.NODE_ENV === 'test' && env.SLACORD_BRIDGE_TEST_ORIGIN) {
        try {
            const testUrl = new URL(value);
            if (
                testUrl.origin === env.SLACORD_BRIDGE_TEST_ORIGIN &&
                testUrl.hostname === '127.0.0.1' &&
                testUrl.protocol === 'http:' &&
                !testUrl.username &&
                !testUrl.password &&
                !testUrl.search &&
                !testUrl.hash &&
                /^\/(slack|discord)(-fail)?$/.test(testUrl.pathname)
            )
                return testUrl.href;
        } catch {}
    }
    const url = httpsUrl(value);
    const allowed =
        platform.toLowerCase() === 'slack'
            ? ['hooks.slack.com', 'hooks.slack-gov.com'].includes(url.hostname) &&
              /^\/services\/[^/]+\/[^/]+\/[^/]+$/.test(url.pathname)
            : platform.toLowerCase() === 'discord' &&
              ['discord.com', 'discordapp.com', 'canary.discord.com', 'ptb.discord.com'].includes(url.hostname) &&
              /^\/api(?:\/v\d+)?\/webhooks\/[^/]+\/[^/]+$/.test(url.pathname);
    if (!allowed || url.search)
        throw new BadRequestException('Slack 또는 Discord에서 발급한 webhook 주소만 사용할 수 있습니다.');
    return url.href;
}
