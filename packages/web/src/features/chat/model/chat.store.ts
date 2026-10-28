import { create } from 'zustand';
import type { Message } from '@/src/entities/message/types';

interface ChatState {
    messages: Message[];
    typingUsers: string[];
    isLoading: boolean;

    setMessages: (msgs: Message[]) => void;
    prependMessages: (msgs: Message[]) => void;
    addMessage: (msg: Message) => void;
    updateMessage: (id: string, patch: Partial<Message>) => void;
    removeMessage: (id: string) => void;
    setTypingUsers: (users: string[]) => void;
    setLoading: (v: boolean) => void;
    reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    typingUsers: [],
    isLoading: false,

    setMessages: (messages) => set({ messages: mergeHistory([], messages) }),
    prependMessages: (msgs) => set((s) => ({ messages: mergeHistory(msgs, s.messages) })),
    addMessage: (msg) =>
        set((s) => ({
            messages: s.messages.some((message) => message.id === msg.id)
                ? s.messages.map((message) => (message.id === msg.id ? { ...message, ...msg } : message))
                : [...s.messages, msg],
        })),
    updateMessage: (id, patch) =>
        set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
    removeMessage: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
    setTypingUsers: (typingUsers) => set({ typingUsers }),
    setLoading: (isLoading) => set({ isLoading }),
    reset: () => set({ messages: [], typingUsers: [], isLoading: false }),
}));

function mergeHistory(older: Message[], current: Message[]): Message[] {
    // A thread fetch or socket update may have landed since the history request began.
    // Merge against the live store inside set(), not the request's captured ID list.
    const unique = new Map(older.map((message) => [message.id, message]));
    for (const message of current) {
        const previous = unique.get(message.id);
        if (!previous || Date.parse(message.updatedAt) >= Date.parse(previous.updatedAt))
            unique.set(message.id, message);
    }
    return [...unique.values()].sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id),
    );
}
