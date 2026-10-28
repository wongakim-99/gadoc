import { describe, expect, it } from 'vitest';
import { attachmentFilename } from './attachmentFilename';

describe('legacy attachment filename display', () => {
    it.each(['한글 파일.pdf', 'Q4_한글_日本語_😀_café.txt', '뿿.txt'])('repairs %s without double decoding', (name) => {
        const legacy = Array.from(new TextEncoder().encode(name), (byte) => String.fromCharCode(byte)).join('');
        expect(attachmentFilename(legacy)).toBe(name);
        expect(attachmentFilename(attachmentFilename(legacy))).toBe(name);
    });
    it.each(['report.txt', 'café.txt', 'Ã©.txt', '한글.txt', 'e\u0301.txt', '100%20.txt', '\xea\x80.txt'])(
        'preserves %s',
        (name) => {
            expect(attachmentFilename(name)).toBe(name);
        },
    );
});
