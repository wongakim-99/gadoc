import { describe, expect, it } from 'vitest';
import { readInlineDatabaseViews } from './inlineDatabaseViews';

const state = (settings: Record<string, unknown>) => JSON.stringify({
    version: 1, activeId: 'board', hiddenProperties: [], views: [
        { id: 'board', name: 'Board', layout: 'board', query: '', status: '', owner: '', sort: 'manual', ...settings },
        { id: 'table', name: 'Table', layout: 'table', query: '', status: '', owner: '', sort: 'manual' },
    ],
});
describe('board presentation in inline views', () => {
    it('preserves board settings without applying them to another view', () => {
        const result = readInlineDatabaseViews(state({ hideEmptyGroups: true, cardSize: 'small' }));
        expect(result.views[0]).toMatchObject({ hideEmptyGroups: true, cardSize: 'small' });
        expect(result.views[1]).toMatchObject({ hideEmptyGroups: false, cardSize: 'medium' });
    });
    it('does not interpret malformed persisted values as enabled settings', () => {
        const result = readInlineDatabaseViews(state({ hideEmptyGroups: 'false', cardSize: 'huge' }));
        expect(result.views[0]).toMatchObject({ hideEmptyGroups: false, cardSize: 'medium' });
    });
});