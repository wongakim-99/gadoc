'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export function refreshRelatedWork() {
    window.dispatchEvent(new CustomEvent('slacord:issues-refresh'));
}

/** Lazy panels use one request per open panel, not one request per message. */
export function useRelatedWork<T>(load: () => Promise<T[]>) {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const generation = useRef(0);
    const refresh = useCallback(async () => {
        const id = ++generation.current;
        try {
            const result = await load();
            if (id === generation.current) {
                setItems(result);
                setError('');
            }
        } catch {
            if (id === generation.current) {
                setItems([]);
                setError('연결 정보를 불러오지 못했습니다.');
            }
        } finally {
            if (id === generation.current) setLoading(false);
        }
    }, [load]);
    useEffect(() => {
        setItems([]);
        setLoading(true);
        void refresh();
        const update = () => {
            if (document.visibilityState === 'visible') void refresh();
        };
        window.addEventListener('slacord:issues-refresh', update);
        window.addEventListener('slacord:documents-refresh', update);
        window.addEventListener('focus', update);
        document.addEventListener('visibilitychange', update);
        const timer = window.setInterval(update, 30000);
        return () => {
            generation.current++;
            clearInterval(timer);
            window.removeEventListener('slacord:issues-refresh', update);
            window.removeEventListener('slacord:documents-refresh', update);
            window.removeEventListener('focus', update);
            document.removeEventListener('visibilitychange', update);
        };
    }, [refresh]);
    return { items, loading, error, refresh };
}
