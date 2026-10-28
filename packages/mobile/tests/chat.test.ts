import type { Socket } from "socket.io-client";
import type { ApiClient } from "../src/api/client";
import { AppError } from "../src/api/errors";
import { ChatModel } from "../src/chat/model";
import {
  channel,
  date,
  deferred,
  message,
  team,
  testConfig,
  user,
} from "./fixtures";

class TestSocket {
  connected = true;
  handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  sent: {
    name: string;
    payload: unknown;
    ack?: (error: Error | null, payload?: unknown) => void;
  }[] = [];
  on(name: string, handler: (...args: unknown[]) => void) {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), handler]);
    return this;
  }
  fire(name: string, ...args: unknown[]) {
    this.handlers.get(name)?.forEach((handler) => handler(...args));
  }
  emit(
    name: string,
    payload: unknown,
    ack?: (error: Error | null, payload?: unknown) => void,
  ) {
    this.sent.push({ name, payload, ack });
    return this;
  }
  timeout() {
    return this;
  }
  connect() {
    this.connected = true;
    this.fire("connect");
    return this;
  }
  disconnect() {
    this.connected = false;
    return this;
  }
  removeAllListeners() {
    this.handlers.clear();
    return this;
  }
}
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
let models: ChatModel[] = [];
afterEach(() => {
  models.forEach((model) => model.stop());
  models = [];
});
async function setup(messages = [message()]) {
  const socket = new TestSocket();
  const api = {
    config: testConfig,
    messages: jest.fn().mockResolvedValue(messages),
    me: jest.fn().mockResolvedValue(user),
  };
  const model = new ChatModel(
    api as unknown as ApiClient,
    () => "synthetic",
    team.id,
    channel.id,
    user.id,
    () => socket as unknown as Socket,
  );
  models.push(model);
  model.setWritable(true);
  model.start();
  socket.fire("joined_channel", { channelId: channel.id });
  await flush();
  return { socket, api, model };
}

test("room joins follow the actual event contract and reconnect reloads the latest chronological window", async () => {
  const { socket, api, model } = await setup();
  expect(socket.sent[0]).toEqual({
    name: "join_channel",
    payload: { channelId: channel.id },
    ack: undefined,
  });
  expect(model.snapshot().connection).toBe("online");
  socket.fire(
    "new_message",
    message({ id: "new", createdAt: "2026-10-28T02:00:00.000Z" }),
  );
  socket.fire("new_message", message({ id: "wrong-room", channelId: "other" }));
  expect(model.snapshot().messages.map((item) => item.id)).toEqual([
    "message-1",
    "new",
  ]);
  socket.fire("disconnect");
  expect(model.snapshot().connection).toBe("offline");
  api.messages.mockResolvedValueOnce([message({ id: "latest" })]);
  socket.fire("connect");
  socket.fire("joined_channel", { channelId: channel.id });
  await flush();
  expect(model.snapshot().messages.map((item) => item.id)).toEqual(["latest"]);
  expect(
    socket.sent.filter((event) => event.name === "send_message"),
  ).toHaveLength(0);
});

test("broadcast plus acknowledgement deduplicates by server id, without matching equal message text", async () => {
  const { socket, model } = await setup([]);
  expect(model.send("새 대화")).toBe(true);
  const emission = socket.sent.find((item) => item.name === "send_message")!;
  expect(emission.payload).toEqual({
    teamId: team.id,
    channelId: channel.id,
    content: "새 대화",
  });
  const sent = message({ content: "새 대화" });
  socket.fire("new_message", sent);
  emission.ack!(null, { success: true, data: sent });
  expect(model.snapshot().messages).toHaveLength(1);
  expect(model.snapshot().outbox).toHaveLength(0);
  socket.fire(
    "new_message",
    message({ id: "equal-text-distinct-message", content: "새 대화" }),
  );
  expect(model.snapshot().messages).toHaveLength(2);
});

test("ambiguous timeouts never auto resend and require explicit confirmation for retry", async () => {
  const { socket, model } = await setup([]);
  model.send("확인할 대화");
  socket.sent.find((item) => item.name === "send_message")!.ack!(
    new Error("timeout"),
  );
  const outgoing = model.snapshot().outbox[0]!;
  expect(outgoing.delivery).toBe("uncertain");
  model.retry(outgoing.id);
  expect(
    socket.sent.filter((event) => event.name === "send_message"),
  ).toHaveLength(1);
  model.retry(outgoing.id, true);
  expect(
    socket.sent.filter((event) => event.name === "send_message"),
  ).toHaveLength(2);
  socket.fire("disconnect");
  expect(model.snapshot().outbox[0]?.delivery).toBe("uncertain");
});

test("offline attempts remain retryable in memory, while guest and archived access cannot send", async () => {
  const { socket, model } = await setup([]);
  socket.connected = false;
  socket.fire("disconnect");
  expect(model.send("오프라인 초안")).toBe(true);
  expect(model.snapshot().outbox[0]?.delivery).toBe("failed");
  expect(
    socket.sent.filter((item) => item.name === "send_message"),
  ).toHaveLength(0);
  model.setWritable(false);
  expect(model.send("읽기 전용")).toBe(false);
  model.retry(model.snapshot().outbox[0]!.id);
  expect(
    socket.sent.filter((item) => item.name === "send_message"),
  ).toHaveLength(0);
});

test("older history uses the earliest ISO timestamp and a permission denial clears private history without logging out", async () => {
  const messages = Array.from({ length: 50 }, (_, index) =>
    message({
      id: `m-${index}`,
      createdAt: new Date(Date.parse(date) + index * 1000).toISOString(),
    }),
  );
  const { api, model } = await setup(messages);
  api.messages.mockResolvedValueOnce([
    message({ id: "older", createdAt: "2026-10-27T01:00:00.000Z" }),
  ]);
  await model.loadOlder();
  expect(api.messages).toHaveBeenLastCalledWith(
    channel.id,
    date,
    expect.any(AbortSignal),
  );
  expect(model.snapshot().messages[0]?.id).toBe("older");
  expect(model.snapshot().hasMore).toBe(false);
  api.messages.mockRejectedValueOnce(new AppError("forbidden", 403));
  await model.reload();
  expect(model.snapshot()).toMatchObject({
    connection: "denied",
    messages: [],
    outbox: [],
  });
  expect(api.me).not.toHaveBeenCalled();
});

test("in-flight history cannot overwrite live messages, and stop prevents stale responses from restoring data", async () => {
  const { socket, api, model } = await setup();
  const pending = deferred<ReturnType<typeof message>[]>();
  api.messages.mockReturnValueOnce(pending.promise);
  const refresh = model.reload();
  socket.fire(
    "new_message",
    message({ id: "live", createdAt: "2026-10-28T03:00:00.000Z" }),
  );
  pending.resolve([message()]);
  await refresh;
  expect(model.snapshot().messages.map((item) => item.id)).toEqual([
    "message-1",
    "live",
  ]);
  const stale = deferred<ReturnType<typeof message>[]>();
  api.messages.mockReturnValueOnce(stale.promise);
  const old = model.reload();
  model.clear();
  stale.resolve([message({ id: "must-not-reappear" })]);
  await old;
  expect(model.snapshot().messages).toHaveLength(0);
});

test("a deleted message cannot be resurrected by an older history response", async () => {
  const { socket, api, model } = await setup();
  const pending = deferred<ReturnType<typeof message>[]>();
  api.messages.mockReturnValueOnce(pending.promise);
  const refresh = model.reload();
  socket.fire("message_deleted", { messageId: "message-1" });
  pending.resolve([message()]);
  await refresh;
  expect(model.snapshot().messages).toHaveLength(0);
});

test("a previous attempt callback cannot change the delivery state of an explicit retry", async () => {
  const { socket, model } = await setup([]);
  model.send("전송 시도");
  const old = socket.sent.find((item) => item.name === "send_message")!;
  old.ack!(new Error("timeout"));
  model.retry(model.snapshot().outbox[0]!.id, true);
  old.ack!(new Error("late old callback"));
  expect(model.snapshot().outbox[0]?.delivery).toBe("sending");
});
