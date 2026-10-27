'use client';

import { useEffect, useMemo } from 'react';
import { createDocumentSchema } from './documentBlockSchema';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { ko } from '@blocknote/core/locales';
import { documentApi, unwrapApiData } from '@/lib/api-client';

interface Props {
    teamId: string;
    initialContent?: string;
    onChange: (json: string) => void;
    editable?: boolean;
}

function parseBlocks(content: string) {
    try {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
    } catch {
        return undefined;
    }
}

export function BlockEditor({ teamId, initialContent, onChange, editable = true }: Props) {
    const initialBlocks = useMemo(() => parseBlocks(initialContent ?? ''), [initialContent]);
    const schema = useMemo(() => createDocumentSchema(teamId), [teamId]);
    const editor = useCreateBlockNote({
        schema,
        dictionary: ko,
        initialContent: initialBlocks,
        uploadFile: async (file: File) => {
            const res = await documentApi.uploadDocumentImage(teamId, file);
            const url = unwrapApiData<{ url: string }>(res)?.url;
            if (url) return url;
            throw new Error('이미지 업로드에 실패했습니다.');
        },
    });

    useEffect(() => {
        if (!editable) return;
        const handler = () => {
            onChange(JSON.stringify(editor.document));
        };
        return editor.onChange(handler);
    }, [editor, editable, onChange]);

    return (
        <div>
            <BlockNoteView editor={editor} editable={editable} className="slacord-blocknote" theme="dark" />
        </div>
    );
}
