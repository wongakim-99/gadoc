'use client';

import type { TeamMemberSummary } from '@/src/entities/team/types';
import { MentionSuggestions } from './MentionSuggestions';
import { MessageComposerActions } from './MessageComposerActions';
import { PendingAttachmentTray } from './PendingAttachmentTray';
import { useMessageComposer } from '../model/useMessageComposer';
import { InsertWorkspaceReference } from '@/src/features/workspace/ui/WorkspaceReferenceActions';
import { useWorkspaceLeaveGuard } from '@/src/features/workspace/model/useWorkspaceConnection';
import { WorkspaceReferenceDropZone } from '@/src/features/workspace/ui/WorkspaceReferenceDropZone';
import { insertReferenceAtSelection } from '@/src/features/workspace/model/workspaceDrag';

interface Props {
    channelName: string;
    readOnly?: boolean;
    readOnlyMessage?: string;
    members?: TeamMemberSummary[];
    onSend: (content: string) => void | Promise<void>;
    onUpload: (files: File[], content: string) => Promise<void>;
    onTyping: () => void;
    isUploading: boolean;
}

export function MessageInput({
    channelName,
    readOnly = false,
    readOnlyMessage,
    members = [],
    onSend,
    onUpload,
    onTyping,
    isUploading,
}: Props) {
    const composer = useMessageComposer({ members, onTyping, onUpload, onSend });
    useWorkspaceLeaveGuard(
        () =>
            !(composer.content.trim() || composer.pendingFiles.length) ||
            window.confirm('전송하지 않은 메시지가 있습니다. 이 화면을 닫을까요?'),
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (readOnly) return;
        if (composer.mentionQuery !== null && composer.mentionCandidates.length > 0) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                composer.setMentionIndex((i) => Math.max(0, i - 1));
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                composer.setMentionIndex((i) => Math.min(composer.mentionCandidates.length - 1, i + 1));
                return;
            }
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                composer.insertMention(composer.mentionCandidates[composer.mentionIndex]?.user?.username ?? '');
                return;
            }
            if (e.key === 'Escape') {
                composer.setMentionQuery(null);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void composer.submit();
        }
    };

    return (
        <div className="min-w-0 shrink-0 px-3 pb-3 pt-1">
            <InsertWorkspaceReference
                disabled={readOnly}
                onInsert={(_, markdown) => {
                    const next = [composer.content, markdown].filter(Boolean).join('\n');
                    composer.handleChange(next, next.length);
                    composer.textareaRef.current?.focus();
                }}
            />
            <input
                ref={composer.fileInputRef}
                type="file"
                multiple
                disabled={readOnly}
                className="hidden"
                onChange={(event) => (readOnly ? undefined : void composer.handleFileChange(event.target.files))}
            />
            <WorkspaceReferenceDropZone
                disabled={readOnly}
                label="메시지 작성란에 참조 추가 · 전송은 직접 확인"
                onInsert={(_, markdown) => {
                    const next = insertReferenceAtSelection(composer.content, markdown, composer.textareaRef.current);
                    composer.handleChange(next, next.length);
                    composer.textareaRef.current?.focus();
                }}
            >
                <div
                    className={`relative min-w-0 rounded-xl border bg-bg-secondary transition-colors ${
                        composer.isDraggingFiles
                            ? 'border-action-text bg-selection'
                            : 'border-border-primary focus-within:border-action-text/60'
                    }`}
                    onDragEnter={readOnly ? undefined : composer.handleDragEnter}
                    onDragOver={readOnly ? undefined : composer.handleDragOver}
                    onDragLeave={readOnly ? undefined : composer.handleDragLeave}
                    onDrop={readOnly ? undefined : composer.handleDrop}
                >
                    {composer.isDraggingFiles ? (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/55 backdrop-blur-sm">
                            <div className="rounded-full border border-action-text/40 bg-bg-secondary/90 px-4 py-2 text-sm font-medium text-white">
                                파일을 놓아서 업로드 큐에 추가
                            </div>
                        </div>
                    ) : null}
                    <PendingAttachmentTray files={composer.pendingFiles} onRemove={composer.removePendingFile} />
                    <div className="relative flex items-end gap-2">
                        {composer.mentionQuery !== null && composer.mentionCandidates.length > 0 ? (
                            <MentionSuggestions
                                activeIndex={composer.mentionIndex}
                                members={composer.mentionCandidates}
                                onSelect={composer.insertMention}
                            />
                        ) : null}
                        <MessageComposerActions
                            canSubmit={Boolean(composer.content.trim()) || composer.pendingFiles.length > 0}
                            isUploading={isUploading}
                            readOnly={readOnly}
                            onOpenFiles={() => composer.fileInputRef.current?.click()}
                            onSubmit={() => void composer.submit()}
                        />
                        <textarea
                            ref={composer.textareaRef}
                            value={composer.content}
                            readOnly={readOnly}
                            onChange={(event) =>
                                readOnly
                                    ? undefined
                                    : composer.handleChange(event.target.value, event.target.selectionStart)
                            }
                            onKeyDown={handleKeyDown}
                            placeholder={
                                readOnly
                                    ? `${channelName} 채널은 guest에게 읽기 전용입니다.`
                                    : `#${channelName}에 메시지 보내기`
                            }
                            rows={1}
                            className="min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[14px] leading-[1.5] text-white outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed"
                            style={{ minHeight: '22px', maxHeight: '160px' }}
                        />
                    </div>
                    {readOnly && (
                        <p className="px-3 pb-2 text-xs text-text-tertiary">{readOnlyMessage ?? '읽기 전용 채널'}</p>
                    )}
                </div>
            </WorkspaceReferenceDropZone>
        </div>
    );
}
