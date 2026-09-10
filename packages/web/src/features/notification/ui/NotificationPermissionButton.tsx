'use client';

import { useEffect, useState } from 'react';

export function NotificationPermissionButton() {
    const [mode, setMode] = useState<'desktop' | NotificationPermission | null>(null);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState('');
    useEffect(() => {
        if (window.slacordDesktop?.isDesktop) setMode('desktop');
        else if ('Notification' in window) setMode(Notification.permission);
    }, []);
    if (!mode) return null;
    const enable = async () => {
        setBusy(true);
        setFeedback('');
        try {
            if (mode === 'desktop') {
                const shown = await window.slacordDesktop?.notify(
                    'Slacord 알림 테스트',
                    '메시지와 멘션 알림을 이곳에서 받을 수 있습니다.',
                );
                setFeedback(
                    shown
                        ? '테스트 알림을 보냈습니다. 보이지 않으면 시스템 알림 설정을 확인해주세요.'
                        : '시스템 설정에서 Slacord 알림을 허용해주세요.',
                );
            } else {
                const permission = await Notification.requestPermission();
                setMode(permission);
                setFeedback(
                    permission === 'granted'
                        ? '브라우저 알림이 켜졌습니다.'
                        : '브라우저 사이트 설정에서 알림을 허용해주세요.',
                );
            }
        } catch {
            setFeedback('알림을 설정하지 못했습니다. 다시 시도해주세요.');
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="border-b border-border-primary px-4 py-3 text-xs text-text-tertiary">
            {mode === 'granted' ? (
                <span>브라우저 알림 켜짐</span>
            ) : (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => void enable()}
                    className="text-brand-200 hover:text-white disabled:opacity-50"
                >
                    {busy ? '확인 중…' : mode === 'desktop' ? '시스템 알림 테스트' : '브라우저 알림 켜기'}
                </button>
            )}
            {feedback && (
                <p role="status" className="mt-2 leading-5">
                    {feedback}
                </p>
            )}
        </div>
    );
}
