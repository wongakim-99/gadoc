export const OPTION_COLORS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const;
export type OptionColor = typeof OPTION_COLORS[number];
export interface OptionColorSetting { name: string; color: OptionColor }
