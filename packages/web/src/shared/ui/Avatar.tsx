'use client';

import { useState } from 'react';
import { getAvatarColor } from '../lib/avatar';
import { avatarImageUrl } from '../lib/avatar-image';

export function Avatar({
    userId,
    name,
    url,
    size = 36,
    className = '',
    label,
}: {
    userId: string;
    name: string;
    url?: string | null;
    size?: number;
    className?: string;
    label?: string;
}) {
    const [failed, setFailed] = useState<string | null>(null);
    const src = avatarImageUrl(url);
    return (
        <span
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
            data-avatar-user={userId}
            className={`inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-white ${className}`}
            style={{ width: size, height: size, backgroundColor: getAvatarColor(userId) }}
        >
            {src && src !== failed ? (
                <img key={src} src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(src)} />
            ) : (
                name.trim().slice(0, 1).toUpperCase() || '?'
            )}
        </span>
    );
}
