import { WorkspacePageHeader } from '@/src/features/workspace/ui/WorkspacePageHeader';

export default function ChannelsPage() {
    return (
        <div>
            <WorkspacePageHeader title="채팅" />
            <section className="mx-auto max-w-3xl px-6 py-12">
                <h1 className="text-2xl font-semibold">팀 대화</h1>
                <p className="mt-3 text-sm leading-7 text-text-secondary">
                    왼쪽 탐색에서 채널이나 DM을 선택하세요. 새 채널과 그룹 대화도 같은 곳에서 시작할 수 있습니다.
                </p>
            </section>
        </div>
    );
}
