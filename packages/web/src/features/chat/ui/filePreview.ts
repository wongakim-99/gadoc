import type { Attachment } from '@/src/entities/message/types';
import { privateFileUrl } from '../../../shared/lib/private-files';

export function filePreviewKind(file: Pick<Attachment, 'mimeType' | 'name'>) {
    const mime = file.mimeType.toLowerCase().split(';')[0];
    if (mime === 'application/pdf') return 'pdf';
    // Uploads deliberately normalize non-media MIME types. Validate PDF bytes after fetching.
    if ((!mime || mime === 'application/octet-stream') && /\.pdf$/i.test(file.name)) return 'pdf';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('text/') || ['application/json', 'application/xml', 'application/javascript'].includes(mime))
        return 'text';
    if (
        (!mime || mime === 'application/octet-stream') &&
        /\.(txt|md|csv|log|json|xml|ya?ml|html?|css|js|ts)$/i.test(file.name)
    )
        return 'text';
    return 'unsupported';
}

// Preview requests only use the app's permission-checked attachment endpoint.
export function previewUrl(value: string, origin: string) {
    try {
        const url = new URL(privateFileUrl(value), origin);
        if (url.origin !== origin || url.pathname !== '/api/files' || !url.searchParams.has('key')) return null;
        return url.href;
    } catch {
        return null;
    }
}

export async function readPreviewBytes(response: Response, limit: number) {
    if (!response.ok) throw new Error('파일을 불러오지 못했습니다. 접근 권한과 연결 상태를 확인해 주세요.');
    if (Number(response.headers.get('content-length')) > limit) {
        await response.body?.cancel();
        throw new Error('미리보기 용량을 초과했습니다. 다운로드해서 확인해 주세요.');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('파일 내용을 읽을 수 없습니다.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > limit) {
                await reader.cancel();
                throw new Error('미리보기 용량을 초과했습니다. 다운로드해서 확인해 주세요.');
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}
