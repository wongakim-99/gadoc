import type { DatabaseProperty, DatabaseRow } from './types';
import type { TeamMemberSummary } from '@/src/entities/team/types';
const escape = (value: unknown) => {
    let text = value == null ? '' : String(value);
    // Spreadsheet applications must not execute text cells as formulas.
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
export function databaseCsv(rows: DatabaseRow[], properties: DatabaseProperty[], members: TeamMemberSummary[]): string {
    const columns: DatabaseProperty[] = properties.some((property) => property.id === 'title')
        ? properties : [{ id: 'title', name: '이름', type: 'text' }, ...properties];
    const header = columns.map((property) => property.name);
    const body = rows.map((row) => [
        ...columns.map((property) => {
            if (property.id === 'title') return row.title;
            const value = row.values[property.id];
            if (property.type === 'relation')
                return (row.relations[property.id] ?? []).map((item) => item.title).join(', ');
            if (['person', 'created_by', 'last_edited_by'].includes(property.type))
                return (Array.isArray(value) ? value : [])
                    .map((id) => members.find((member) => member.userId === id)?.user?.username ?? '이전 멤버')
                    .join(', ');
            if (Array.isArray(value)) return value.join(', ');
            return value;
        }),
    ]);
    return '\uFEFF' + [header, ...body].map((row) => row.map(escape).join(',')).join('\r\n');
}
