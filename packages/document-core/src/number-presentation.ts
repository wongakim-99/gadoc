import type { OptionColor } from './option-color';
export interface NumberPresentation {
    display: 'number' | 'bar' | 'ring';
    divideBy: number;
    color: OptionColor;
    showNumber: boolean;
}
/** Clamp the picture, never the stored value. Empty/non-finite values have no progress. */
export function numberProgress(value: unknown, divideBy: number): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isFinite(divideBy) || divideBy <= 0) return null;
    return Math.max(0, Math.min(1, value / divideBy));
}
