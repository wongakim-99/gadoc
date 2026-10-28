import { privateFileUrl } from './private-files';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MAX_SIDE = 2048;
export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function avatarImageUrl(value?: string | null): string | null {
    if (!value) return null;
    const url = privateFileUrl(value);
    if (/^\/api\/profile\/[a-f0-9]{24}\/avatar\/[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(url)) return url;
    return /^\/api\/files\?key=[a-zA-Z0-9._/%-]+$/.test(url) ? url : null;
}

export function avatarFileError(file: Pick<File, 'type' | 'size'>): string {
    if (!AVATAR_MIME_TYPES.includes(file.type)) return 'PNG, JPEG, WebP 또는 GIF 이미지를 선택해 주세요.';
    if (!file.size || file.size > AVATAR_MAX_BYTES) return '프로필 이미지는 2MB 이하여야 합니다.';
    return '';
}
