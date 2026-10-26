'use client';

import type { DocumentFull } from '@/src/entities/document/types';

interface Props {
    doc: DocumentFull;
    editing: boolean;
    saving: boolean;
    editorReady: boolean;
    dirty: boolean;
    onArchive: () => void;
    onCancel: () => void;
    onEdit: () => void;
    onSave: () => Promise<void>;
}

export function DocumentDetailHeader({
    doc,
    editing,
    saving,
    editorReady,
    dirty,
    onArchive,
    onCancel,
    onEdit,
    onSave,
}: Props) {
    const button =
        'rounded-md px-2.5 py-1.5 text-xs text-text-secondary transition hover:bg-bg-hover hover:text-white disabled:opacity-50';
    return (
        <div className="flex flex-wrap items-center gap-1">
            <span role="status" className="mr-2 text-xs text-text-tertiary">
                {saving ? '저장 중…' : dirty ? '저장하지 않은 변경' : '저장됨'}
            </span>
            {doc.visibility === 'restricted' && <span className="mr-2 text-xs text-warning">제한된 페이지</span>}
            {editing ? (
                <>
                    <button onClick={onCancel} disabled={saving} className={button}>
                        취소
                    </button>
                    <button
                        onClick={() => void onSave()}
                        disabled={saving || !editorReady}
                        className={`${button} bg-bg-hover`}
                        title="Ctrl / ⌘ + S"
                    >
                        저장
                    </button>
                </>
            ) : (
                <>
                    {doc.canEdit !== false && (
                        <button onClick={onEdit} className={button}>
                            편집
                        </button>
                    )}
                    {doc.canDelete !== false && (
                        <button onClick={onArchive} className={button}>
                            아카이브
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
