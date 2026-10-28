import { ApiClient, defaultTransport, type HttpTransport } from "./api/client";
import { runtimeConfig, type RuntimeConfig } from "./api/config";
import { Session } from "./auth/session";
import { createTokenStorage, type TokenStorage } from "./auth/token-storage";
import { ChatModel } from "./chat/model";

export function createServices(
  config: RuntimeConfig = runtimeConfig(
    process.env.EXPO_PUBLIC_API_URL,
    __DEV__,
  ),
  storage: TokenStorage = createTokenStorage(),
  transport: HttpTransport = defaultTransport,
) {
  const session = new Session(storage);
  const api = new ApiClient(
    config,
    session.getToken,
    session.invalidate,
    transport,
  );
  session.api = api;
  const chats = new Map<string, ChatModel>();
  session.subscribe(() => {
    if (session.snapshot().kind !== "ready") {
      chats.forEach((chat) => chat.clear());
      chats.clear();
    }
  });
  return {
    api,
    session,
    chat(teamId: string, channelId: string, userId: string) {
      const key = `${teamId}:${channelId}`;
      if (!chats.has(key))
        chats.set(
          key,
          new ChatModel(api, session.getToken, teamId, channelId, userId),
        );
      return chats.get(key)!;
    },
  };
}
export type Services = ReturnType<typeof createServices>;
