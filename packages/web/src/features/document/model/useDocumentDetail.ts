'use client';

import { useEffect, useMemo, useState } from 'react';
import { documentApi, unwrapApiArray, unwrapApiData } from '@/lib/api-client';
import type { DocumentFull, DocumentNode } from '@/src/entities/document/types';

export function useDocumentDetail(teamId: string, docId: string) {
    const [doc, setDoc] = useState<DocumentFull | null>(null);
    const [documents, setDocuments] = useState<DocumentNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        setLoading(true);
        setDoc(null);
        setDocuments([]);
        setError('');
        Promise.all([documentApi.getDocument(teamId, docId), documentApi.getDocuments(teamId)])
            .then(([docResponse, docsResponse]) => {
                if (!active) return;
                const docData = unwrapApiData<DocumentFull>(docResponse);
                if (!docResponse.success || !docData) throw new Error('문서를 찾을 수 없거나 접근 권한이 없습니다.');
                setDoc(docData);
                if (docsResponse.success) setDocuments(unwrapApiArray<DocumentNode>(docsResponse));
            })
            .catch(
                (caught) =>
                    active && setError(caught instanceof Error ? caught.message : '문서를 불러오지 못했습니다.'),
            )
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [docId, teamId]);

    const children = useMemo(
        () =>
            documents
                .filter((item) => item.parentId === docId)
                .sort((left, right) => left.title.localeCompare(right.title, 'ko')),
        [docId, documents],
    );

    return { doc, setDoc, documents, children, loading, error };
}
