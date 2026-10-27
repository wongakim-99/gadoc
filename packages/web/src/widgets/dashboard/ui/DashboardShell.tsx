import { DashboardSidebar } from './DashboardSidebar';

interface Props {
    title: string;
    description: string;
    currentUserName?: string;
    children: React.ReactNode;
}

export function DashboardShell({ title, description, currentUserName, children }: Props) {
    return (
        <div className="workspace-shell dashboard-shell min-h-screen bg-bg-primary lg:flex">
            <DashboardSidebar currentUserName={currentUserName} />
            <main className="min-w-0 flex-1">
                <header className="workspace-topbar">
                    <h1>{title}</h1>
                </header>
                <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
                    <p className="max-w-3xl text-sm leading-6 text-text-secondary">{description}</p>
                    {children}
                </div>
            </main>
        </div>
    );
}
