import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { tap } from 'rxjs/operators';
export const CONTENT_CHANGED = 'workspace.content.changed';
@Injectable()
export class ContentChangeInterceptor implements NestInterceptor {
    constructor(private readonly events: EventEmitter2) {}
    intercept(context: ExecutionContext, next: CallHandler) {
        const request = context
            .switchToHttp()
            .getRequest<{ method: string; params: { teamId?: string }; route?: { path?: string } }>();
        const readOnly = request.method === 'GET' || request.route?.path?.endsWith('/query');
        return next.handle().pipe(
            tap(() => {
                if (!readOnly && request.params.teamId)
                    this.events.emit(CONTENT_CHANGED, { teamId: request.params.teamId });
            }),
        );
    }
}
