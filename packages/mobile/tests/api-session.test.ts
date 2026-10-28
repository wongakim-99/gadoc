import * as SecureStore from "expo-secure-store";
import { jest } from "@jest/globals";
import { ApiClient, type HttpTransport } from "../src/api/client";
import { runtimeConfig } from "../src/api/config";
import { AppError, errorCopy } from "../src/api/errors";
import { createTokenStorage } from "../src/auth/token-storage";
import { createServices } from "../src/services";
import {
  date,
  deferred,
  envelope,
  memoryStorage,
  message,
  response,
  testConfig,
  user,
} from "./fixtures";

test("production HTTPS defaults and development local endpoints never accept credentials, query tokens or arbitrary cleartext", () => {
  expect(runtimeConfig(undefined, false)).toEqual({
    apiUrl: "https://gadoc.kr/api",
    socketUrl: "https://gadoc.kr",
  });
  expect(runtimeConfig("http://10.0.2.2:18094/api", true).socketUrl).toBe(
    "http://10.0.2.2:18094",
  );
  for (const value of [
    "http://gadoc.kr/api",
    "https://user:pass@example.test/api",
    "https://example.test/api?token=x",
    "https://example.test/",
  ]) {
    expect(() => runtimeConfig(value, true)).toThrow(
      "서버 주소 설정을 확인해 주세요.",
    );
  }
  expect(() => runtimeConfig("http://127.0.0.1:18094/api", false)).toThrow();
});

test("API unwraps the server envelope, uses bearer headers and ISO cursor with the fixed page size", async () => {
  const transport = jest
    .fn<HttpTransport>()
    .mockResolvedValue(envelope([message()]));
  const api = new ApiClient(
    testConfig,
    () => "synthetic",
    jest.fn(),
    transport,
  );
  expect(await api.messages("channel/1", date)).toHaveLength(1);
  expect(transport).toHaveBeenCalledWith(
    `https://example.test/api/channel/channel%2F1/message?limit=50&before=${encodeURIComponent(date)}`,
    expect.objectContaining({
      credentials: "omit",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer synthetic",
      },
    }),
  );
});

test("malformed envelopes and error bodies cannot surface request contents in errors", async () => {
  const transport = jest
    .fn<HttpTransport>()
    .mockResolvedValue(
      response({ success: true, data: { privateField: "must-not-appear" } }),
    );
  const api = new ApiClient(testConfig, () => null, jest.fn(), transport);
  await expect(api.teams()).rejects.toMatchObject({
    code: "invalid",
    message: "invalid",
  });
  transport.mockResolvedValue(response({ message: "must-not-appear" }, 500));
  try {
    await api.teams();
  } catch (error) {
    expect(errorCopy(error)).not.toContain("must-not-appear");
    expect(JSON.stringify(error)).not.toContain("must-not-appear");
  }
});

test("native token storage uses device-only Keychain accessibility and a dedicated namespace", async () => {
  const storage = createTokenStorage();
  await storage.set("synthetic");
  await storage.get();
  await storage.clear();
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    "gadoc.mobile.access-token",
    "synthetic",
    expect.objectContaining({
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      keychainService: "com.kscold.gadoc.mobile.session",
    }),
  );
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
});

test("session restores with /auth/me and preserves the saved credential on network errors and 403", async () => {
  const storage = memoryStorage("synthetic");
  const transport = jest
    .fn<HttpTransport>()
    .mockRejectedValue(new Error("native detail must be discarded"));
  const { session } = createServices(testConfig, storage, transport);
  await session.restore();
  expect(session.snapshot()).toMatchObject({
    kind: "restoreError",
    error: { code: "network" },
  });
  expect(storage.clear).not.toHaveBeenCalled();
  transport.mockResolvedValue(response({}, 403));
  await session.restore();
  expect(session.snapshot()).toMatchObject({
    kind: "restoreError",
    error: { code: "forbidden" },
  });
  expect(storage.value()).toBe("synthetic");
  transport.mockResolvedValue(envelope(user));
  await session.restore();
  expect(session.snapshot()).toMatchObject({ kind: "ready", user });
});

test("only an authenticated 401 clears the matching session, and stale responses cannot remove a new login", async () => {
  const storage = memoryStorage("synthetic-old");
  const stale = deferred<Response>();
  const transport = jest.fn<HttpTransport>().mockResolvedValue(envelope(user));
  const { session, api } = createServices(testConfig, storage, transport);
  await session.restore();
  transport.mockImplementationOnce(() => stale.promise);
  const old = api.teams().catch(() => undefined);
  transport.mockResolvedValueOnce(
    envelope({ accessToken: "synthetic-new", user }),
  );
  await session.login(user.email, "synthetic-password");
  stale.resolve(response({}, 401));
  await old;
  expect(session.snapshot().kind).toBe("ready");
  expect(storage.value()).toBe("synthetic-new");
  transport.mockResolvedValue(response({}, 401));
  await expect(api.teams()).rejects.toMatchObject({ code: "unauthorized" });
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(session.snapshot()).toMatchObject({
    kind: "signedOut",
    expired: true,
  });
  expect(storage.value()).toBeNull();
});

test("logout removes credentials during outages and storage failure blocks a false logged-out state", async () => {
  const storage = memoryStorage("synthetic");
  const transport = jest.fn<HttpTransport>().mockResolvedValue(envelope(user));
  const { session } = createServices(testConfig, storage, transport);
  await session.restore();
  transport.mockRejectedValue(new Error("offline"));
  jest
    .mocked(storage.clear)
    .mockRejectedValueOnce(new Error("native store locked"));
  await session.logout();
  expect(session.getToken()).toBeNull();
  expect(session.snapshot().kind).toBe("locked");
  await session.logout();
  expect(session.snapshot().kind).toBe("signedOut");
  expect(storage.value()).toBeNull();
});

test("login cannot expose a ready session if secure storage fails, or race past logout", async () => {
  const storage = memoryStorage();
  const transport = jest
    .fn<HttpTransport>()
    .mockResolvedValue(envelope({ accessToken: "synthetic", user }));
  const { session } = createServices(testConfig, storage, transport);
  await session.restore();
  jest.mocked(storage.set).mockRejectedValueOnce(new Error("keychain locked"));
  await expect(
    session.login(user.email, "synthetic-password"),
  ).rejects.toBeInstanceOf(AppError);
  expect(session.snapshot().kind).toBe("signedOut");
  expect(session.getToken()).toBeNull();
  const pending = deferred<Response>();
  transport.mockImplementationOnce(() => pending.promise);
  const login = session.login(user.email, "synthetic-password");
  await session.logout();
  pending.resolve(envelope({ accessToken: "synthetic-late", user }));
  await login;
  expect(storage.value()).toBeNull();
  expect(session.snapshot().kind).toBe("signedOut");
});

test("timeout aborts a hung request while preserving the session", async () => {
  const unauthorized = jest.fn();
  const transport = jest.fn<HttpTransport>().mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  );
  const api = new ApiClient(
    testConfig,
    () => "synthetic",
    unauthorized,
    transport,
    10,
  );
  await expect(api.me()).rejects.toMatchObject({ code: "timeout" });
  expect(unauthorized).not.toHaveBeenCalled();
});
