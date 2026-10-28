import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationDeliveryController } from '../../infrastructure/http/notification-delivery.controller';
import { NotificationResourceService } from './notification-resource.service';
import { DEFAULT_NOTIFICATION_KINDS, NOTIFICATION_KINDS } from '../../domain/notification-preference';

const team = '111111111111111111111111',
    otherTeam = '222222222222222222222222';
const a = 'aaaaaaaaaaaaaaaaaaaaaaaa',
    b = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const messageId = 'cccccccccccccccccccccccc',
    noticeId = 'dddddddddddddddddddddddd';
function fixture() {
    const values = new Map<string, any>();
    const notices = new Map<string, any>();
    const documents = new Map<string, any>();
    const issues = new Map<string, any>();
    const channels = new Map<string, any>(
        [a, b].map((id) => [id, { id, teamId: team, type: 'public', isArchived: false, isMember: () => false }]),
    );
    const messages = new Map<string, any>([
        [messageId, { id: messageId, teamId: team, channelId: a, authorId: 'actor', mentions: [], replyToId: null }],
    ]);
    const model = {
        findById: jest.fn((id) => ({ lean: async () => values.get(id) })),
        findOneAndUpdate: jest.fn((filter, update, options) => ({
            lean: async () => {
                const before = values.get(filter._id);
                if (before && before.revision !== filter.revision) {
                    if (options.upsert) throw { code: 11000 };
                    return null;
                }
                if (!before && !options.upsert) return null;
                const saved = { ...update.$set, revision: (before?.revision || 0) + update.$inc.revision };
                values.set(filter._id, saved);
                return saved;
            },
        })),
    };
    const teams = { requireMember: jest.fn().mockResolvedValue({ role: 'member' }) };
    const channelRepo = {
        findById: async (id: string) => channels.get(id),
        findByTeam: async () => [...channels.values()],
    };
    const resources = new NotificationResourceService(
        channelRepo as any,
        { findById: async (id: string) => messages.get(id) } as any,
        { findById: async (id: string) => documents.get(id) } as any,
        { findById: (id: string) => ({ lean: async () => issues.get(id) }) } as any,
        teams as any,
    );
    const service = new NotificationPreferenceService(
        model as any,
        { findById: (id: string) => ({ lean: async () => notices.get(id) }) } as any,
        teams as any,
        channelRepo as any,
        resources,
    );
    const set = async (
        mode: 'all' | 'mentions' | 'off' | 'inherit',
        channelId?: string,
        teamId = team,
        userId = 'user',
    ) => {
        const current = await service.get(teamId, userId);
        return service.update(teamId, userId, { mode, channelId, revision: current.revision });
    };
    return { service, teams, model, channels, messages, notices, documents, issues, resources, set, values };
}

describe('independent notification preferences', () => {
    it('reads the original mode-only WIP format without a migration or a write', async () => {
        const f = fixture();
        await f.set('mentions');
        const legacy = [...f.values.values()][0];
        delete legacy.kinds;
        delete legacy.channelKinds;
        const writes = f.model.findOneAndUpdate.mock.calls.length;
        const value = await f.service.get(team, 'user');
        expect(value.kinds).toEqual(DEFAULT_NOTIFICATION_KINDS);
        expect(value.channelKinds).toEqual({});
        expect(value.mode).toBe('mentions');
        expect(f.model.findOneAndUpdate).toHaveBeenCalledTimes(writes);
        await f.service.update(team, 'user', { revision: value.revision, kinds: { mention: false } });
        expect((await f.service.get(team, 'user')).kinds).toEqual({ ...DEFAULT_NOTIFICATION_KINDS, mention: false });
    });
    it('keeps defaults read-only and scopes persistence to the current user and workspace', async () => {
        const f = fixture();
        expect(await f.service.get(team, 'user')).toEqual({
            mode: 'all',
            channelModes: {},
            kinds: DEFAULT_NOTIFICATION_KINDS,
            channelKinds: {},
            revision: 0,
        });
        expect(f.model.findOneAndUpdate).not.toHaveBeenCalled();
        await f.set('off');
        expect((await f.service.get(team, 'user')).mode).toBe('off');
        expect((await f.service.get(otherTeam, 'user')).mode).toBe('all');
        expect((await f.service.get(team, 'other-user')).mode).toBe('all');
    });
    it('applies room overrides before workspace defaults and removes only the selected override on inherit', async () => {
        const f = fixture();
        await f.set('off', a);
        expect(await f.service.shouldDeliver(team, 'user', `message:${messageId}`)).toBe(false);
        f.messages.get(messageId).channelId = b;
        expect(await f.service.shouldDeliver(team, 'user', `message:${messageId}`)).toBe(true);
        await f.set('off');
        await f.set('all', b);
        expect(await f.service.shouldDeliver(team, 'user', `message:${messageId}`)).toBe(true);
        await f.set('inherit', b);
        expect(await f.service.shouldDeliver(team, 'user', `message:${messageId}`)).toBe(false);
        expect((await f.service.get(team, 'user')).channelModes).toEqual({ [a]: 'off' });
    });
    it('preserves the first concurrent write instead of silently overwriting it', async () => {
        const f = fixture();
        const input = { mode: 'off' as const, revision: 0 };
        const results = await Promise.allSettled([
            f.service.update(team, 'user', input),
            f.service.update(team, 'user', input),
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
        await expect(f.service.update(team, 'user', { mode: 'all', revision: 0 })).rejects.toMatchObject({
            status: 409,
        });
        expect((await f.service.get(team, 'user')).mode).toBe('off');
    });
    it('rejects nonmembers, foreign/private/archived rooms and invalid workspace inheritance', async () => {
        const f = fixture();
        f.teams.requireMember.mockRejectedValueOnce(new Error('not a member'));
        await expect(f.service.get(team, 'user')).rejects.toThrow('not a member');
        await expect(f.set('inherit')).rejects.toMatchObject({ status: 400 });
        for (const patch of [{ teamId: otherTeam }, { type: 'private' }, { isArchived: true }]) {
            const old = { ...f.channels.get(a) };
            Object.assign(f.channels.get(a), patch);
            await expect(f.set('off', a)).rejects.toMatchObject({ status: 404 });
            Object.assign(f.channels.get(a), old);
        }
        expect(f.model.findOneAndUpdate).not.toHaveBeenCalled();
    });
    it('does not expose overrides after private access is revoked', async () => {
        const f = fixture();
        await f.set('off', a);
        f.channels.get(a).type = 'private';
        expect((await f.service.get(team, 'user')).channelModes).toEqual({});
        expect(await f.service.shouldDeliver(team, 'user', `message:${messageId}`)).toBe(false);
    });
    it('limits mentions mode to actual mentions, direct rooms and replies to the current user', async () => {
        const f = fixture();
        await f.set('mentions');
        const message = f.messages.get(messageId);
        expect(await f.service.shouldDeliver(team, 'user', `message:${messageId}`)).toBe(false);
        message.mentions = ['user'];
        expect(await f.service.shouldDeliver(team, 'user', `message:${messageId}`)).toBe(true);
        message.mentions = [];
        f.channels.get(a).type = 'dm';
        f.channels.get(a).isMember = () => true;
        expect(await f.service.shouldDeliver(team, 'user', `message:${messageId}`)).toBe(true);
        f.channels.get(a).type = 'public';
        f.messages.set(b, { teamId: team, channelId: a, authorId: 'user' });
        message.replyToId = b;
        expect(await f.service.shouldDeliver(team, 'user', `message:${messageId}`)).toBe(true);
    });
    it('uses the same room policy for raw messages and inbox events without modifying either record', async () => {
        const f = fixture();
        const notice = {
            teamId: team,
            recipientId: 'user',
            resourceType: 'message',
            resourceId: messageId,
            type: 'mention',
        };
        f.notices.set(noticeId, notice);
        await f.set('off', a);
        expect(await f.service.shouldDeliver(team, 'user', `notification:${noticeId}`)).toBe(false);
        expect(await f.service.shouldDeliver(team, 'user', `message:${messageId}`)).toBe(false);
        expect(f.notices.get(noticeId)).toBe(notice);
        await f.set('all', a);
        expect(await f.service.shouldDeliver(team, 'user', `notification:${noticeId}`)).toBe(true);
        notice.recipientId = 'someone-else';
        expect(await f.service.shouldDeliver(team, 'user', `notification:${noticeId}`)).toBe(false);
    });
    it('does not consume an atomic delivery claim when policy silences the notification', async () => {
        const claims = { claim: jest.fn() };
        const policy = { deliveryKey: jest.fn().mockResolvedValue(null) };
        const controller = new NotificationDeliveryController(
            claims as any,
            { requireMember: jest.fn() } as any,
            policy as any,
        );
        expect(await controller.claim(team, { userId: 'user' }, { key: `message:${messageId}` })).toEqual({
            deliver: false,
        });
        expect(claims.claim).not.toHaveBeenCalled();
    });

    it('inherits each category independently and resets only the selected room', async () => {
        const f = fixture();
        let value = await f.service.update(team, 'user', {
            revision: 0,
            kinds: { mention: false, thread: false, chat: false },
        });
        value = await f.service.update(team, 'user', {
            revision: value.revision,
            channelId: a,
            kinds: { mention: true, chat: true },
            mode: 'mentions',
        });
        value = await f.service.update(team, 'user', {
            revision: value.revision,
            channelId: b,
            kinds: { issue: false },
            mode: 'off',
        });
        f.messages.get(messageId).mentions = ['user'];
        expect(await f.service.shouldDeliver(team, 'user', `message:${messageId}`)).toBe(true);
        value = await f.service.update(team, 'user', {
            revision: value.revision,
            channelId: a,
            kinds: { mention: 'inherit' },
        });
        expect(await f.service.shouldDeliver(team, 'user', `message:${messageId}`)).toBe(false);
        value = await f.service.update(team, 'user', { revision: value.revision, channelId: a, reset: true });
        expect(value.mode).toBe('all');
        expect(value.kinds.mention).toBe(false);
        expect(value.channelModes).toEqual({ [b]: 'off' });
        expect(value.channelKinds).toEqual({ [b]: { issue: false } });
    });

    it.each(NOTIFICATION_KINDS)('gates %s on every applicable raw-message and inbox path', async (kind) => {
        const f = fixture();
        const message = f.messages.get(messageId);
        const notice = {
            teamId: team,
            recipientId: 'user',
            resourceId: messageId,
            resourceType: 'message',
            channelId: a,
            type: 'mention',
        };
        if (kind === 'mention') message.mentions = ['user'];
        if (kind === 'thread') message.replyToId = b;
        if (kind === 'issue' || kind === 'update') {
            f.issues.set(messageId, { teamId: team });
            notice.resourceType = 'issue';
            notice.type = kind === 'issue' ? 'issue_assigned' : 'issue_updated';
        }
        if (kind === 'document') {
            f.documents.set(messageId, { teamId: team, isArchived: false, canView: () => true });
            notice.resourceType = 'document';
            notice.type = 'document_assigned';
        }
        f.notices.set(noticeId, notice);
        expect(await f.service.shouldDeliver(team, 'user', `notification:${noticeId}`)).toBe(true);
        let saved = await f.service.update(team, 'user', { revision: 0, kinds: { [kind]: false } });
        expect(await f.service.shouldDeliver(team, 'user', `notification:${noticeId}`)).toBe(false);
        if (notice.resourceType === 'message')
            expect(await f.service.shouldDeliver(team, 'user', `message:${messageId}`)).toBe(false);
        saved = await f.service.update(team, 'user', {
            revision: saved.revision,
            channelId: a,
            kinds: { [kind]: true },
        });
        expect(await f.service.shouldDeliver(team, 'user', `notification:${noticeId}`)).toBe(true);
        expect(await f.resources.filterVisible(team, 'user', [notice])).toEqual([notice]);
    });

    it('classifies mentions inside threads identically and normalizes alternate claim keys', async () => {
        const f = fixture();
        Object.assign(f.messages.get(messageId), { mentions: ['user'], replyToId: b });
        f.notices.set(noticeId, {
            teamId: team,
            recipientId: 'user',
            resourceType: 'message',
            resourceId: messageId,
            type: 'thread_reply',
            channelId: a,
        });
        expect(await f.service.deliveryKey(team, 'user', `notification:${noticeId}`)).toBe(`message:${messageId}`);
        await f.service.update(team, 'user', { revision: 0, kinds: { mention: false, thread: true, chat: true } });
        expect(await f.service.deliveryKey(team, 'user', `notification:${noticeId}`)).toBeNull();
        expect(await f.service.deliveryKey(team, 'user', `message:${messageId}`)).toBeNull();
    });

    it('omits private category metadata without erasing stored overrides and rejects malformed updates', async () => {
        const f = fixture();
        await f.service.update(team, 'user', { revision: 0, channelId: a, kinds: { chat: false } });
        f.channels.get(a).type = 'private';
        expect((await f.service.get(team, 'user')).channelKinds).toEqual({});
        for (const input of [
            { kinds: { mention: 'inherit' } },
            { kinds: { unknown: true } },
            { kinds: {} },
            { kinds: { chat: 'false' } },
            { kinds: [] },
            { kinds: null },
            { channelId: '' },
            { mode: null },
            { reset: true },
            { channelId: b, reset: true, mode: 'off' },
            { revision: Number.MAX_SAFE_INTEGER, mode: 'off' },
        ])
            await expect(f.service.update(team, 'user', { revision: 1, ...input } as any)).rejects.toMatchObject({
                status: 400,
            });
        f.channels.get(a).type = 'public';
        expect((await f.service.get(team, 'user')).channelKinds).toEqual({ [a]: { chat: false } });
    });

    it('rejects concurrent category edits at a nonzero revision without losing the winning edit', async () => {
        const f = fixture();
        await f.set('mentions');
        const results = await Promise.allSettled([
            f.service.update(team, 'user', { revision: 1, channelId: a, kinds: { mention: false } }),
            f.service.update(team, 'user', { revision: 1, channelId: b, kinds: { thread: false } }),
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
        const saved = await f.service.get(team, 'user');
        expect(saved.revision).toBe(2);
        expect(Object.keys(saved.channelKinds)).toHaveLength(1);
    });

    it('rechecks workspace, resource and private channel visibility for inbox metadata as well as delivery', async () => {
        const f = fixture();
        const notice = {
            teamId: team,
            recipientId: 'user',
            resourceType: 'message',
            resourceId: messageId,
            channelId: a,
            type: 'mention',
        };
        f.notices.set(noticeId, notice);
        f.channels.get(a).type = 'private';
        expect(await f.resources.filterVisible(team, 'user', [notice])).toEqual([]);
        expect(await f.service.shouldDeliver(team, 'user', `notification:${noticeId}`)).toBe(false);
        f.channels.get(a).isMember = () => true;
        expect(await f.resources.filterVisible(team, 'user', [notice])).toEqual([notice]);
        notice.channelId = b;
        expect(await f.resources.filterVisible(team, 'user', [notice])).toEqual([]);
        notice.channelId = a;
        notice.resourceType = 'document';
        const canView = jest.fn().mockReturnValue(false);
        f.documents.set(messageId, { teamId: team, canView, isArchived: false });
        expect(await f.resources.filterVisible(team, 'user', [notice])).toEqual([]);
        expect(canView).toHaveBeenCalledWith('user', 'member');
        canView.mockReturnValue(true);
        expect(await f.resources.filterVisible(team, 'user', [notice])).toEqual([notice]);
        f.documents.get(messageId).isArchived = true;
        expect(await f.service.shouldDeliver(team, 'user', `notification:${noticeId}`)).toBe(false);
        notice.resourceType = 'issue';
        f.issues.set(messageId, { teamId: otherTeam });
        expect(await f.resources.filterVisible(team, 'user', [notice])).toEqual([]);
    });
});
