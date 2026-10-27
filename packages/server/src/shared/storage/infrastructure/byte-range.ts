import { HttpException } from '@nestjs/common';

export function byteRange(range: string | undefined, size: number) {
    if (!range) return { start: 0, end: size - 1, partial: false };
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) throw new HttpException('지원하지 않는 파일 범위입니다.', 416);
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size)
        throw new HttpException('파일 범위를 벗어났습니다.', 416);
    return { start, end, partial: true };
}
