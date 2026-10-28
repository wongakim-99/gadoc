export function fileContentDisposition(disposition: string, name: string): string {
    const safe = name.replace(/[\\/\u0000-\u001f\u007f]/g, '_') || 'file';
    const fallback = safe.replace(/[^\x20-\x7e]|["\\]/g, '_');
    const encoded = encodeURIComponent(safe).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return `${disposition === 'inline' ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function storedFilename(metadata?: Record<string, string>): string | undefined {
    const encoded = metadata?.['filename-utf8'];
    if (!encoded) return undefined;
    try {
        return decodeURIComponent(encoded);
    } catch {
        return undefined;
    }
}
