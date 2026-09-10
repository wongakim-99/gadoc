import { beforeEach, expect, it } from 'vitest';
import { useHuddleStore } from './huddle.store';

beforeEach(() => useHuddleStore.getState().leave());
it('retains a remote stream that arrives before the participant list', () => {
    const stream = {} as MediaStream;
    useHuddleStore.getState().setParticipantStream('peer', stream);
    useHuddleStore.getState().setParticipants([{ userId: 'peer', audio: false, video: true }]);
    expect(useHuddleStore.getState().participants).toEqual([{ userId: 'peer', audio: false, video: true, stream }]);
});
