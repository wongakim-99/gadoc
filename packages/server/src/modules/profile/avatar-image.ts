import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { safeUploadContent } from '../../shared/storage/infrastructure/upload-content';
import { inflateSync } from 'node:zlib';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MAX_SIDE = 2048;
export const AVATAR_MAX_FRAMES = 100;
export const AVATAR_MAX_FRAME_PIXELS = 16_000_000;
const extensions: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

function invalid(): never {
    throw new BadRequestException('올바른 PNG, JPEG, WebP 또는 GIF 이미지를 선택해 주세요.');
}

function dimensions(width: number, height: number) {
    if (!width || !height || width > AVATAR_MAX_SIDE || height > AVATAR_MAX_SIDE) {
        throw new BadRequestException('프로필 이미지는 가로·세로 각각 2048픽셀 이하여야 합니다.');
    }
    return { width, height };
}

function animation(frames: number, pixels: number) {
    if (frames > AVATAR_MAX_FRAMES || pixels > AVATAR_MAX_FRAME_PIXELS) {
        throw new BadRequestException('움직이는 이미지는 100프레임, 전체 1600만 픽셀 이내로 선택해 주세요.');
    }
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
    let crc = index;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    return crc >>> 0;
});
function crc32(bytes: Buffer) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function pngRaster(buffer: Buffer, width: number, height: number, compressed: Buffer[]) {
    const depth = buffer[24],
        color = buffer[25],
        interlace = buffer[28];
    const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color];
    const depths = color === 0 || color === 3 ? [1, 2, 4, 8, ...(color === 0 ? [16] : [])] : [8, 16];
    if (!channels || !depths.includes(depth) || buffer[26] || buffer[27] || interlace > 1) invalid();
    const passes = interlace
        ? [
              [0, 0, 8, 8],
              [4, 0, 8, 8],
              [0, 4, 4, 8],
              [2, 0, 4, 4],
              [0, 2, 2, 4],
              [1, 0, 2, 2],
              [0, 1, 1, 2],
          ]
        : [[0, 0, 1, 1]];
    const rows = passes.map(([x, y, dx, dy]) => {
        const w = Math.max(0, Math.ceil((width - x) / dx)),
            h = Math.max(0, Math.ceil((height - y) / dy));
        return { bytes: Math.ceil((w * channels * depth) / 8) + 1, count: w ? h : 0 };
    });
    const expected = rows.reduce((sum, row) => sum + row.bytes * row.count, 0);
    const raster = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
    if (raster.length !== expected) invalid();
    let offset = 0;
    for (const row of rows)
        for (let index = 0; index < row.count; index++) {
            if (raster[offset] > 4) invalid();
            offset += row.bytes;
        }
}

function png(buffer: Buffer) {
    if (buffer.length < 45 || buffer.readUInt32BE(8) !== 13 || buffer.toString('ascii', 12, 16) !== 'IHDR') invalid();
    const size = dimensions(buffer.readUInt32BE(16), buffer.readUInt32BE(20));
    let data = false;
    let frames = 1;
    let frameControls = 0;
    const compressed: Buffer[] = [];
    for (let offset = 8; offset + 12 <= buffer.length;) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        const end = offset + 12 + length;
        if (end > buffer.length) invalid();
        if (crc32(buffer.subarray(offset + 4, end - 4)) !== buffer.readUInt32BE(end - 4)) invalid();
        if (type === 'acTL') {
            if (length !== 8) invalid();
            frames = buffer.readUInt32BE(offset + 8);
            if (!frames) invalid();
            animation(frames, frames * size.width * size.height);
        }
        if (type === 'fcTL') {
            if (length !== 26) invalid();
            const frame = dimensions(buffer.readUInt32BE(offset + 12), buffer.readUInt32BE(offset + 16));
            if (frame.width > size.width || frame.height > size.height) invalid();
            animation(++frameControls, frameControls * size.width * size.height);
        }
        if (type === 'IDAT' && length) {
            data = true;
            compressed.push(buffer.subarray(offset + 8, end - 4));
        }
        if (type === 'IEND') {
            if (length || !data || end !== buffer.length) invalid();
            if (frameControls && frameControls !== frames) invalid();
            pngRaster(buffer, size.width, size.height, compressed);
            return size;
        }
        offset = end;
    }
    return invalid();
}

function jpeg(buffer: Buffer) {
    if (buffer.length < 12 || buffer.readUInt16BE(buffer.length - 2) !== 0xffd9) invalid();
    let size: ReturnType<typeof dimensions> | undefined;
    let offset = 2;
    while (offset + 4 <= buffer.length) {
        if (buffer[offset++] !== 0xff) invalid();
        while (buffer[offset] === 0xff) offset++;
        const marker = buffer[offset++];
        const length = buffer.readUInt16BE(offset);
        if (length < 2 || offset + length > buffer.length) invalid();
        if ([0xc0, 0xc1, 0xc2].includes(marker)) {
            if (length < 8 || size) invalid();
            size = dimensions(buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3));
        }
        if (marker === 0xda) {
            if (!size || offset + length >= buffer.length - 2) invalid();
            return size;
        }
        offset += length;
    }
    return invalid();
}

function gif(buffer: Buffer) {
    if (buffer.length < 14) invalid();
    const size = dimensions(buffer.readUInt16LE(6), buffer.readUInt16LE(8));
    let offset = 13 + (buffer[10] & 0x80 ? 3 * (1 << ((buffer[10] & 7) + 1)) : 0);
    let frames = 0;
    const blocks = () => {
        while (offset < buffer.length) {
            const length = buffer[offset++];
            if (!length) return;
            offset += length;
            if (offset > buffer.length) invalid();
        }
        invalid();
    };
    while (offset < buffer.length) {
        const type = buffer[offset++];
        if (type === 0x3b) {
            if (!frames || offset !== buffer.length) invalid();
            return size;
        }
        if (type === 0x21) {
            offset++;
            blocks();
        } else if (type === 0x2c) {
            if (offset + 9 >= buffer.length) invalid();
            const frame = dimensions(buffer.readUInt16LE(offset + 4), buffer.readUInt16LE(offset + 6));
            if (
                buffer.readUInt16LE(offset) + frame.width > size.width ||
                buffer.readUInt16LE(offset + 2) + frame.height > size.height
            )
                invalid();
            const packed = buffer[offset + 8];
            offset += 9 + (packed & 0x80 ? 3 * (1 << ((packed & 7) + 1)) : 0);
            const codeSize = buffer[offset++];
            if (codeSize < 2 || codeSize > 8 || !buffer[offset]) invalid();
            blocks();
            animation(++frames, frames * size.width * size.height);
        } else invalid();
    }
    return invalid();
}

function webp(buffer: Buffer) {
    if (buffer.length < 26 || buffer.readUInt32LE(4) + 8 !== buffer.length) invalid();
    let size: ReturnType<typeof dimensions> | undefined;
    let frames = 0;
    let image = false;
    let animated = false;
    let animationHeader = false;
    const frameSize = (type: string, start: number, length: number) => {
        if (type === 'VP8 ') {
            if (length < 10 || buffer.toString('hex', start + 3, start + 6) !== '9d012a' || buffer[start] & 1)
                invalid();
            return dimensions(buffer.readUInt16LE(start + 6) & 0x3fff, buffer.readUInt16LE(start + 8) & 0x3fff);
        }
        if (type !== 'VP8L' || length < 5 || buffer[start] !== 0x2f) return invalid();
        const bits = buffer.readUInt32LE(start + 1);
        if (bits >>> 29) invalid();
        return dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    };
    for (let offset = 12; offset + 8 <= buffer.length;) {
        const type = buffer.toString('ascii', offset, offset + 4);
        const length = buffer.readUInt32LE(offset + 4);
        const start = offset + 8;
        const end = start + length + (length & 1);
        if (end > buffer.length) invalid();
        if (type === 'VP8X') {
            if (length !== 10 || size) invalid();
            size = dimensions(buffer.readUIntLE(start + 4, 3) + 1, buffer.readUIntLE(start + 7, 3) + 1);
            animated = Boolean(buffer[start] & 2);
        } else if (type === 'VP8 ' || type === 'VP8L') {
            const frame = frameSize(type, start, length);
            size ??= frame;
            if (frame.width !== size.width || frame.height !== size.height) invalid();
            if (image || animated) invalid();
            image = true;
        } else if (type === 'ANIM') {
            if (!animated || animationHeader || length !== 6) invalid();
            animationHeader = true;
        } else if (type === 'ANMF') {
            if (!size || !animated || !animationHeader || length < 24) invalid();
            const frame = dimensions(buffer.readUIntLE(start + 6, 3) + 1, buffer.readUIntLE(start + 9, 3) + 1);
            if (
                2 * buffer.readUIntLE(start, 3) + frame.width > size.width ||
                2 * buffer.readUIntLE(start + 3, 3) + frame.height > size.height
            )
                invalid();
            animation(++frames, frames * size.width * size.height);
            let hasImage = false;
            for (let part = start + 16; part < start + length;) {
                if (part + 8 > start + length) invalid();
                const kind = buffer.toString('ascii', part, part + 4),
                    bytes = buffer.readUInt32LE(part + 4);
                const next = part + 8 + bytes + (bytes & 1);
                if (next > start + length) invalid();
                if (kind === 'VP8 ' || kind === 'VP8L') {
                    const actual = frameSize(kind, part + 8, bytes);
                    if (hasImage || actual.width !== frame.width || actual.height !== frame.height) invalid();
                    hasImage = true;
                } else if (kind !== 'ALPH' || hasImage) invalid();
                part = next;
            }
            if (!hasImage) invalid();
        }
        offset = end;
        if (offset === buffer.length && size && (image || frames)) return size;
    }
    return invalid();
}

/** Bounded container inspection; never fetches URLs or decodes an unbounded raster. */
export function validateAvatarImage(buffer: Buffer, mimeType: string) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) invalid();
    if (buffer.length > AVATAR_MAX_BYTES) throw new PayloadTooLargeException('프로필 이미지는 2MB 이하여야 합니다.');
    if (!extensions[mimeType] || safeUploadContent(buffer, mimeType).mimeType !== mimeType) invalid();
    try {
        const inspect = { 'image/png': png, 'image/jpeg': jpeg, 'image/gif': gif, 'image/webp': webp }[mimeType]!;
        return { ...inspect(buffer), mimeType, extension: extensions[mimeType] };
    } catch (error) {
        if (error instanceof BadRequestException) throw error;
        return invalid();
    }
}
