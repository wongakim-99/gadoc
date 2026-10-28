import type { CSSProperties, ReactNode } from 'react';
import type { OptionColor } from '@slacord/document-core';
import type { DatabaseProperty } from '../model/types';
export const OPTION_COLOR_LABELS: Record<OptionColor, string> = {
    default: '기본', gray: '회색', brown: '갈색', orange: '주황', yellow: '노랑',
    green: '초록', blue: '파랑', purple: '보라', pink: '분홍', red: '빨강',
};
const colors: Record<OptionColor, string> = {
    default: 'var(--text-tertiary, #888888)', gray: '#808080', brown: '#a87a55', orange: '#d97706',
    yellow: '#ca9a04', green: '#269867', blue: '#4285d4', purple: '#9564c4', pink: '#cb6398', red: '#dc5b5b',
};
export function optionColorStyle(property: Pick<DatabaseProperty, 'optionColors'>, name: string): CSSProperties {
    const color = property.optionColors?.find((item) => item.name === name)?.color ?? 'default';
    return { backgroundColor: `color-mix(in srgb, ${colors[color] ?? colors.default} 22%, transparent)` };
}
export function DatabaseOptionTag({ property, name, children }: { property: Pick<DatabaseProperty, 'optionColors'>; name: string; children?: ReactNode }) {
    return <span className="inline-block max-w-full truncate rounded px-1.5 py-0.5 text-xs text-text-primary" style={optionColorStyle(property, name)}>{children ?? name}</span>;
}
