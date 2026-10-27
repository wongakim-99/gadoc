import type { Page } from "playwright/test";
import { createRequire } from "node:module";

const { DocumentCodec } = createRequire(__filename)(
  "../../../packages/server/dist/modules/document/collaboration/document-codec.js",
);
type DocumentSnapshot = {
  content: string;
  contentFormat: string;
  title: string;
  updatedAt: string;
  canEdit: boolean;
};

/** Exercise the real CRDT codec while replacing only the network/database boundary. */
export async function mockDocumentSocket(
  page: Page,
  get: () => DocumentSnapshot,
  save: (content: string) => Promise<void>,
) {
  const codec = new DocumentCodec();
  let state: Buffer | undefined;
  await page.routeWebSocket(/\/socket\.io\//, (socket) => {
    socket.send(
      "0" +
        JSON.stringify({
          sid: "document-fixture",
          upgrades: [],
          pingInterval: 25000,
          pingTimeout: 20000,
          maxPayload: 1_000_000,
        }),
    );
    let pending: string | null = null;
    socket.onMessage(async (message) => {
      if (typeof message !== "string") {
        if (pending === null) return;
        const ack = pending;
        pending = null;
        try {
          const next = await codec.process({
            ...get(),
            state,
            update: message,
          });
          await save(next.content);
          state = next.state;
          socket.send(
            `43/document,${ack}[${JSON.stringify({ ok: true, updatedAt: get().updatedAt })}]`,
          );
        } catch {
          socket.send(
            `43/document,${ack}[{"ok":false,"message":"시험용 저장 실패"}]`,
          );
        }
        return;
      }
      const connect = message.match(/^40([^,]*),/);
      if (connect) {
        socket.send(`40${connect[1]},{"sid":"fixture"}`);
        return;
      }
      const binary = message.match(/^451-\/document,(\d+)/);
      if (binary) {
        pending = binary[1];
        return;
      }
      const event = message.match(/^42\/document,(\d+)(\[.*)$/);
      if (!event) return;
      const [, ack, payload] = event;
      const [name] = JSON.parse(payload);
      if (name === "document:join") {
        try {
          const snapshot = await codec.process({ ...get(), state });
          state = snapshot.state;
          socket.send(
            `43/document,${ack}[${JSON.stringify({ ok: true, ...get(), update: [...state!], user: { name: "검토 사용자", color: "#61a8ff" }, peers: [] })}]`,
          );
        } catch {
          socket.send(
            `43/document,${ack}[{"ok":false,"message":"본문을 편집기로 불러오지 못했습니다. 원본은 변경하지 않았습니다."}]`,
          );
        }
      } else socket.send(`43/document,${ack}[{"ok":true}]`);
    });
  });
}

export async function failDocumentUpdates(
  page: Page,
  shouldFail: () => boolean,
) {
  await page.routeWebSocket(/\/socket\.io\//, (client) => {
    const server = client.connectToServer();
    let dropBinary = false;
    client.onMessage((message) => {
      if (typeof message === "string") {
        const event = message.match(/^451-\/document,(\d+)\["document:update"/);
        if (event && shouldFail()) {
          dropBinary = true;
          client.send(
            `43/document,${event[1]}[{"ok":false,"message":"시험용 저장 실패"}]`,
          );
          return;
        }
      } else if (dropBinary) {
        dropBinary = false;
        return;
      }
      server.send(message);
    });
  });
}
