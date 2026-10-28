import { describe, expect, it } from 'vitest';
import { avatarFileError, avatarImageUrl } from './avatar-image';

describe('avatar image sources and selection', () => {
    it('accepts only authenticated local image paths and supported legacy private attachments', () => {
        const url = '/api/profile/111111111111111111111111/avatar/11111111-1111-4111-8111-111111111111.png';
        expect(avatarImageUrl(url)).toBe(url);
        expect(avatarImageUrl('/api/files?key=gadoc/chat/file.png')).toBeTruthy();
        for (const source of [
            'https://example.com/photo.png',
            '//example.com/photo',
            'data:image/svg+xml,x',
            'javascript:alert(1)',
            `${url}?token=secret`,
            '/api/files?key=a&token=secret',
        ])
            expect(avatarImageUrl(source)).toBeNull();
    });
    it('bounds client selection without trusting it as server validation', () => {
        expect(avatarFileError({ size: 20, type: 'image/png' })).toBe('');
        expect(avatarFileError({ size: 2 * 1024 * 1024 + 1, type: 'image/png' })).toContain('2MB');
        expect(avatarFileError({ size: 20, type: 'image/svg+xml' })).toContain('PNG');
    });
});
