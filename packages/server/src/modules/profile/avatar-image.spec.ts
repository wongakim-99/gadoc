import { deflateSync } from 'node:zlib';
import { validateAvatarImage, AVATAR_MAX_BYTES } from './avatar-image';

function chunk(type: string, data: Buffer) {
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const value of body) {
        crc ^= value;
        for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length);
    body.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
}

function png(width = 1, height = 1, raster = Buffer.from([0, 60, 100, 200, 255])) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 6;
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(raster)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function gif(frames = 1, side = 1) {
    const header = Buffer.alloc(13);
    header.write('GIF89a');
    header.writeUInt16LE(side, 6);
    header.writeUInt16LE(side, 8);
    const image = Buffer.from([0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0]);
    return Buffer.concat([header, ...Array.from({ length: frames }, () => image), Buffer.from([0x3b])]);
}

describe('profile image policy', () => {
    it('accepts a generated PNG and a framed GIF', () => {
        expect(validateAvatarImage(png(), 'image/png')).toMatchObject({ width: 1, height: 1, extension: 'png' });
        expect(validateAvatarImage(gif(2), 'image/gif')).toMatchObject({ width: 1, height: 1, extension: 'gif' });
    });
    it.each(['image/jpeg', 'image/webp', 'image/svg+xml', 'text/plain', 'application/octet-stream'])(
        'rejects a PNG declared as %s',
        (mime) => {
            expect(() => validateAvatarImage(png(), mime)).toThrow();
        },
    );
    it('rejects SVG, text, signature-only files, corrupt PNG data and trailing content', () => {
        for (const bytes of [
            Buffer.from('<svg><script/></svg>'),
            png().subarray(0, 8),
            png(1, 1, Buffer.from([0])),
            Buffer.concat([png(), Buffer.from('<svg/>')]),
        ]) {
            expect(() => validateAvatarImage(bytes, 'image/png')).toThrow();
        }
        const broken = png();
        broken[broken.length - 5] ^= 1;
        expect(() => validateAvatarImage(broken, 'image/png')).toThrow();
    });
    it('bounds bytes, raster dimensions, frame count and cumulative animation pixels', () => {
        expect(() => validateAvatarImage(Buffer.alloc(AVATAR_MAX_BYTES + 1), 'image/png')).toThrow('2MB');
        expect(() => validateAvatarImage(png(2049), 'image/png')).toThrow('2048');
        expect(() => validateAvatarImage(png(0), 'image/png')).toThrow();
        expect(() => validateAvatarImage(gif(101), 'image/gif')).toThrow('100프레임');
        expect(() => validateAvatarImage(gif(5, 2048), 'image/gif')).toThrow('1600만');
    });
    it('rejects truncated JPEG/GIF/WebP instead of trusting only their magic bytes', () => {
        for (const [bytes, mime] of [
            [Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'],
            [gif().subarray(0, 20), 'image/gif'],
            [Buffer.from('RIFF0000WEBP'), 'image/webp'],
        ] as const) {
            expect(() => validateAvatarImage(bytes, mime)).toThrow();
        }
    });
});
