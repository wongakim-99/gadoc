import type { ApiClient } from "../api/client";
import type { User } from "../api/contracts";
import { AppError } from "../api/errors";
import type { TokenStorage } from "./token-storage";

export type SessionState =
  | { kind: "restoring" }
  | { kind: "signedOut"; expired?: boolean }
  | { kind: "ready"; user: User; generation: number }
  | { kind: "restoreError"; error: AppError }
  | { kind: "locked"; error: AppError };

export class Session {
  private state: SessionState = { kind: "restoring" };
  private token: string | null = null;
  private epoch = 0;
  private listeners = new Set<() => void>();
  private vaultQueue: Promise<unknown> = Promise.resolve();
  api!: ApiClient;

  constructor(private readonly storage: TokenStorage) {}
  snapshot = () => this.state;
  getToken = () => this.token;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(state: SessionState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  private vault<T>(action: () => Promise<T>): Promise<T> {
    const operation = this.vaultQueue.then(action);
    this.vaultQueue = operation.catch(() => undefined);
    return operation;
  }

  async restore() {
    const epoch = ++this.epoch;
    this.update({ kind: "restoring" });
    try {
      const token = await this.vault(() => this.storage.get());
      if (epoch !== this.epoch) return;
      this.token = token;
      if (!token) {
        this.update({ kind: "signedOut" });
        return;
      }
      const user = await this.api.me();
      if (epoch === this.epoch)
        this.update({ kind: "ready", user, generation: epoch });
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.update({
        kind: "restoreError",
        error: error instanceof AppError ? error : new AppError("storage"),
      });
    }
  }

  async login(email: string, password: string) {
    const epoch = ++this.epoch;
    const result = await this.api.login(email.trim(), password);
    if (epoch !== this.epoch) return;
    try {
      await this.vault(() =>
        epoch === this.epoch
          ? this.storage.set(result.accessToken)
          : Promise.resolve(),
      );
    } catch {
      throw new AppError("storage");
    }
    if (epoch !== this.epoch) return;
    this.token = result.accessToken;
    this.update({ kind: "ready", user: result.user, generation: epoch });
  }

  invalidate = (token: string) => {
    if (token !== this.token) return;
    this.token = null;
    const epoch = ++this.epoch;
    this.update({ kind: "restoring" });
    void this.vault(() => this.storage.clear()).then(
      () => {
        if (epoch === this.epoch)
          this.update({ kind: "signedOut", expired: true });
      },
      () => {
        if (epoch === this.epoch)
          this.update({ kind: "locked", error: new AppError("storage") });
      },
    );
  };

  async logout() {
    const token = this.token;
    this.token = null;
    const epoch = ++this.epoch;
    this.update({ kind: "restoring" });
    // JWT logout only clears the server cookie; there is no token revocation/refresh endpoint.
    // Remove the device credential even when the server cannot be reached.
    void this.api.logout(token).catch(() => undefined);
    try {
      await this.vault(() => this.storage.clear());
      if (epoch === this.epoch) this.update({ kind: "signedOut" });
    } catch {
      if (epoch === this.epoch)
        this.update({ kind: "locked", error: new AppError("storage") });
    }
  }
}
