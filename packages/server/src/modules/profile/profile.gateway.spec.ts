import { JwtService } from '@nestjs/jwt';
import { ProfileGateway } from './profile.gateway';

describe('profile socket authorization', () => {
    const id = '111111111111111111111111',
        peer = '222222222222222222222222';
    const jwt = new JwtService({ secret: 'profile-test-only-01234567890123456789' });
    function fixture() {
        const teams = { findByMember: jest.fn().mockResolvedValue([{ members: [{ userId: id }, { userId: peer }] }]) };
        const users = { findById: jest.fn().mockResolvedValue({ id }) };
        const gateway = new ProfileGateway(jwt, teams as any, users as any);
        const emit = jest.fn();
        const to = jest.fn().mockReturnValue({ emit });
        gateway.server = { to } as any;
        return { gateway, users, to, emit };
    }
    function client(token?: string) {
        return {
            handshake: { auth: { token }, headers: { origin: 'http://127.0.0.1:3203' } },
            join: jest.fn(),
            emit: jest.fn(),
            disconnect: jest.fn(),
        } as any;
    }
    it('joins only the authenticated account room and rejects missing/forged tokens and deleted accounts', async () => {
        const { gateway, users } = fixture();
        const valid = client(jwt.sign({ sub: id }));
        await gateway.handleConnection(valid);
        expect(valid.join).toHaveBeenCalledWith(`user:${id}`);
        for (const token of [undefined, 'forged']) {
            const invalid = client(token);
            await gateway.handleConnection(invalid);
            expect(invalid.disconnect).toHaveBeenCalled();
            expect(invalid.join).not.toHaveBeenCalled();
        }
        users.findById.mockResolvedValue(null);
        const deleted = client(jwt.sign({ sub: id }));
        await gateway.handleConnection(deleted);
        expect(deleted.disconnect).toHaveBeenCalled();
        expect(deleted.join).not.toHaveBeenCalled();
    });
    it('sends only a user-ID invalidation to the owner and current workspace peers', async () => {
        const { gateway, to, emit } = fixture();
        await gateway.changed({ userId: id });
        expect(to).toHaveBeenCalledWith([`user:${id}`, `user:${peer}`]);
        expect(emit).toHaveBeenCalledWith('profile_changed', { userId: id });
    });
});
