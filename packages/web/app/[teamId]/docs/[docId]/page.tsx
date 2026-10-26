'use client';

import { use } from 'react';
import Link from 'next/link';
import { useDocumentDetail } from '@/src/features/document/model/useDocumentDetail';
import { DocumentWorkspace } from '@/src/features/document/ui/DocumentWorkspace';
import { DocumentLoading } from '@/src/features/document/ui/DocumentLoading';

export default function DocDetailPage({ params }: { params: Promise<{ teamId: string; docId: string }> }) {
    const { teamId, docId } = use(params);
    const { doc, setDoc, documents, children, loading, error } = useDocumentDetail(teamId, docId);
    if (loading) return <DocumentLoading />;
    if (!doc || error)
        return (
            <div className="p-8">
                <p role="alert">{error || '페이지를 찾지 못했습니다.'}</p>
                <Link href={`/${teamId}/docs`} className="mt-4 inline-block underline">
                    문서 목록으로 돌아가기
                </Link>
            </div>
        );
    return (
        <DocumentWorkspace
            key={`${doc.id}:${doc.updatedAt}`}
            doc={doc}
            documents={documents}
            children={children}
            onRestore={setDoc}
        />
    );
}
