'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { UserRound, Palette, Bell, UsersRound, Plug, Bot, Import, History, ChevronRight } from 'lucide-react';
import { ConfluenceImportPanel } from '@/src/features/document/ui/ConfluenceImportPanel';
import { ThemePreference } from '@/src/features/appearance/ThemePreference';
import { NotificationPermissionButton } from '@/src/features/notification/ui/NotificationPermissionButton';
import { useTeamWorkspaceData } from '../model/useTeamWorkspaceData';
import { DiscordImportPanel } from './DiscordImportPanel';
import { ExternalBridgeSettingsPanel } from './ExternalBridgeSettingsPanel';
import { GitHubSettingsSection } from './GitHubSettingsSection';
import { TeamAuditLogPanel } from './TeamAuditLogPanel';
import { TeamInviteSettingsPanel } from './TeamInviteSettingsPanel';
import { McpSettingsPanel } from './McpSettingsPanel';
import './settings.css';

const SECTIONS = [
    { key: 'account', group: '개인 설정', label: '내 계정', icon: UserRound, description: '로그인한 계정과 워크스페이스 역할을 확인합니다.' },
    { key: 'appearance', group: '개인 설정', label: '화면과 테마', icon: Palette, description: '편안하게 작업할 수 있는 화면을 선택하세요.' },
    { key: 'notifications', group: '개인 설정', label: '알림', icon: Bell, description: '이 기기에서 알림을 받을 방법을 설정합니다.' },
    { key: 'access', group: '워크스페이스', label: '초대와 권한', icon: UsersRound, description: '멤버, 역할과 초대 링크를 관리합니다.' },
    { key: 'delivery', group: '워크스페이스', label: '전달과 연동', icon: Plug, description: 'GitHub, Slack, Discord를 워크스페이스에 연결합니다.' },
    { key: 'ai', group: '워크스페이스', label: 'AI 연결', icon: Bot, description: 'AI 도구 연결과 접근 권한을 관리합니다.' },
    { key: 'imports', group: '워크스페이스', label: '가져오기와 마이그레이션', icon: Import, description: '기존 문서와 대화 기록을 가져옵니다.' },
    { key: 'operations', group: '워크스페이스', label: '운영 이력', icon: History, description: '워크스페이스의 변경 기록을 확인합니다.' },
] as const;
type SectionKey = typeof SECTIONS[number]['key'];

export function TeamSettingsShell({ teamId }: { teamId: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const params = useSearchParams();
    const workspace = useTeamWorkspaceData(teamId, { includeSettings: true });
    const active = SECTIONS.find((section) => section.key === params.get('section')) ?? SECTIONS[4];
    const select = (key: SectionKey) => {
        const next = new URLSearchParams(params.toString());
        if (key === 'delivery') next.delete('section'); else next.set('section', key);
        router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    };
    const role = ({ owner: '소유자', admin: '관리자', member: '멤버', guest: '게스트' } as Record<string, string>)[workspace.currentMember?.role ?? ''] ?? '확인 중';
    return <div className="settings-layout">
        <aside className="settings-navigation">
            <div className="settings-workspace"><span className="settings-workspace-icon">{workspace.team?.name?.slice(0, 1) || 'G'}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-text-primary">{workspace.team?.name || '워크스페이스'}</p><p className="mt-0.5 text-xs text-text-tertiary">설정</p></div></div>
            <nav aria-label="설정 섹션" className="settings-nav-groups">
                {(['개인 설정', '워크스페이스'] as const).map((group) => <div key={group} className="settings-nav-group">
                    <p className="settings-group-label">{group}</p>
                    {SECTIONS.filter((section) => section.group === group).map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-pressed={active.key === key} onClick={() => select(key)} className="settings-nav-item"><Icon size={17} className="shrink-0" /><span>{label}</span>{active.key === key && <ChevronRight size={13} className="ml-auto shrink-0" />}</button>)}
                </div>)}
            </nav>
            <div className="settings-role"><span className="h-2 w-2 rounded-full bg-action" />{role}</div>
        </aside>
        <main className="settings-main" aria-label={`${active.label} 설정`}>
            <header className="settings-heading"><p className="text-xs text-text-tertiary">{active.group}</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">{active.label}</h1><p className="mt-2 text-sm leading-6 text-text-secondary">{active.description}</p></header>
            {workspace.isInitialLoading && <p role="status" className="py-4 text-sm text-text-secondary">설정을 불러오는 중…</p>}
            {workspace.error && <p role="alert" className="mb-5 rounded-lg border border-border-primary p-4 text-sm text-error">{workspace.error}</p>}
            <div className="settings-content">
                {active.key === 'account' && <section className="settings-account">
                    <div className="settings-account-cover" />
                    <div className="px-6 pb-6"><span className="settings-account-avatar">{workspace.currentUsername.slice(0, 1) || '?'}</span><h2 className="mt-3 text-xl font-bold text-text-primary">{workspace.currentUsername || '사용자'}</h2>
                        <dl className="mt-6 divide-y divide-border-primary rounded-lg bg-bg-primary px-4"><div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-sm text-text-secondary">표시 이름</dt><dd className="break-all text-sm text-text-primary">{workspace.currentUsername}</dd></div><div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-sm text-text-secondary">워크스페이스</dt><dd className="text-sm text-text-primary">{workspace.team?.name}</dd></div><div className="flex justify-between gap-2 py-4"><dt className="text-sm text-text-secondary">역할</dt><dd className="text-sm text-text-primary">{role}</dd></div></dl>
                    </div>
                </section>}
                {active.key === 'appearance' && <section><h2 className="text-base font-bold text-text-primary">테마</h2><p className="mb-5 mt-1 text-sm text-text-secondary">이 기기의 모든 워크스페이스에 적용됩니다.</p><ThemePreference variant="cards" /></section>}
                {active.key === 'notifications' && <section className="rounded-xl border border-border-primary bg-bg-secondary p-5"><h2 className="mb-3 text-base font-bold text-text-primary">데스크톱 알림</h2><NotificationPermissionButton /></section>}
                {active.key === 'delivery' && <><GitHubSettingsSection teamId={teamId} /><ExternalBridgeSettingsPanel teamId={teamId} /></>}
                {active.key === 'access' && <TeamInviteSettingsPanel teamId={teamId} />}
                {active.key === 'ai' && <McpSettingsPanel key={teamId} teamId={teamId} canWrite={workspace.canWrite} />}
                {active.key === 'imports' && <><ConfluenceImportPanel teamId={teamId} onImported={async () => {}} /><DiscordImportPanel teamId={teamId} onImported={workspace.refreshBase} /></>}
                {active.key === 'operations' && <TeamAuditLogPanel teamId={teamId} />}
            </div>
        </main>
    </div>;
}
