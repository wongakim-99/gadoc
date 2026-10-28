'use client';

import { attachmentFilename } from '@/src/entities/message/lib/attachmentFilename';
import { useState } from 'react';
import { Download, ImageOff } from 'lucide-react';
import { privateFileUrl } from '@/src/shared/lib/private-files';
import type { Attachment } from '@/src/entities/message/types';
import { formatAttachmentSize, getAttachmentKind } from '@/src/entities/message/lib/attachmentPresentation';
import { AttachmentImageViewer } from './AttachmentImageViewer';
import { AttachmentFilePreview } from './AttachmentFilePreview';

interface Props {
    attachments: Attachment[];
}

export function MessageAttachments({ attachments }: Props) {
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
    if (attachments.length === 0) {
        return null;
    }

    attachments = attachments.map((attachment) => ({ ...attachment, name: attachmentFilename(attachment.name) }));
    const mediaAttachments = attachments.filter((attachment) => getAttachmentKind(attachment) !== 'other');
    const otherAttachments = attachments.filter((attachment) => getAttachmentKind(attachment) === 'other');
    const images = mediaAttachments.filter((attachment) => getAttachmentKind(attachment) === 'image');
    const selectedIndex = images.findIndex((attachment) => attachment.url === selectedUrl);
    const selectedFile = attachments.find((attachment) => attachment.url === selectedUrl);

    return (
        <div className="mt-2 space-y-3">
            {mediaAttachments.length > 0 ? (
                <div className="grid max-w-3xl grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3">
                    {mediaAttachments.map((attachment) => (
                        <MediaAttachmentCard
                            key={attachment.url}
                            attachment={attachment}
                            onOpen={() => setSelectedUrl(attachment.url)}
                        />
                    ))}
                </div>
            ) : null}
            <div className="flex flex-col gap-2">
                {otherAttachments.map((attachment) => (
                    <div
                        key={attachment.url}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border-primary bg-black/20 px-3 py-2 text-sm text-text-secondary transition-colors hover:border-slack-green/40 hover:text-white"
                    >
                        <button
                            type="button"
                            onClick={() => setSelectedUrl(attachment.url)}
                            aria-label={`${attachment.name} 미리보기`}
                            className="min-w-0 flex-1 truncate py-1 text-left hover:underline"
                        >
                            {attachment.name}
                        </button>
                        <span className="shrink-0 text-xs text-text-tertiary">
                            {formatAttachmentSize(attachment.size)}
                        </span>
                        <a
                            href={privateFileUrl(attachment.url)}
                            download={attachment.name}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`${attachment.name} 다운로드`}
                            className="shrink-0 rounded p-1 hover:bg-bg-hover"
                        >
                            <Download size={16} aria-hidden="true" />
                        </a>
                    </div>
                ))}
            </div>
            {selectedIndex >= 0 && (
                <AttachmentImageViewer
                    images={images}
                    index={selectedIndex}
                    onChange={(index) => setSelectedUrl(images[index].url)}
                    onClose={() => setSelectedUrl(null)}
                />
            )}
            {selectedIndex < 0 && selectedFile && (
                <AttachmentFilePreview
                    key={selectedFile.url}
                    attachment={selectedFile}
                    onClose={() => setSelectedUrl(null)}
                />
            )}
        </div>
    );
}

function MediaAttachmentCard({ attachment, onOpen }: { attachment: Attachment; onOpen: () => void }) {
    const [failed, setFailed] = useState(false);
    const kind = getAttachmentKind(attachment);
    const url = privateFileUrl(attachment.url);

    return (
        <div className="min-w-0 overflow-hidden rounded-xl border border-border-primary bg-bg-secondary">
            {kind === 'image' ? (
                <button
                    type="button"
                    aria-label={`${attachment.name} 사진 보기`}
                    onClick={onOpen}
                    className="flex min-h-24 w-full cursor-zoom-in items-center justify-center bg-black/20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-action-text"
                >
                    {failed ? (
                        <span className="flex items-center gap-2 p-5 text-sm text-text-secondary">
                            <ImageOff size={18} aria-hidden="true" /> 사진을 불러오지 못했습니다
                        </span>
                    ) : (
                        <img
                            src={url}
                            alt={attachment.name}
                            className="max-h-80 w-full object-contain"
                            loading="lazy"
                            onError={() => setFailed(true)}
                        />
                    )}
                </button>
            ) : kind === 'video' ? (
                <video src={url} controls preload="metadata" className="max-h-80 w-full bg-black object-contain" />
            ) : kind === 'audio' ? (
                <div className="flex min-h-24 items-center px-3">
                    <audio src={url} controls className="w-full min-w-0" preload="metadata" />
                </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                {
                    <button
                        type="button"
                        onClick={onOpen}
                        className="truncate text-left text-sm text-white hover:text-action-text"
                    >
                        {attachment.name}
                    </button>
                }
                <span className="ml-auto shrink-0 text-xs text-text-tertiary">
                    {formatAttachmentSize(attachment.size)}
                </span>
                <a
                    href={url}
                    download={attachment.name}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${attachment.name} 다운로드`}
                    className="shrink-0 rounded p-1 text-text-secondary hover:bg-bg-hover hover:text-white focus-visible:outline-2 focus-visible:outline-action-text"
                >
                    <Download size={16} aria-hidden="true" />
                </a>
            </div>
        </div>
    );
}
