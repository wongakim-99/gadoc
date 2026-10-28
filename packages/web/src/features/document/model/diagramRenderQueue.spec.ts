import { afterEach, expect, it, vi } from 'vitest';
import { createDiagramRenderQueue, DiagramRenderTimeout } from './diagramRenderQueue';
afterEach(() => vi.useRealTimers());
it('expires a hung render, ignores its late result, and releases subsequent jobs', async () => {
    vi.useFakeTimers();
    const schedule = createDiagramRenderQueue(50);
    let finish!: (value: string) => void;
    let isActive!: () => boolean;
    const first = schedule((active) => {
        isActive = active;
        return new Promise<string>((resolve) => {
            finish = resolve;
        });
    });
    const rejected = expect(first).rejects.toBeInstanceOf(DiagramRenderTimeout);
    await vi.advanceTimersByTimeAsync(51);
    await rejected;
    expect(isActive()).toBe(false);
    await expect(schedule(async () => 'fresh')).resolves.toBe('fresh');
    finish('obsolete');
    await vi.runAllTimersAsync();
    expect(vi.getTimerCount()).toBe(0);
});
it('serializes normal renders and recovers from parse errors without leaking deadlines', async () => {
    vi.useFakeTimers();
    const schedule = createDiagramRenderQueue(50);
    const order: number[] = [];
    const first = schedule(async () => {
        order.push(1);
        throw new Error('syntax');
    });
    const rejected = expect(first).rejects.toThrow('syntax');
    const next = schedule(async () => {
        order.push(2);
        return 'valid';
    });
    await rejected;
    await expect(next).resolves.toBe('valid');
    expect(order).toEqual([1, 2]);
    expect(vi.getTimerCount()).toBe(0);
});
