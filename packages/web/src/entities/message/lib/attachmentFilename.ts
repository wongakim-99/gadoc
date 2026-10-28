/** Non-destructive display repair for legacy UTF-8 filenames stored as Latin-1. */
export function attachmentFilename(name: string): string {
    if (/[^\u0000-\u00ff]/u.test(name)) return name;
    try {
        const decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
            Uint8Array.from(name, (char) => char.charCodeAt(0)),
        );
        return /[\u0080-\u009f]/u.test(name) || /[^\u0000-\u00ff]/u.test(decoded) ? decoded : name;
    } catch {
        return name;
    }
}
