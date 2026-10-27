'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { teamApi, unwrapApiArray } from '@/lib/api-client';
import { PopoverMenu } from '@/src/shared/ui/PopoverMenu';

export function WorkspaceSwitcher({ teamId, teamName }: { teamId: string; teamName: string }) {
    const [open, setOpen] = useState(false);
    const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const changeOpen = (next: boolean) => {
        setOpen(next);
        if (!next) return;
        setLoading(true);
        setError('');
        void teamApi
            .getTeams()
            .then((response) => {
                if (!response.success) throw new Error('워크스페이스를 불러오지 못했습니다.');
                setTeams(unwrapApiArray<{ id: string; name: string }>(response));
            })
            .catch((caught) => setError(caught instanceof Error ? caught.message : '목록 오류'))
            .finally(() => setLoading(false));
    };
    return (
        <PopoverMenu
            label="워크스페이스 전환"
            open={open}
            onOpenChange={changeOpen}
            triggerClassName="flex w-full min-w-0 items-center gap-2 rounded-control px-1 py-2 text-left hover:bg-bg-hover"
            icon={
                <>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{teamName}</span>
                    <ChevronsUpDown size={14} className="shrink-0 text-text-tertiary" />
                </>
            }
        >
            {loading && <p role="status">불러오는 중…</p>}
            {error && (
                <p role="alert" className="text-error">
                    {error}
                </p>
            )}
            {teams.map((team) => (
                <Link
                    key={team.id}
                    href={'/' + team.id}
                    onClick={() => setOpen(false)}
                    aria-current={team.id === teamId ? 'true' : undefined}
                    className="flex min-w-0 items-center gap-2 rounded-control p-2 hover:bg-bg-hover"
                >
                    <span className="min-w-0 flex-1 truncate">{team.name}</span>
                    {team.id === teamId && <Check size={16} />}
                </Link>
            ))}
            <Link href="/dashboard/teams/new" className="flex items-center gap-2 border-t border-border-primary p-2">
                <Plus size={16} />
                워크스페이스 만들기
            </Link>
            <Link href="/dashboard" className="block rounded-control p-2 hover:bg-bg-hover">
                대시보드
            </Link>
        </PopoverMenu>
    );
}
