export function safeUploadContent(buffer: Buffer, declared: string) {
    const starts = (bytes: number[]) => bytes.every((value, index) => buffer[index] === value);
    let mimeType = 'application/octet-stream';
    if (starts([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])) mimeType = 'image/png';
    else if (starts([0xff, 0xd8, 0xff])) mimeType = 'image/jpeg';
    else if (['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) mimeType = 'image/gif';
    else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')
        mimeType = 'image/webp';
    else if (buffer.toString('ascii', 4, 8) === 'ftyp' && ['avif', 'avis'].includes(buffer.toString('ascii', 8, 12)))
        mimeType = 'image/avif';
    else if (buffer.toString('ascii', 4, 8) === 'ftyp' && declared === 'video/mp4') mimeType = 'video/mp4';
    else if (starts([0x1a, 0x45, 0xdf, 0xa3]) && ['video/webm', 'audio/webm'].includes(declared)) mimeType = declared;
    else if ((buffer.toString('ascii', 0, 3) === 'ID3' || starts([0xff, 0xfb])) && declared === 'audio/mpeg')
        mimeType = declared;
    return { mimeType, disposition: mimeType === 'application/octet-stream' ? 'attachment' : 'inline' };
}
