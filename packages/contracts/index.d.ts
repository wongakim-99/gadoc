export type DesktopUpdateStage =
    | 'idle'
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'installing'
    | 'error';

export interface DesktopUpdateStatus {
    stage: DesktopUpdateStage;
    detail: string;
    progress: number | null;
    availableVersion: string | null;
    manualDownloadRequired: boolean;
}

export interface DesktopUpdateCheckResult {
    ok: boolean;
    status: DesktopUpdateStatus;
}

export interface DesktopUpdateDownloadResult {
    ok: boolean;
    status: DesktopUpdateStatus;
}

export interface DesktopUpdateInstallResult {
    ok: boolean;
    status: DesktopUpdateStatus;
}

export interface SlacordDesktopBridge {
    isDesktop: boolean;
    platform: string;
    /** Optional additions keep web deployments compatible with older shells. */
    bridgeVersion?: number;
    setBadgeCount?: (count: number) => Promise<boolean>;
    onNavigate?: (listener: (href: string) => void) => () => void;
    notify: (title: string, body: string, href?: string) => Promise<boolean>;
    requestMediaAccess: (kind?: 'microphone' | 'camera') => Promise<{ microphone: boolean; camera: boolean }>;
    getUpdateStatus: () => Promise<DesktopUpdateStatus>;
    checkForUpdates: () => Promise<DesktopUpdateCheckResult>;
    downloadUpdate: () => Promise<DesktopUpdateDownloadResult>;
    restartToUpdate: () => Promise<DesktopUpdateInstallResult>;
    onUpdateStatus: (listener: (payload: DesktopUpdateStatus) => void) => () => void;
}
