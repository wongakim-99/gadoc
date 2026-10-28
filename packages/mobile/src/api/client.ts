import { z } from "zod";
import type { RuntimeConfig } from "./config";
import { AppError } from "./errors";
import {
  channelSchema,
  documentNodeSchema,
  documentSchema,
  issueSchema,
  loginSchema,
  memberSchema,
  messageSchema,
  teamSchema,
  userSchema,
} from "./contracts";

export const PAGE_SIZE = 50;
export type HttpTransport = (
  url: string,
  options?: RequestInit,
) => Promise<Response>;
export const defaultTransport: HttpTransport = (url, options) =>
  fetch(url, options);
type Options = {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
  public?: boolean;
  token?: string | null;
};
const segment = (id: string) => encodeURIComponent(id);

export class ApiClient {
  constructor(
    readonly config: RuntimeConfig,
    private readonly getToken: () => string | null,
    private readonly unauthorized: (token: string) => void,
    private readonly transport: HttpTransport = defaultTransport,
    private readonly timeout = 15_000,
  ) {}

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: Options = {},
  ): Promise<T> {
    const token = options.public
      ? null
      : options.token === undefined
        ? this.getToken()
        : options.token;
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) controller.abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeout);
    try {
      const response = await this.transport(`${this.config.apiUrl}${path}`, {
        method: options.method ?? "GET",
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      });
      if (!response.ok) {
        if (response.status === 401 && token) this.unauthorized(token);
        throw new AppError(
          response.status === 401
            ? "unauthorized"
            : response.status === 403
              ? "forbidden"
              : "request",
          response.status,
        );
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new AppError("invalid");
      }
      const envelope = z
        .object({ success: z.literal(true), data: schema })
        .safeParse(body);
      if (!envelope.success) throw new AppError("invalid");
      return envelope.data.data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        options.signal?.aborted ? "aborted" : timedOut ? "timeout" : "network",
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  login(email: string, password: string) {
    return this.request("/auth/login", loginSchema, {
      method: "POST",
      public: true,
      body: { email, password, rememberMe: true },
    });
  }
  logout(token: string | null) {
    return this.request("/auth/logout", z.undefined(), {
      method: "POST",
      token,
    });
  }
  me(signal?: AbortSignal) {
    return this.request("/auth/me", userSchema, { signal });
  }
  teams(signal?: AbortSignal) {
    return this.request("/team", z.array(teamSchema), { signal });
  }
  channels(teamId: string, signal?: AbortSignal) {
    return this.request(
      `/team/${segment(teamId)}/channel`,
      z.array(channelSchema),
      { signal },
    );
  }
  members(teamId: string, signal?: AbortSignal) {
    return this.request(
      `/team/${segment(teamId)}/member`,
      z.array(memberSchema),
      { signal },
    );
  }
  messages(channelId: string, before?: string, signal?: AbortSignal) {
    const query = `limit=${PAGE_SIZE}${before ? `&before=${encodeURIComponent(before)}` : ""}`;
    return this.request(
      `/channel/${segment(channelId)}/message?${query}`,
      z.array(messageSchema),
      { signal },
    );
  }
  documents(teamId: string, signal?: AbortSignal) {
    return this.request(
      `/team/${segment(teamId)}/document`,
      z.array(documentNodeSchema),
      { signal },
    );
  }
  document(teamId: string, documentId: string, signal?: AbortSignal) {
    return this.request(
      `/team/${segment(teamId)}/document/${segment(documentId)}`,
      documentSchema,
      { signal },
    );
  }
  issues(teamId: string, signal?: AbortSignal) {
    // No single-issue GET or pagination exists in IssueController.
    return this.request(
      `/team/${segment(teamId)}/issue`,
      z.array(issueSchema),
      { signal },
    );
  }
}
