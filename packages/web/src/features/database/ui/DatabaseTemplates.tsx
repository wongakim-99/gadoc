'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { databaseApi } from '@/lib/api-client';
import { useWorkspaceConnection, canLeaveWorkspacePane } from '@/src/features/workspace/model/useWorkspaceConnection';
import type { DatabaseDetail } from '../model/types';
const newId = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, '0')).join('');
export function DatabaseTemplates({
    teamId,
    database,
    busy,
    mutate,
    onCreated,
}: {
    teamId: string;
    database: DatabaseDetail;
    busy: boolean;
    mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
    onCreated: (id: string) => void;
}) {
    const [name, setName] = useState('새 템플릿');
    const pending = useRef<{ key: string; id: string } | null>(null);
    const connection = useWorkspaceConnection();
    const router = useRouter();
    const idFor = (key: string) => {
        if (pending.current?.key !== key) pending.current = { key, id: newId() };
        return pending.current.id;
    };
    const open = async (id: string, title: string) => {
        const href = `/${teamId}/docs/${id}`;
        if (connection) connection.open(href, title);
        else if (await canLeaveWorkspacePane()) router.push(href);
    };
    const button = 'rounded-control px-2 py-1 text-xs hover:bg-bg-hover disabled:opacity-50';
    return (
        <details className="relative text-sm" data-manages-draft-navigation="true">
            <summary
                aria-label="템플릿"
                title="템플릿"
                className="cursor-pointer list-none border-l border-white/25 px-2 py-1.5"
            >
                ⌄<span className="sr-only">템플릿</span>
            </summary>
            <div className="absolute right-0 z-30 mt-1 w-80 max-w-[80vw] space-y-3 rounded-panel border border-border-primary bg-bg-primary p-3 text-text-primary shadow-lg">
                <p className="text-xs text-text-secondary">
                    템플릿 페이지의 본문과 속성으로 새 페이지를 만듭니다. 원본을 편집하면 다음 생성부터 반영됩니다.
                </p>
                {(database.templates ?? []).map((template) => (
                    <div key={template.id} className="border-b border-border-primary pb-2">
                        <button
                            type="button"
                            disabled={busy}
                            className={`${button} w-full text-left font-medium`}
                            aria-label={`${template.name} 템플릿 사용`}
                            onClick={async () => {
                                let documentId = '';
                                const success = await mutate(async () => {
                                    const result = await databaseApi.applyTemplate(
                                        teamId,
                                        database.id,
                                        template.id,
                                        idFor(`apply:${template.id}`),
                                    );
                                    if (!result.data) throw new Error('페이지를 생성하지 못했습니다.');
                                    documentId = result.data.documentId;
                                }, '템플릿으로 페이지를 생성했습니다.');
                                if (success) {
                                    pending.current = null;
                                    onCreated(documentId);
                                    void open(documentId, template.name);
                                }
                            }}
                        >
                            {template.name}
                        </button>
                        <div className="flex gap-2 text-text-secondary">
                            <button
                                type="button"
                                className={button}
                                disabled={busy || database.locked || database.canEditSchema === false}
                                aria-pressed={database.defaultTemplateId === template.id}
                                onClick={() =>
                                    void mutate(
                                        () =>
                                            databaseApi.setDefaultTemplate(
                                                teamId,
                                                database.id,
                                                database.defaultTemplateId === template.id ? null : template.id,
                                                database.revision,
                                            ),
                                        '기본 템플릿을 변경했습니다.',
                                    )
                                }
                            >
                                {database.defaultTemplateId === template.id ? '기본 템플릿 해제' : '기본으로 설정'}
                            </button>
                            <button
                                type="button"
                                className={button}
                                onClick={() => void open(template.documentId, `${template.name} 템플릿 편집`)}
                            >
                                템플릿 편집
                            </button>
                            <button
                                type="button"
                                className={button}
                                disabled={busy || database.locked}
                                onClick={() =>
                                    void mutate(
                                        () =>
                                            databaseApi.removeTemplate(
                                                teamId,
                                                database.id,
                                                template.id,
                                                database.revision,
                                            ),
                                        '템플릿 목록에서 제거했습니다. 원본 페이지는 유지됩니다.',
                                    )
                                }
                            >
                                템플릿 제거
                            </button>
                        </div>
                    </div>
                ))}
                <form
                    className="flex gap-2"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        let documentId = '';
                        const success = await mutate(async () => {
                            const result = await databaseApi.createTemplate(
                                teamId,
                                database.id,
                                name,
                                idFor(`create:${name}`),
                                database.revision,
                            );
                            if (!result.data) throw new Error('템플릿을 생성하지 못했습니다.');
                            documentId = result.data.documentId;
                        }, '템플릿을 만들었습니다. 본문과 기본 속성을 편집하세요.');
                        if (success) {
                            pending.current = null;
                            void open(documentId, `${name} 템플릿 편집`);
                        }
                    }}
                >
                    <input
                        aria-label="템플릿 이름"
                        required
                        maxLength={80}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={busy || database.locked}
                        className="min-w-0 flex-1 rounded border border-border-primary bg-bg-secondary p-2 text-xs"
                    />
                    <button disabled={busy || database.locked} className={button}>
                        새 템플릿
                    </button>
                </form>
            </div>
        </details>
    );
}
