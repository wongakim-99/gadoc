'use client';

import { useEffect, useRef, useState } from 'react';
import type { HuddleParticipant } from '../model/huddle.store';

function ParticipantAudio({ participant }: { participant: HuddleParticipant }) {
    const ref = useRef<HTMLAudioElement>(null);
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        let active = true;
        element.srcObject = participant.stream ?? null;
        if (participant.stream) {
            void element
                .play()
                .then(() => {
                    if (active) setBlocked(false);
                })
                .catch(() => {
                    if (active) setBlocked(true);
                });
        }
        return () => {
            active = false;
            element.srcObject = null;
        };
    }, [participant.stream]);

    return (
        <>
            <audio ref={ref} autoPlay data-huddle-audio={participant.userId} />
            {blocked && (
                <button
                    type="button"
                    className="px-4 py-2 text-sm text-white"
                    onClick={() => {
                        void ref.current
                            ?.play()
                            .then(() => setBlocked(false))
                            .catch(() => setBlocked(true));
                    }}
                >
                    통화 소리 재생
                </button>
            )}
        </>
    );
}

export function HuddleAudio({ participants }: { participants: HuddleParticipant[] }) {
    return (
        <>
            {participants.map((participant) => (
                <ParticipantAudio key={participant.userId} participant={participant} />
            ))}
        </>
    );
}
