import { io, type Socket } from "socket.io-client";
import type { ApiClient } from "../api/client";
import { PAGE_SIZE } from "../api/client";
import { messageSchema, type Message } from "../api/contracts";
import { AppError } from "../api/errors";

export type Delivery = "sending" | "failed" | "uncertain";
export type Outgoing = { id: string; content: string; delivery: Delivery };
export type ChatState = {
  connection: "connecting" | "syncing" | "online" | "offline" | "denied";
  messages: Message[];
  outbox: Outgoing[];
  loading: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  error?: AppError;
};
export type SocketFactory = (url: string, token: string) => Socket;
export const createChatSocket: SocketFactory = (url, token) =>
  io(`${url}/chat`, {
    autoConnect: false,
    auth: { token },
    transports: ["websocket"],
    withCredentials: false,
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    // Do not enable retries: the server has no idempotency key.
  });

export function mergeMessages(...groups: Message[][]): Message[] {
  const items = new Map<string, Message>();
  for (const group of groups)
    for (const item of group) items.set(item.id, item);
  return [...items.values()].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

export class ChatModel {
  private state: ChatState = {
    connection: "connecting",
    messages: [],
    outbox: [],
    loading: true,
    loadingOlder: false,
    hasMore: false,
  };
  private listeners = new Set<() => void>();
  private socket?: Socket;
  private joined = false;
  private writable = false;
  private joinTimer?: ReturnType<typeof setTimeout>;
  private request?: AbortController;
  private olderRequest?: AbortController;
  private liveDuringLoad: Message[] = [];
  private deletedIds = new Set<string>();
  private inFlight?: { id: string; attempt: number };
  private attempt = 0;
  private sequence = 0;
  private active = false;

  constructor(
    private readonly api: ApiClient,
    private readonly token: () => string | null,
    readonly teamId: string,
    readonly channelId: string,
    private readonly userId: string,
    private readonly factory: SocketFactory = createChatSocket,
  ) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<ChatState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  setWritable(writable: boolean) {
    this.writable = writable;
  }

  start() {
    if (this.active || !this.token()) return;
    this.active = true;
    this.update({ connection: "connecting", error: undefined });
    const socket = this.factory(this.api.config.socketUrl, this.token()!);
    this.socket = socket;
    socket.on("connect", () => {
      this.joined = false;
      this.update({ connection: "syncing" });
      socket.emit("join_channel", { channelId: this.channelId });
      clearTimeout(this.joinTimer);
      this.joinTimer = setTimeout(() => {
        if (!this.joined) {
          this.update({
            connection: "offline",
            loading: false,
            error: new AppError("timeout"),
          });
          // Verify authentication with HTTP; raw socket errors cannot invalidate a session.
          void this.api.me().catch(() => undefined);
        }
      }, 12_000);
    });
    socket.on("joined_channel", (payload: unknown) => {
      if (
        !payload ||
        typeof payload !== "object" ||
        !("channelId" in payload) ||
        payload.channelId !== this.channelId
      )
        return;
      clearTimeout(this.joinTimer);
      this.joined = true;
      void this.reload();
    });
    const receive = (payload: unknown) => {
      const parsed = messageSchema.safeParse(payload);
      if (
        !parsed.success ||
        parsed.data.teamId !== this.teamId ||
        parsed.data.channelId !== this.channelId ||
        this.deletedIds.has(parsed.data.id)
      )
        return;
      if (this.request)
        this.liveDuringLoad = mergeMessages(this.liveDuringLoad, [parsed.data]);
      this.update({
        messages: mergeMessages(this.state.messages, [parsed.data]),
      });
    };
    socket.on("new_message", receive);
    socket.on("reaction_updated", receive);
    socket.on("pinned_message_updated", receive);
    socket.on("message_deleted", (payload: unknown) => {
      if (
        !payload ||
        typeof payload !== "object" ||
        !("messageId" in payload) ||
        typeof payload.messageId !== "string"
      )
        return;
      this.deletedIds.add(payload.messageId);
      this.liveDuringLoad = this.liveDuringLoad.filter(
        (item) => item.id !== payload.messageId,
      );
      this.update({
        messages: this.state.messages.filter(
          (item) => item.id !== payload.messageId,
        ),
      });
    });
    socket.on("disconnect", () => {
      this.joined = false;
      clearTimeout(this.joinTimer);
      this.uncertain();
      this.update({ connection: "offline" });
    });
    socket.on("connect_error", () => {
      this.update({
        connection: "offline",
        loading: false,
        error: new AppError("network"),
      });
      void this.api.me().catch(() => undefined);
    });
    socket.on("error", () => {
      this.uncertain();
      if (!this.joined) {
        this.update({
          connection: "offline",
          loading: false,
          error: new AppError("request"),
        });
      }
      void this.reload();
      void this.api.me().catch(() => undefined);
    });
    socket.connect();
  }

  stop() {
    this.active = false;
    this.joined = false;
    clearTimeout(this.joinTimer);
    this.request?.abort();
    this.request = undefined;
    this.olderRequest?.abort();
    this.olderRequest = undefined;
    this.uncertain();
    if (this.socket) {
      this.socket.emit("leave_channel", { channelId: this.channelId });
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = undefined;
    }
    this.update({ connection: "offline", loading: false, loadingOlder: false });
  }
  clear() {
    this.stop();
    this.deletedIds.clear();
    this.liveDuringLoad = [];
    this.update({ messages: [], outbox: [], hasMore: false, error: undefined });
  }
  reconnect() {
    this.stop();
    this.start();
  }
  private uncertain() {
    if (!this.inFlight) return;
    const { id } = this.inFlight;
    this.inFlight = undefined;
    this.update({
      outbox: this.state.outbox.map((item) =>
        item.id === id ? { ...item, delivery: "uncertain" } : item,
      ),
    });
  }
  private accessError(error: unknown) {
    if (error instanceof AppError && error.code === "forbidden") {
      this.writable = false;
      this.stop();
      this.update({
        connection: "denied",
        messages: [],
        outbox: [],
        error,
        hasMore: false,
      });
    } else if (!(error instanceof AppError && error.code === "aborted")) {
      this.update({
        error: error instanceof AppError ? error : new AppError("network"),
        loading: false,
      });
    }
  }

  async reload() {
    this.request?.abort();
    this.olderRequest?.abort();
    const controller = new AbortController();
    this.request = controller;
    this.liveDuringLoad = [];
    this.update({ loading: true, loadingOlder: false, error: undefined });
    try {
      const messages = await this.api.messages(
        this.channelId,
        undefined,
        controller.signal,
      );
      if (controller.signal.aborted || this.request !== controller) return;
      // Reload the latest window after reconnect, then page older messages on demand.
      // Retaining stale pages here would hide gaps and remotely removed messages.
      this.update({
        messages: mergeMessages(
          messages.filter(
            (m) =>
              m.channelId === this.channelId &&
              m.teamId === this.teamId &&
              !this.deletedIds.has(m.id),
          ),
          this.liveDuringLoad,
        ),
        hasMore: messages.length === PAGE_SIZE,
        loading: false,
        connection: this.joined ? "online" : "offline",
      });
    } catch (error) {
      if (!controller.signal.aborted) this.accessError(error);
    } finally {
      if (this.request === controller) this.request = undefined;
    }
  }

  async loadOlder() {
    const before = this.state.messages[0]?.createdAt;
    if (
      !before ||
      !this.state.hasMore ||
      this.state.loading ||
      this.state.loadingOlder
    )
      return;
    const controller = new AbortController();
    this.olderRequest = controller;
    this.update({ loadingOlder: true, error: undefined });
    try {
      const messages = await this.api.messages(
        this.channelId,
        before,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      this.update({
        messages: mergeMessages(
          messages.filter(
            (m) =>
              m.channelId === this.channelId &&
              m.teamId === this.teamId &&
              !this.deletedIds.has(m.id),
          ),
          this.state.messages,
        ),
        hasMore:
          messages.length === PAGE_SIZE &&
          messages.some((m) => m.createdAt < before),
        loadingOlder: false,
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        this.accessError(error);
        this.update({ loadingOlder: false });
      }
    } finally {
      if (this.olderRequest === controller) this.olderRequest = undefined;
    }
  }

  send(content: string): boolean {
    const trimmed = content.trim();
    if (
      !trimmed ||
      trimmed.length > 8000 ||
      !this.writable ||
      this.inFlight ||
      this.state.outbox.length >= 20
    )
      return false;
    const outgoing: Outgoing = {
      id: `local-${++this.sequence}`,
      content: trimmed,
      delivery: "failed",
    };
    this.update({ outbox: [...this.state.outbox, outgoing] });
    this.transmit(outgoing);
    return true;
  }
  retry(id: string, confirmedUncertain = false) {
    const outgoing = this.state.outbox.find((item) => item.id === id);
    if (
      !outgoing ||
      !this.writable ||
      this.inFlight ||
      outgoing.delivery === "sending" ||
      (outgoing.delivery === "uncertain" && !confirmedUncertain)
    )
      return;
    this.transmit(outgoing);
  }
  discard(id: string) {
    this.update({
      outbox: this.state.outbox.filter(
        (item) => item.id !== id || item.delivery === "sending",
      ),
    });
  }
  private transmit(outgoing: Outgoing) {
    const socket = this.socket;
    if (
      !socket?.connected ||
      !this.joined ||
      this.state.connection !== "online"
    )
      return;
    const flight = { id: outgoing.id, attempt: ++this.attempt };
    this.inFlight = flight;
    this.update({
      outbox: this.state.outbox.map((item) =>
        item.id === outgoing.id ? { ...item, delivery: "sending" } : item,
      ),
    });
    socket.timeout(12_000).emit(
      "send_message",
      {
        teamId: this.teamId,
        channelId: this.channelId,
        content: outgoing.content,
      },
      (error: Error | null, response: unknown) => {
        if (!this.active || socket !== this.socket) return;
        if (error) {
          if (this.inFlight === flight) this.uncertain();
          return;
        }
        const data =
          response &&
          typeof response === "object" &&
          "success" in response &&
          response.success === true &&
          "data" in response
            ? messageSchema.safeParse(response.data)
            : undefined;
        if (
          !data?.success ||
          data.data.teamId !== this.teamId ||
          data.data.channelId !== this.channelId ||
          data.data.authorId !== this.userId
        ) {
          if (this.inFlight === flight) this.uncertain();
          return;
        }
        if (this.inFlight === flight) this.inFlight = undefined;
        const confirmed = this.deletedIds.has(data.data.id) ? [] : [data.data];
        if (this.request)
          this.liveDuringLoad = mergeMessages(this.liveDuringLoad, confirmed);
        this.update({
          messages: mergeMessages(this.state.messages, confirmed),
          outbox: this.state.outbox.filter((item) => item.id !== outgoing.id),
        });
      },
    );
  }
}
