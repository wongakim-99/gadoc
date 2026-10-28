import path from 'path';
import { app } from 'electron';

const PROD_URL = 'https://gadoc.kr/auth/login';
// 기존 설치본과 초대 링크가 전환되는 동안 구 도메인도 명시적으로 허용한다.
const productionOrigins = ['https://gadoc.kr', 'https://www.gadoc.kr', 'https://slacord.cloud', 'https://www.slacord.cloud'];

export function getStartUrl() {
    return process.env.GADOC_DESKTOP_START_URL || process.env.SLACORD_DESKTOP_START_URL || process.env.SLACORD_APP_URL || PROD_URL;
}

export function getAppOrigin() {
    return new URL(getStartUrl()).origin;
}

export function isAllowedUrl(target: string) {
    try {
        const current = new URL(target);
        if (current.username || current.password) return false;
        if (productionOrigins.includes(current.origin)) return true;
        const configured = new URL(getStartUrl());
        return (
            ['localhost', '127.0.0.1'].includes(configured.hostname) &&
            ['http:', 'https:'].includes(configured.protocol) &&
            current.origin === configured.origin
        );
    } catch {
        return false;
    }
}

export function getPreloadPath() {
    return path.join(__dirname, 'preload.js');
}

export function getNotificationIcon() {
    if (app.isPackaged) return path.join(process.resourcesPath, 'assets', 'icon.png');
    return path.join(app.getAppPath(), 'build', 'icon.png');
}

/** Only same-origin application paths may be opened by native notifications. */
export function resolveAppPath(href: unknown): string | null {
    if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return null;
    try {
        const target = new URL(href, getAppOrigin());
        return target.origin === getAppOrigin() ? target.pathname + target.search + target.hash : null;
    } catch {
        return null;
    }
}

export function isExternalUrl(target: string) {
    try {
        return ['https:', 'http:', 'mailto:'].includes(new URL(target).protocol);
    } catch {
        return false;
    }
}
