'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { UserRound, Palette, Bell, UsersRound, Plug, Bot, Import, History } from 'lucide-react';
import { SETTINGS_SECTIONS, activeSettingsSection } from '../model/settingsSections';

const icons = {
    account: UserRound,
    appearance: Palette,
    notifications: Bell,
    access: UsersRound,
    delivery: Plug,
    ai: Bot,
    imports: Import,
    operations: History,
};

export function TeamSettingsNavigation() {
    const pathname = usePathname();
    const router = useRouter();
    const params = useSearchParams();
    const active = activeSettingsSection(params.get('section'));
    return (
        <div className="space-y-6">
            {(['개인 설정', '워크스페이스'] as const).map((group) => (
                <div key={group}>
                    <p className="mb-2 px-2 text-[11px] font-medium text-text-tertiary">{group}</p>
                    {SETTINGS_SECTIONS.filter((section) => section.group === group).map(({ key, label }) => {
                        const Icon = icons[key];
                        return (
                            <button
                                key={key}
                                type="button"
                                aria-pressed={active.key === key}
                                onClick={() => {
                                    const next = new URLSearchParams(params.toString());
                                    if (key === 'delivery') next.delete('section');
                                    else next.set('section', key);
                                    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
                                }}
                                className={`workspace-sidebar-row my-0.5 flex w-full items-center gap-2 text-left ${active.key === key ? 'bg-selection font-medium text-action-text' : 'text-text-secondary hover:bg-bg-hover'}`}
                            >
                                <Icon size={16} className="shrink-0" />
                                <span>{label}</span>
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
