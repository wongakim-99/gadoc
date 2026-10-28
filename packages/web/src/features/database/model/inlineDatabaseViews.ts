import type { DatabaseView } from './types';

export interface InlineDatabaseViews {
    version: 1;
    activeId: string;
    views: DatabaseView[];
    hiddenProperties: string[];
}

export function readInlineDatabaseViews(value: string): InlineDatabaseViews {
    const fallback: InlineDatabaseViews = {
        version: 1,
        activeId: 'default',
        views: [{ id: 'default', name: '표', layout: 'table', query: '', status: '', owner: '', sort: 'manual' }],
        hiddenProperties: [],
    };
    try {
        const parsed = JSON.parse(value) as InlineDatabaseViews;
        if (parsed.version !== 1 || !Array.isArray(parsed.views) || !parsed.views.length || parsed.views.length > 50)
            return fallback;
        if (
            !parsed.views.every(
                (view) =>
                    view &&
                    typeof view.id === 'string' &&
                    typeof view.name === 'string' &&
                    ['table', 'board', 'list', 'gallery', 'calendar', 'timeline', 'chart'].includes(view.layout) &&
                    ['manual', 'title', 'title-desc', 'reviewDate'].includes(view.sort) &&
                    ['query', 'status', 'owner'].every((key) => typeof view[key as keyof DatabaseView] === 'string'),
            )
        )
            return fallback;
        if (new Set(parsed.views.map((view) => view.id)).size !== parsed.views.length) return fallback;
        return {
            ...parsed,
            views: parsed.views.map((view) => ({
                ...view,
                statusGrouping: view.statusGrouping === 'group' ? 'group' : 'option',
                propertyOrder: Array.isArray(view.propertyOrder) ? [...new Set(view.propertyOrder.filter(id=>typeof id==='string'))].slice(0,500) : [],
                columnWidths: view.columnWidths && typeof view.columnWidths === 'object' && !Array.isArray(view.columnWidths)
                    ? Object.fromEntries(Object.entries(view.columnWidths).filter(([,width])=>Number.isInteger(width)&&width>=120&&width<=800).slice(0,501)) : {},
                hiddenProperties: Array.isArray(view.hiddenProperties)
                    ? view.hiddenProperties.filter((id) => typeof id === 'string')
                    : Array.isArray(parsed.hiddenProperties)
                      ? parsed.hiddenProperties.filter((id) => typeof id === 'string')
                      : [],
            })),
            activeId: parsed.views.some((view) => view.id === parsed.activeId) ? parsed.activeId : parsed.views[0].id,
            hiddenProperties: Array.isArray(parsed.hiddenProperties)
                ? parsed.hiddenProperties.filter((id) => typeof id === 'string')
                : [],
        };
    } catch {
        return fallback;
    }
}
