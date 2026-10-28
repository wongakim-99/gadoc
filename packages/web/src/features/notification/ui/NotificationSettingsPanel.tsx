'use client';

import { useState } from 'react';
import { useTeamWorkspaceData } from '@/src/features/team/model/useTeamWorkspaceData';
import { resolveChannelLabel } from '@/src/entities/channel/lib/resolveChannelLabel';
import { NotificationPreferenceEditor } from './NotificationPreferenceEditor';
import { NotificationPermissionButton } from './NotificationPermissionButton';
import type { NotificationPreference } from '@/src/entities/notification/types';

export function NotificationSettingsPanel({ teamId }: { teamId: string }) {
    const workspace = useTeamWorkspaceData(teamId);
    const [channelId, setChannelId] = useState('');
    const [syncedValue, setSyncedValue] = useState<NotificationPreference | null>(null);
    const channels = workspace.channels.filter((channel) => !channel.isArchived);
    return (
        <div className="space-y-6">
            <section className="rounded-panel border border-border-primary bg-bg-secondary p-5">
                <h2 className="text-base font-bold">{workspace.team?.name || '워크스페이스'}의 내 데스크톱 알림</h2>
                <p className="mb-4 mt-2 text-sm leading-6 text-text-secondary">
                    이 계정과 이 워크스페이스에만 적용됩니다. 다른 워크스페이스나 다른 멤버의 설정은 바뀌지 않습니다.
                    알림센터의 보관·읽음·삭제와 데스크톱 표시 설정은 별개입니다. 여기에서 꺼도 알림센터 기록과 미읽음은
                    유지됩니다.
                </p>
                <NotificationPreferenceEditor
                    key={teamId}
                    teamId={teamId}
                    syncedValue={syncedValue}
                    onSaved={setSyncedValue}
                />
            </section>
            <section className="rounded-panel border border-border-primary bg-bg-secondary p-5">
                <h2 className="text-base font-bold">채팅방별 예외</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                    방별 방식과 종류별 예외가 기본 설정보다 우선합니다. 각 종류를 기본 설정으로 되돌리거나 방의 모든
                    예외를 초기화할 수 있습니다. 멘션·내 관련 활동은 직접 멘션, DM·소그룹, 내 메시지의 답글과 내
                    문서·이슈 할당을 포함합니다.
                </p>
                <select
                    aria-label="알림을 설정할 채팅방"
                    value={channelId}
                    onChange={(event) => setChannelId(event.target.value)}
                    className="my-4 w-full rounded-control border border-border-primary bg-bg-primary px-3 py-2 text-sm"
                >
                    <option value="">채팅방 선택</option>
                    {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                            {resolveChannelLabel(channel, workspace.members, workspace.currentUserId)}
                        </option>
                    ))}
                </select>
                {channels.some((channel) => channel.id === channelId) && (
                    <NotificationPreferenceEditor
                        key={`${teamId}:${channelId}`}
                        teamId={teamId}
                        channelId={channelId}
                        syncedValue={syncedValue}
                        onSaved={setSyncedValue}
                    />
                )}
                <p className="mt-4 text-xs leading-5 text-text-secondary">
                    알림을 꺼도 메시지·미읽음·알림센터 기록은 삭제되지 않습니다. 앱과 브라우저 모두 저장된 정책을
                    따릅니다.
                </p>
            </section>
            <section className="rounded-panel border border-border-primary bg-bg-secondary p-5">
                <h2 className="text-base font-bold">이 기기의 알림 권한</h2>
                <p className="mt-2 text-sm text-text-secondary">
                    브라우저·운영체제의 공통 권한입니다. 위의 워크스페이스별 수신 정책과 별개입니다.
                </p>
                <NotificationPermissionButton />
            </section>
        </div>
    );
}
