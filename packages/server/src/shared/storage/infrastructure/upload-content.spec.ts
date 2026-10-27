import { safeUploadContent } from './upload-content';

describe('uploaded content', () => {
    it.each(['image/png', 'text/html', 'image/svg+xml', 'application/javascript'])(
        'never trusts the supplied %s content type',
        (mime) => {
            expect(safeUploadContent(Buffer.from('<svg onload="alert(1)"></svg>'), mime)).toEqual({
                mimeType: 'application/octet-stream',
                disposition: 'attachment',
            });
        },
    );
    it('keeps recognized images inline', () => {
        expect(safeUploadContent(Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), 'text/html')).toEqual({
            mimeType: 'image/png',
            disposition: 'inline',
        });
    });
});
