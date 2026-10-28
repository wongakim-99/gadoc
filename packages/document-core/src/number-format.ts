export const NUMBER_FORMATS = ['number', 'comma', 'percent', 'KRW', 'USD', 'EUR', 'JPY', 'GBP', 'CNY'] as const;
export type NumberFormat = typeof NUMBER_FORMATS[number];

/** Presentation only: filters, formulas and exports retain the stored number. */
export function formatDatabaseNumber(value: number, format: NumberFormat = 'number'): string {
    if (!Number.isFinite(value)) return '';
    if (format === 'number') return String(value);
    if (format === 'comma') return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 20 }).format(value);
    if (format === 'percent') return new Intl.NumberFormat('ko-KR', { style: 'percent', maximumFractionDigits: 10 }).format(value);
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: format, maximumFractionDigits: 10 }).format(value);
}
