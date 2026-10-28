function copyWithSelection(value: string) {
    if (typeof document === 'undefined' || !document.body || typeof document.execCommand !== 'function') return false;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selection = window.getSelection();
    const ranges = selection
        ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
        : [];
    const field = document.createElement('textarea');
    field.value = value;
    field.readOnly = true;
    field.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(field);
    try {
        field.focus({ preventScroll: true });
        field.select();
        field.setSelectionRange(0, value.length);
        return document.execCommand('copy');
    } finally {
        field.remove();
        active?.focus({ preventScroll: true });
        selection?.removeAllRanges();
        for (const range of ranges) selection?.addRange(range);
    }
}

export async function copyText(value: string): Promise<void> {
    if (!value) throw new Error('복사할 내용이 없습니다.');
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return;
        } catch {
            // Older desktop clients and restricted browsers can reject the async API.
        }
    }
    try {
        if (copyWithSelection(value)) return;
    } catch {
        /* The caller exposes a selectable manual fallback. */
    }
    throw new Error('자동 복사가 차단됐습니다. 아래 내용을 선택해 직접 복사해 주세요.');
}
