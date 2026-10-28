'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

type Theme = 'dark' | 'light' | 'system';
const key = 'gadoc:theme';
const normalize = (value: unknown): Theme => value === 'light' || value === 'system' ? value : 'dark';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({ theme: 'dark', setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark');
    useEffect(() => {
        const media = matchMedia('(prefers-color-scheme: dark)');
        const read = () => { try { return normalize(localStorage.getItem(key)); } catch { return 'dark' as const; } };
        const apply = () => {
            const next = read();
            setThemeState(next);
            document.documentElement.dataset.theme = next === 'system' ? (media.matches ? 'dark' : 'light') : next;
        };
        const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) apply(); };
        apply();
        media.addEventListener('change', apply);
        window.addEventListener('storage', onStorage);
        window.addEventListener('gadoc:theme-change', apply);
        return () => {
            media.removeEventListener('change', apply);
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('gadoc:theme-change', apply);
        };
    }, []);
    const setTheme = (next: Theme) => {
        setThemeState(next);
        document.documentElement.dataset.theme = next === 'system'
            ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : next;
        try { localStorage.setItem(key, next); window.dispatchEvent(new Event('gadoc:theme-change')); } catch { /* Session-only theme when storage is unavailable. */ }
    };
    return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function ThemePreference({ variant = 'compact' }: { variant?: 'compact' | 'cards' }) {
    const { theme, setTheme } = useContext(ThemeContext);
    if (variant === 'cards') return <div role="group" aria-label="화면 테마" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {([{ value: 'light', label: '라이트', background: '#ffffff', sidebar: '#eef0f4', line: '#c4ccd8' }, { value: 'dark', label: '다크', background: '#181b20', sidebar: '#282e38', line: '#566174' }, { value: 'system', label: '시스템', background: 'linear-gradient(90deg,#ffffff 50%,#181b20 50%)', sidebar: '#758096', line: '#9aa6b8' }] as const).map(({ value, label, background, sidebar, line }) =>
            <button key={value} type="button" aria-label={`${label} 테마`} aria-pressed={theme === value} onClick={() => setTheme(value)} className={`overflow-hidden rounded-xl border-2 text-left transition-colors ${theme === value ? 'border-action' : 'border-border-primary hover:border-border-glow'}`}>
                <div aria-hidden="true" className="flex h-28 gap-3 p-3" style={{ background }}><div className="w-1/4 rounded" style={{ background: sidebar }} /><div className="flex-1 space-y-2 pt-2"><div className="h-2 w-3/4 rounded" style={{ background: line }} /><div className="h-2 w-full rounded opacity-50" style={{ background: line }} /><div className="h-2 w-2/3 rounded opacity-50" style={{ background: line }} /><div className="mt-4 h-5 w-12 rounded bg-action" /></div></div>
                <span className="flex items-center justify-between border-t border-border-primary bg-bg-secondary px-3 py-3 text-sm text-text-primary"><span>{label}</span><span aria-hidden="true" className={`flex h-4 w-4 items-center justify-center rounded-full border ${theme === value ? 'border-action bg-action' : 'border-border-glow'}`}>{theme === value && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span></span>
            </button>)}
    </div>;
    return <fieldset className="my-2 min-w-0 border-0 p-0">
        <legend className="mb-2 text-xs text-text-secondary">화면 테마</legend>
        <div className="flex gap-1 rounded-control border border-border-primary p-1">
            {([{ value: 'light', label: '라이트', Icon: Sun }, { value: 'dark', label: '다크', Icon: Moon }, { value: 'system', label: '시스템', Icon: Monitor }] as const).map(({ value, label, Icon }) =>
                <button key={value} type="button" aria-label={`${label} 테마`} aria-pressed={theme === value}
                    onClick={() => setTheme(value)} className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-control px-2 py-1.5 text-xs ${theme === value ? 'bg-selection text-action-text' : 'text-text-secondary hover:bg-bg-hover'}`}>
                    <Icon size={14} /><span>{label}</span>
                </button>)}
        </div>
    </fieldset>;
}
