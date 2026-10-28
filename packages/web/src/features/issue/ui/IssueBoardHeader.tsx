import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { databaseApi } from '@/lib/api-client';

interface Props {
    teamId: string;
    canWrite: boolean;
    onCreate: () => void;
}

export function IssueBoardHeader({ teamId, canWrite, onCreate }: Props) {
    const router = useRouter();
    const [opening, setOpening] = useState(false);
    const [error, setError] = useState('');
    const openDatabase = async () => {
        if (opening) return;
        setOpening(true);
        setError('');
        try {
            const result = await databaseApi.issueSource(teamId);
            if (!result.data) throw new Error('이슈 데이터베이스를 열지 못했습니다.');
            router.push(`/${teamId}/docs?database=${result.data.id}`);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '이슈 데이터베이스를 열지 못했습니다.');
        } finally { setOpening(false); }
    };
    return (
        <div className="workspace-topbar">
            <div>
                <h2 className="text-xl font-bold text-white">이슈 트래커</h2>
                {!canWrite ? (
                    <p className="text-[11px] leading-4 text-text-tertiary">guest는 이슈를 조회만 할 수 있습니다.</p>
                ) : null}
            </div>
            {canWrite ? (
                <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={opening} onClick={() => void openDatabase()}
                    className="rounded-control border border-border-primary px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-50">
                    {opening ? '여는 중…' : 'DB로 보기'}
                </button>
                <button
                    onClick={onCreate}
                    className="flex items-center gap-2 rounded-control bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    이슈 생성
                </button>
                </div>
            ) : null}
            {error && <p role="alert" className="w-full text-sm text-error">{error}</p>}
        </div>
    );
}
