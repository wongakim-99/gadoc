import { fileContentDisposition, storedFilename } from './filename';

describe('attachment filenames', () => {
    const names = [
        '한글 파일.pdf',
        'Q4_한글_日本語_😀_café.txt',
        '뿿.txt',
        'report.txt',
        'café.txt',
        'Ã©.txt',
        '100%20.txt',
        'e\u0301.txt',
    ];
    it('stores original names with one percent-encoding round trip', () => {
        for (const name of names) expect(storedFilename({ 'filename-utf8': encodeURIComponent(name) })).toBe(name);
        expect(storedFilename()).toBeUndefined();
        expect(storedFilename({ 'filename-utf8': '%broken' })).toBeUndefined();
    });
    it('emits ASCII-only RFC 8187 headers with an escaped fallback', () => {
        const header = fileContentDisposition('attachment', '한글 "draft" (1)\'*.pdf');
        expect(header).toMatch(/^attachment; filename="[ -~]+"; filename\*=UTF-8''/);
        const encoded = header.split("UTF-8''")[1];
        expect(encoded).not.toMatch(/[!'()*]/);
        expect(decodeURIComponent(encoded)).toBe('한글 "draft" (1)\'*.pdf');
        expect(fileContentDisposition('inline', 'a\r\n/b\\c.txt')).toContain('filename="a___b_c.txt"');
    });
});
