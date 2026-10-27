import { DocumentSaveQueue, type DocumentDraft } from './DocumentSaveQueue';
import { vi } from 'vitest';

const initial = { title: '제목', content: '원본' };
function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

describe('DocumentSaveQueue', () => {
    it('accepts remote titles only while the local title is clean', async () => {
        const queue = new DocumentSaveQueue(initial, vi.fn(), vi.fn());
        expect(queue.receiveTitle('동료 제목')).toBe(true);
        expect(queue.dirty).toBe(false);
        queue.update({ ...initial, title: '내 초안' });
        expect(queue.receiveTitle('다른 제목')).toBe(false);
        expect(queue.dirty).toBe(true);
        await queue.flush();
        expect(queue.receiveTitle('저장 후 동료 제목')).toBe(true);
    });
    it('does not save initialization or a reverted draft', async () => {
        const save = vi.fn();
        const queue = new DocumentSaveQueue(initial, save, vi.fn());
        await queue.flush();
        queue.update({ ...initial, content: '임시' });
        queue.update(initial);
        await queue.flush();
        expect(save).not.toHaveBeenCalled();
    });
    it('serializes slow requests and sends the newest edit after acknowledgement', async () => {
        const first = deferred();
        const writes: DocumentDraft[] = [];
        const save = vi.fn(async (draft: DocumentDraft) => {
            writes.push(draft);
            if (writes.length === 1) await first.promise;
        });
        const queue = new DocumentSaveQueue(initial, save, vi.fn());
        queue.update({ ...initial, content: 'A' });
        const pending = queue.flush();
        queue.update({ ...initial, content: 'B' });
        queue.update({ ...initial, content: 'C' });
        expect(queue.flush()).toBe(pending);
        expect(save).toHaveBeenCalledTimes(1);
        first.resolve();
        expect(await pending).toBe(true);
        expect(writes.map((w) => w.content)).toEqual(['A', 'C']);
        expect(queue.dirty).toBe(false);
    });
    it('retains a failed draft and retries it without accepting a failed response', async () => {
        const save = vi.fn().mockRejectedValueOnce(new Error('연결 끊김')).mockResolvedValue(undefined);
        const notify = vi.fn();
        const queue = new DocumentSaveQueue(initial, save, notify);
        queue.update({ ...initial, title: '새 제목' });
        expect(await queue.flush()).toBe(false);
        expect(queue.dirty).toBe(true);
        expect(notify).toHaveBeenLastCalledWith('error', '연결 끊김');
        expect(await queue.flush()).toBe(true);
        expect(queue.dirty).toBe(false);
    });
    it('defers IME composition, including edits during an in-flight save', async () => {
        const first = deferred();
        const save = vi
            .fn()
            .mockImplementationOnce(() => first.promise)
            .mockResolvedValue(undefined);
        const queue = new DocumentSaveQueue(initial, save, vi.fn());
        queue.update({ ...initial, content: 'A' });
        const pending = queue.flush();
        queue.pause(true);
        queue.update({ ...initial, content: 'ㅎ' });
        first.resolve();
        expect(await pending).toBe(false);
        expect(save).toHaveBeenCalledTimes(1);
        queue.update({ ...initial, content: '한글' });
        queue.pause(false);
        await queue.flush();
        expect(save).toHaveBeenLastCalledWith({ ...initial, content: '한글' });
    });
});
