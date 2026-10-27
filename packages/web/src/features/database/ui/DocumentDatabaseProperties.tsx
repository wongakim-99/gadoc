'use client';
import { useDatabaseUpdates } from '../model/useDatabaseUpdates';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ApiError, databaseApi } from '@/lib/api-client';
import type { TeamMemberSummary } from '@/src/entities/team/types';
import { DatabaseCell } from './DatabaseCell';
import type { DatabaseDetail } from '../model/types';

export function DocumentDatabaseProperties({
    teamId,
    documentId,
    members,
}: {
    teamId: string;
    documentId: string;
    members: TeamMemberSummary[];
}) {
    const [items, setItems] = useState<DatabaseDetail[]>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const saving = useRef(false);
    const load = useCallback(async () => {
        let result;
        try {
            result = await databaseApi.memberships(teamId, documentId);
        } catch (error) {
            if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
                setItems([]);
                setError(error.message);
            }
            throw error;
        }
        if (!result.success) throw new Error('속성을 불러오지 못했습니다.');
        setItems(result.data ?? []);
    }, [teamId, documentId]);
    useEffect(() => {
        let active = true;
        void databaseApi
            .memberships(teamId, documentId)
            .then((result) => {
                if (active) setItems(result.data ?? []);
            })
            .catch((caught) => {
                if (active) setError(caught instanceof Error ? caught.message : '속성 오류');
            });
        return () => {
            active = false;
        };
    }, [teamId, documentId]);
    useDatabaseUpdates(teamId, null, load);
    if (!items.length && !error) return null;
    return (
        <section
            aria-label="데이터베이스 속성"
            className="my-4 space-y-3 rounded-control border border-border-primary p-3"
        >
            {items.map((db) => {
                const row = db.rows[0];
                if (!row) return null;
                return (
                    <div key={db.id}>
                        <Link
                            href={`/${teamId}/docs?database=${db.id}`}
                            className="text-xs font-medium text-action-text hover:underline"
                        >
                            {db.name}의 속성
                        </Link>
                        <div className="mt-2 space-y-1">
                            {db.properties.map((prop) => (
                                <div
                                    key={prop.id}
                                    className="grid grid-cols-[100px_minmax(0,1fr)] items-start gap-3 text-sm"
                                >
                                    <span className="py-2 text-xs text-text-secondary">{prop.name}</span>
                                    <DatabaseCell
                                        teamId={teamId}
                                        databaseId={db.id}
                                        row={row}
                                        property={prop}
                                        members={members}
                                        disabled={busy || !row.canEdit}
                                        readOnly={!row.canEdit}
                                        onSave={async (value, revision) => {
                                            if (saving.current) return false;
                                            saving.current = true;
                                            setBusy(true);
                                            setError('');
                                            setNotice('');
                                            try {
                                                await databaseApi.updateCell(
                                                    teamId,
                                                    db.id,
                                                    documentId,
                                                    prop.id,
                                                    value,
                                                    revision ?? row.revision,
                                                    row.relationRevisions?.[prop.id],
                                                );
                                                await load();
                                                setNotice('속성을 저장했습니다.');
                                                return true;
                                            } catch (caught) {
                                                setError(
                                                    caught instanceof Error
                                                        ? caught.message
                                                        : '속성을 저장하지 못했습니다.',
                                                );
                                                return false;
                                            } finally {
                                                saving.current = false;
                                                setBusy(false);
                                            }
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
            {error && (
                <p role="alert" className="text-xs text-error">
                    {error}
                </p>
            )}
            {(busy || notice) && (
                <p role="status" className="text-xs text-text-secondary">
                    {busy ? '속성 저장 중…' : notice}
                </p>
            )}
            <button
                type="button"
                disabled={busy}
                onClick={() => void load().catch((caught) => setError(String(caught)))}
                className="text-xs text-text-tertiary hover:text-text-primary"
            >
                속성 새로고침
            </button>
        </section>
    );
}
