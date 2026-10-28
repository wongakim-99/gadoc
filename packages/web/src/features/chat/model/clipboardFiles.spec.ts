import { describe, expect, it } from 'vitest';
import { clipboardFiles } from './clipboardFiles';

const file = { name: 'screenshot.png', type: 'image/png' } as File;
const data = (files: File[], items: unknown[]) =>
    ({ files, items }) as unknown as Pick<DataTransfer, 'files' | 'items'>;

describe('clipboardFiles', () => {
    it('takes the file list only once when items contain the same screenshot', () => {
        expect(clipboardFiles(data([file], [{ kind: 'file', getAsFile: () => file }]))).toEqual([file]);
    });
    it('supports screenshot items when the clipboard file list is empty', () => {
        expect(clipboardFiles(data([], [{ kind: 'string' }, { kind: 'file', getAsFile: () => file }]))).toEqual([file]);
    });
    it('leaves ordinary text and missing file items alone', () => {
        expect(clipboardFiles(data([], [{ kind: 'string' }, { kind: 'file', getAsFile: () => null }]))).toEqual([]);
        expect(clipboardFiles(null)).toEqual([]);
    });
});
