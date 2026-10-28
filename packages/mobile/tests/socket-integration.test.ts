import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { ApiClient } from "../src/api/client";
import { ChatModel } from "../src/chat/model";
import { channel, envelope, message, team, user } from "./fixtures";

// A real local Socket.IO transport. No MongoDB, production URL or user credentials.
test("native chat model authenticates and exchanges events/acks through a real isolated Socket.IO server", async () => {
  const http = createServer();
  const server = new Server(http, { serveClient: false });
  const chat = server.of("/chat");
  const received: unknown[] = [];
  let handshake: Record<string, unknown> | undefined;
  chat.use((socket, next) => {
    handshake = socket.handshake.auth;
    if (socket.handshake.auth.token !== "synthetic-local")
      next(new Error("Unauthorized"));
    else next();
  });
  chat.on("connection", (socket) => {
    socket.on("join_channel", async (payload) => {
      await socket.join(`channel:${payload.channelId}`);
      socket.emit("joined_channel", { channelId: payload.channelId });
    });
    socket.on("send_message", (payload, ack) => {
      received.push(payload);
      const data = message({
        id: "from-local-server",
        content: payload.content,
      });
      chat.to(`channel:${channel.id}`).emit("new_message", data);
      ack({ success: true, data });
    });
  });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  const api = new ApiClient(
    { apiUrl: `${origin}/api`, socketUrl: origin },
    () => "synthetic-local",
    jest.fn(),
    async () => envelope([]),
  );
  const model = new ChatModel(
    api,
    () => "synthetic-local",
    team.id,
    channel.id,
    user.id,
  );
  const until = (predicate: () => boolean) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error("local transport timed out"));
      }, 4000);
      const unsubscribe = model.subscribe(() => {
        if (predicate()) {
          clearTimeout(timer);
          unsubscribe();
          resolve();
        }
      });
      if (predicate()) {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  try {
    model.setWritable(true);
    model.start();
    await until(() => model.snapshot().connection === "online");
    expect(handshake).toEqual({ token: "synthetic-local" });
    expect(model.send("로컬 전송 검증")).toBe(true);
    await until(
      () =>
        model.snapshot().messages.length === 1 &&
        model.snapshot().outbox.length === 0,
    );
    expect(received).toEqual([
      { teamId: team.id, channelId: channel.id, content: "로컬 전송 검증" },
    ]);
    expect(model.snapshot().messages[0]?.id).toBe("from-local-server");
  } finally {
    model.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 10_000);
