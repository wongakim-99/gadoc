'use client';

interface Props {
    title: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}

export function SidebarSection({ title, action, children }: Props) {
    return (
        <div>
            <div className="mb-1 flex items-center justify-between pl-3">
                <p className="text-xs font-medium text-text-tertiary">{title}</p>
                {action}
            </div>
            {children}
        </div>
    );
}
