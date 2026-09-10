import type { IpcMainInvokeEvent } from 'electron';
import { isAllowedUrl } from './config';

export function isTrustedSender(event: IpcMainInvokeEvent) {
    return Boolean(
        event.senderFrame && event.senderFrame === event.sender.mainFrame && isAllowedUrl(event.senderFrame.url),
    );
}
