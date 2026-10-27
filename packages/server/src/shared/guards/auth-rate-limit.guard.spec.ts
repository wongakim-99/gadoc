import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { EventEmitter } from 'node:events';

it('does not lock a user out after successful logins', () => {
    const guard = new AuthRateLimitGuard();
    const response = Object.assign(new EventEmitter(), { statusCode: 200, setHeader: jest.fn() });
    const request = { socket: { remoteAddress: '127.0.0.1' }, body: { email: 'success@example.test' } };
    const context = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) } as any;
    for (let index = 0; index < 15; index++) {
        expect(guard.canActivate(context)).toBe(true);
        response.emit('finish');
    }
});

it('limits an account without trusting spoofed proxy headers and expires the limit', () => {
    jest.useFakeTimers();
    const guard = new AuthRateLimitGuard();
    const request = {
        socket: { remoteAddress: '127.0.0.1' },
        body: { email: 'person@example.test' },
        headers: {} as Record<string, string>,
    };
    const setHeader = jest.fn();
    const context = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ setHeader }) }) } as any;
    for (let index = 0; index < 10; index++) expect(guard.canActivate(context)).toBe(true);
    request.headers['x-forwarded-for'] = '1.2.3.4';
    expect(() => guard.canActivate(context)).toThrow();
    expect(setHeader).toHaveBeenCalledWith('Retry-After', 900);
    jest.advanceTimersByTime(900_001);
    expect(guard.canActivate(context)).toBe(true);
    jest.useRealTimers();
});
