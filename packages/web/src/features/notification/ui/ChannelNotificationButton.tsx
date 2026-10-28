'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { PopoverMenu } from '@/src/shared/ui/PopoverMenu';
import { NotificationPreferenceEditor } from './NotificationPreferenceEditor';

export function ChannelNotificationButton({ teamId, channelId }: { teamId: string; channelId: string }) {
    const [open, setOpen] = useState(false);
    return (
        <PopoverMenu
            label="이 채팅방 알림 설정"
            open={open}
            onOpenChange={setOpen}
            width={360}
            icon={<Bell size={16} />}
            triggerClassName="rounded-control border border-border-primary p-2 text-text-secondary hover:bg-bg-hover"
        >
            <p className="mb-4 text-xs leading-5 text-text-secondary">
                나에게만 적용되는 이 방의 데스크톱 알림입니다. 알림센터 보관과 읽음 상태는 유지됩니다.
            </p>
            {open && (
                <NotificationPreferenceEditor key={`${teamId}:${channelId}`} teamId={teamId} channelId={channelId} />
            )}
        </PopoverMenu>
    );
}
