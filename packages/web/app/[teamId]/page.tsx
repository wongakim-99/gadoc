import { WorkspacePageHeader } from '@/src/features/workspace/ui/WorkspacePageHeader';
import { WorkspaceOverview } from '@/src/features/workspace/ui/WorkspaceOverview';
export default async function TeamHomePage({ params }: { params: Promise<{ teamId: string }> }) {
    const { teamId } = await params;
    return <div><WorkspacePageHeader title="홈" /><WorkspaceOverview teamId={teamId} /></div>;
}
