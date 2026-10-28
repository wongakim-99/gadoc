import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './copyText';

afterEach(() => vi.unstubAllGlobals());

function legacy(copyResult: boolean | Error) {
    class Element {
        focus = vi.fn();
    }
    const active = new Element();
    const field = {
        value: '',
        readOnly: false,
        style: { cssText: '' },
        focus: vi.fn(),
        select: vi.fn(),
        setSelectionRange: vi.fn(),
        remove: vi.fn(),
    };
    const exec = vi.fn(() => {
        if (copyResult instanceof Error) throw copyResult;
        return copyResult;
    });
    vi.stubGlobal('HTMLElement', Element);
    vi.stubGlobal('document', {
        activeElement: active,
        createElement: () => field,
        execCommand: exec,
        body: { appendChild: vi.fn() },
    });
    vi.stubGlobal('window', { getSelection: () => null });
    return { exec, field, active };
}

describe('clipboard writing', () => {
    it('awaits the async API and does not inspect the clipboard or DOM', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        await copyText('https://example.test/invite/sample');
        expect(writeText).toHaveBeenCalledExactlyOnceWith('https://example.test/invite/sample');
    });
    it('falls back when the async API is denied and restores focus', async () => {
        vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
        const h = legacy(true);
        await copyText('copy this');
        expect(h.exec).toHaveBeenCalledExactlyOnceWith('copy');
        expect(h.field.value).toBe('copy this');
        expect(h.field.remove).toHaveBeenCalledOnce();
        expect(h.active.focus).toHaveBeenCalledOnce();
    });
    it('works without a navigator clipboard implementation', async () => {
        vi.stubGlobal('navigator', {});
        const h = legacy(true);
        await copyText('legacy');
        expect(h.field.value).toBe('legacy');
    });
    it.each([false, new Error('Blocked')])('never reports success when both methods fail (%s)', async (result) => {
        vi.stubGlobal('navigator', {});
        const h = legacy(result);
        await expect(copyText('manual')).rejects.toThrow('자동 복사가 차단');
        expect(h.field.remove).toHaveBeenCalledOnce();
        expect(h.active.focus).toHaveBeenCalledOnce();
    });
    it('rejects empty values without claiming that an invitation was copied', async () => {
        const writeText = vi.fn();
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        await expect(copyText('')).rejects.toThrow('복사할 내용이 없습니다');
        expect(writeText).not.toHaveBeenCalled();
    });
});
