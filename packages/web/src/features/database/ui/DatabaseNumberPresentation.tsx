import { formatDatabaseNumber, numberProgress } from '@slacord/document-core';
import type { DatabaseProperty } from '../model/types';
import { optionColorValue } from './DatabaseOptionTag';

export function DatabaseNumberPresentation({ value, property, label }: { value: number; property: DatabaseProperty; label: string }) {
    const settings = property.numberPresentation;
    const progress = numberProgress(value, settings?.divideBy ?? 100);
    const formatted = formatDatabaseNumber(value, property.numberFormat);
    if (!settings || settings.display === 'number' || progress === null) return <span className="tabular-nums">{formatted}</span>;
    const color = optionColorValue(settings.color);
    return <span className="flex min-w-0 items-center gap-2" role="progressbar" aria-label={`${label} 진행률`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 10000) / 100}
        aria-valuetext={`${formatted} / ${settings.divideBy}`}>
        {settings.display === 'ring' ? <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0" aria-hidden="true">
            <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="3" className="text-border-primary" />
            <circle cx="10" cy="10" r="7" fill="none" stroke={color} strokeWidth="3" pathLength="100"
                strokeDasharray={`${progress * 100} 100`} transform="rotate(-90 10 10)" />
        </svg> : <span className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-border-primary" aria-hidden="true">
            <span className="block h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: color }} />
        </span>}
        {settings.showNumber && <span className="shrink-0 tabular-nums text-text-secondary">{formatted}</span>}
    </span>;
}
