'use client';

import { Avatar } from '../../../shared/ui/Avatar';
import { useUserIdentity } from '../model/profile.store';

export function UserAvatar({
    userId,
    name = '',
    url,
    ...props
}: {
    userId: string;
    name?: string;
    url?: string | null;
    size?: number;
    className?: string;
    label?: string;
}) {
    const identity = useUserIdentity(userId, name);
    return (
        <Avatar
            {...props}
            userId={userId}
            name={identity.username || name}
            url={identity.profileUpdatedAt ? identity.avatarUrl : (identity.avatarUrl ?? url)}
        />
    );
}
