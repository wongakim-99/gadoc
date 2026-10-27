'use client';
import { useEffect, useRef, useState } from 'react';
import { databaseApi } from '@/lib/api-client';
import type { DatabaseView } from './types';

export function viewFingerprint(view: DatabaseView): string {
    return JSON.stringify({
        name: view.name,
        layout: view.layout,
        query: view.query,
        status: view.status,
        owner: view.owner,
        sort: view.sort,
        dataSourceId: view.dataSourceId ?? '',
        dateProperty: view.dateProperty ?? '',
        endProperty: view.endProperty ?? '',
        groupProperty: view.groupProperty ?? 'status',
        hiddenProperties: view.hiddenProperties ?? [],
        propertyOrder: view.propertyOrder ?? [],
        columnWidths: view.columnWidths ?? {},
        calculations: view.calculations ?? {},
        filter: view.filter ?? { conjunction: 'and', rules: [] },
        sorts: view.sorts ?? [],
    });
}
/** Saves a selected view after edits, with a stable baseline and no blind conflict retries. */
export function useSavedDatabaseView({
    teamId,
    databaseId,
    serverView,
    currentView,
    revision,
    enabled,
    onSaved,
    onError,
}: {
    teamId: string;
    databaseId?: string;
    serverView?: DatabaseView;
    currentView?: DatabaseView;
    revision: number;
    enabled: boolean;
    onSaved: () => Promise<void>;
    onError: (message: string) => void;
}) {
    const [saving, setSaving] = useState(false);
    const [version, setVersion] = useState(0);
    const state = useRef<{ key: string; baseline: string; failed?: string } | null>(null);
    const inFlight = useRef(false);
    const latest = useRef({ onSaved, onError });
    latest.current = { onSaved, onError };
    const key = `${teamId}:${databaseId}:${serverView?.id}`;
    const server = serverView ? viewFingerprint(serverView) : '';
    const current = currentView ? viewFingerprint(currentView) : '';
    if (state.current?.key !== key) state.current = { key, baseline: server };
    const dirty = enabled && !!current && current !== state.current.baseline;
    useEffect(() => {
        if (!enabled || !databaseId || !currentView || !dirty || inFlight.current || state.current?.failed === current)
            return;
        const timer = setTimeout(() => {
            const snapshot = state.current!;
            if (snapshot.baseline !== server) {
                snapshot.failed = current;
                latest.current.onError(
                    '다른 사용자가 이 보기를 변경했습니다. 새로고침 전에 현재 설정을 별도 보기로 저장하세요.',
                );
                return;
            }
            inFlight.current = true;
            setSaving(true);
            const { id: viewId, ...config } = currentView;
            void databaseApi
                .updateView(teamId, databaseId, viewId, { ...config, revision })
                .then(async () => {
                    snapshot.baseline = current;
                    snapshot.failed = undefined;
                    await latest.current.onSaved();
                })
                .catch((error) => {
                    snapshot.failed = current;
                    latest.current.onError(error instanceof Error ? error.message : '보기 설정을 저장하지 못했습니다.');
                })
                .finally(() => {
                    inFlight.current = false;
                    setSaving(false);
                    setVersion((value) => value + 1);
                });
        }, 450);
        return () => clearTimeout(timer);
    }, [key, server, current, revision, enabled, dirty, version, teamId, databaseId]);
    return {
        saving,
        dirty,
        failed: !!state.current.failed,
        rebase: () => {
            if (inFlight.current) return;
            state.current = { key, baseline: server };
            setVersion((value) => value + 1);
        },
    };
}
