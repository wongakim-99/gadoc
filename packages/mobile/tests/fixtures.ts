import type { Message, User } from "../src/api/contracts";
import type { TokenStorage } from "../src/auth/token-storage";

// Synthetic values only. No production users, tokens or content.
export const user: User = {
  id: "user-1",
  username: "테스트 팀원",
  email: "member@example.test",
  avatarUrl: null,
};
export const team = {
  id: "team-1",
  name: "테스트 워크스페이스",
  slug: "test",
  description: "격리된 테스트",
  memberCount: 2,
};
export const channel = {
  id: "channel-1",
  teamId: team.id,
  name: "일반",
  type: "public" as const,
  isArchived: false,
};
export const member = { userId: user.id, role: "member" as const, user };
export const date = "2026-10-28T01:00:00.000Z";
export const documentNode = {
  id: "doc-1",
  teamId: team.id,
  title: "테스트 문서",
  parentId: null,
  contentFormat: "json" as const,
  updatedAt: date,
};
export const issue = {
  id: "issue-1",
  teamId: team.id,
  title: "테스트 이슈",
  description: "**내용**\n\n- [ ] 확인",
  status: "todo" as const,
  priority: "high" as const,
  assigneeIds: [user.id],
  labels: ["모바일"],
  updatedAt: date,
};
export function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "message-1",
    teamId: team.id,
    channelId: channel.id,
    authorId: user.id,
    authorName: user.username,
    content: "테스트 메시지",
    replyToId: null,
    isEdited: false,
    createdAt: date,
    updatedAt: date,
    attachments: [],
    ...overrides,
  };
}
export function memoryStorage(
  initial: string | null = null,
): TokenStorage & { value: () => string | null } {
  let value = initial;
  return {
    value: () => value,
    get: jest.fn(async () => value),
    set: jest.fn(async (token) => {
      value = token;
    }),
    clear: jest.fn(async () => {
      value = null;
    }),
  };
}
export function response(data?: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}
export function envelope(data: unknown) {
  return response({ success: true, data });
}
export const testConfig = {
  apiUrl: "https://example.test/api",
  socketUrl: "https://example.test",
};
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
