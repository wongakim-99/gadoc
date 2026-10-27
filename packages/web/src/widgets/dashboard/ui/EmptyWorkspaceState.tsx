import Link from 'next/link';

export function EmptyWorkspaceState() {
    return (
        <div className="rounded-[28px] border border-dashed border-border-primary bg-bg-secondary px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#d6b08a]">Workspace Ready</p>
            <h2 className="mt-3 text-2xl font-bold text-white">첫 워크스페이스를 열어보세요</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-text-secondary">
                워크스페이스를 만들고 팀원을 초대하세요. 채널에서 대화하고, 문서와 할 일을 함께 관리할 수 있습니다.
            </p>
            <Link
                href="/dashboard/teams/new"
                className="mt-6 inline-flex rounded-2xl bg-[#b97532] px-5 py-3 font-semibold text-white transition hover:bg-[#cf8640]"
            >
                워크스페이스 만들기
            </Link>
        </div>
    );
}
