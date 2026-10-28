import { describe, expect, it } from 'vitest';
import { filePreviewKind, previewUrl, readPreviewBytes } from './filePreview';

describe('attachment preview safety', () => {
    it('only fetches permission-checked local attachments', () => {
        expect(previewUrl('/api/files?key=gadoc/test.txt', 'https://slacord.cloud')).toBe(
            'https://slacord.cloud/api/files?key=gadoc/test.txt',
        );
        expect(previewUrl('https://attacker.example/api/files?key=a', 'https://slacord.cloud')).toBeNull();
        expect(previewUrl('/api/auth/me', 'https://slacord.cloud')).toBeNull();
        expect(previewUrl('https://bucket.kscold.com/gadoc/gadoc/test.txt', 'https://slacord.cloud')).toContain(
            '/api/files?key=gadoc/test.txt',
        );
    });
    it('renders markup as text and does not infer executable previews from extensions', () => {
        expect(filePreviewKind({ mimeType: 'text/html', name: 'page.html' })).toBe('text');
        expect(filePreviewKind({ mimeType: 'image/svg+xml', name: 'image.svg' })).toBe('unsupported');
        expect(filePreviewKind({ mimeType: 'application/octet-stream', name: 'report.pdf' })).toBe('pdf');
        expect(filePreviewKind({ mimeType: 'application/pdf', name: 'report.pdf' })).toBe('pdf');
    });
    it('rejects unauthorized responses and bounds streams without content-length', async () => {
        await expect(readPreviewBytes(new Response('denied', { status: 403 }), 10)).rejects.toThrow('접근 권한');
        await expect(readPreviewBytes(new Response('12345'), 4)).rejects.toThrow('용량');
        expect(new TextDecoder().decode(await readPreviewBytes(new Response('hello'), 10))).toBe('hello');
    });
});
