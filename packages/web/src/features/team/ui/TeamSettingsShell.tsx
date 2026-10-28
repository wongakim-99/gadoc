'use client';
import { useSearchParams } from 'next/navigation';
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
import { activeSettingsSection } from '../model/settingsSections';
import './settings.css';

export function TeamSettingsShell({ teamId }: { teamId: string }) {
    const params = useSearchParams();
    const workspace = useTeamWorkspaceData(teamId, { includeSettings: true });
    const active = activeSettingsSection(params.get('section'));
    const role = ({ owner: '소유자', admin: '관리자', member: '멤버', guest: '게스트' } as Record<string, string>)[workspace.currentMember?.role ?? ''] ?? '확인 중';
    return <div className="settings-layout">
        <main className="settings-main" aria-label={`${active.label} 설정`}>
            <header className="settings-heading"><p className="text-xs text-text-tertiary">{active.group}</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">{active.label}</h1><p className="mt-2 text-sm leading-6 text-text-secondary">{active.description}</p></header>
            {workspace.isInitialLoading && <p role="status" className="py-4 text-sm text-text-secondary">설정을 불러오는 중…</p>}
            {workspace.error && <p role="alert" className="mb-5 rounded-lg border border-border-primary p-4 text-sm text-error">{workspace.error}</p>}
            <div className="settings-content">
                {active.key === 'account' && <section className="settings-account">
                    <div className="settings-account-cover" />
                    <div className="px-6 pb-6"><span className="settings-account-avatar">{workspace.currentUsername.slice(0, 1) || '?'}</span><h2 className="mt-3 text-xl font-bold text-text-primary">{workspace.currentUsername || '사용자'}</h2>
                        <dl className="mt-6 divide-y divide-border-primary rounded-lg bg-bg-primary px-4"><div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-sm text-text-secondary">표시 이름</dt><dd className="break-all text-sm text-text-primary">{workspace.currentUsername}</dd></div><div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-sm text-text-secondary">워크스페이스</dt><dd className="text-sm text-text-primary">{workspace.team?.name}</dd></div><div className="flex justify-between gap-2 py-4"><dt className="text-sm text-text-secondary">역할</dt><dd className="text-sm text-text-primary">{role}</dd></div></dl>
                        <div className="mx-0 mt-4 rounded-lg border border-border-primary bg-bg-primary p-4"><p className="text-xs text-text-secondary">로그인 이메일</p><p className="mt-1 break-all text-sm text-text-primary" aria-label="로그인 이메일">{workspace.me?.email || '계정 확인 중'}</p><p className="mt-2 text-xs text-text-tertiary">본인에게만 표시되며, 다른 멤버에게 공개되는 프로필 정보와 구분됩니다.</p></div>
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
