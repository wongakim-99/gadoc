export function creationRequestId(ref: { current: { key: string; id: string } | null }, key: string): string {
    if (ref.current?.key !== key)
        ref.current = {
            key,
            id: Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
                byte.toString(16).padStart(2, '0'),
            ).join(''),
        };
    return ref.current.id;
}
