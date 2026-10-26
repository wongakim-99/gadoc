import type { ReactNode } from 'react';

export function WorkspacePageHeader({ title, children }: { title: string; children?: ReactNode }) {
    return (
        <header className="workspace-topbar">
            <h2>{title}</h2>
            {children}
        </header>
    );
}
