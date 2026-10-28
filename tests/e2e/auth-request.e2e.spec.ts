import { test, expect } from "playwright/test";
import { authRequest } from "./support/auth-request";

test("fixture auth respects Retry-After and retries the rejected request", async () => {
  const waits: number[] = [];
  let calls = 0;
  const response = await authRequest(
    async () =>
      ++calls === 1
        ? new Response("limited", {
            status: 429,
            headers: { "Retry-After": "12" },
          })
        : new Response("created", { status: 201 }),
    async (ms) => {
      waits.push(ms);
    },
  );
  expect(response.status).toBe(201);
  expect(calls).toBe(2);
  expect(waits).toEqual([12250]);
});

test("persistent auth throttling stops after two cooldowns", async () => {
  let calls = 0;
  const waits: number[] = [];
  const response = await authRequest(
    async () => {
      calls++;
      return new Response("limited", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    },
    async (ms) => {
      waits.push(ms);
    },
  );
  expect(calls).toBe(3);
  expect(waits).toEqual([60250, 60250]);
  expect(await response.text()).toBe("limited");
});

test("auth errors, account lockouts and missing cooldowns are not retried", async () => {
  for (const [status, header] of [
    [401, "1"],
    [500, "1"],
    [429, "900"],
    [429, ""],
    [429, "invalid"],
    [429, "0"],
  ] as const) {
    let calls = 0;
    const response = await authRequest(
      async () => {
        calls++;
        return new Response("rejected", {
          status,
          headers: header ? { "Retry-After": header } : {},
        });
      },
      async () => {
        throw new Error("Unexpected retry");
      },
    );
    expect(calls).toBe(1);
    expect(await response.text()).toBe("rejected");
  }
});

test("fixture helper extends only the current test budget for an auth cooldown", async () => {
  test.setTimeout(1000);
  const { jsonFetch } = await import("./support/slacord-api");
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () =>
      ++calls === 1
        ? new Response("{}", { status: 429, headers: { "Retry-After": "1" } })
        : new Response('{"success":true}', { status: 201 });
    expect(
      await jsonFetch("/auth/register", {
        method: "POST",
        body: { email: "synthetic@example.test" },
      }),
    ).toEqual({ success: true });
    expect(calls).toBe(2);
    expect(test.info().timeout).toBeGreaterThanOrEqual(2250);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fixture helper never replays a non-auth mutation on 429", async () => {
  const { jsonFetch } = await import("./support/slacord-api");
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return new Response('{"message":"limited"}', {
        status: 429,
        headers: { "Retry-After": "1" },
      });
    };
    await expect(
      jsonFetch("/team/synthetic/database", {
        method: "POST",
        body: { name: "synthetic" },
      }),
    ).rejects.toThrow("429");
    expect(calls).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("browser login waits on 429 and resubmits after the cooldown", async ({
  page,
}) => {
  const { loginWithSession } = await import("./support/slacord-session");
  let attempts = 0;
  await page.route("**/auth/login", async (route) => {
    if (route.request().method() === "POST") {
      attempts++;
      await route.fulfill({
        status: attempts === 1 ? 429 : 200,
        headers: attempts === 1 ? { "Retry-After": "1" } : {},
        contentType: "application/json",
        body: "{}",
      });
    } else {
      await route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: `<input placeholder="team@company.com"><input placeholder="비밀번호 입력"><button onclick="fetch('/auth/login', {method:'POST'}).then(r=>{if(r.ok)location.href='/dashboard'})">로그인</button>`,
      });
    }
  });
  await page.route("**/dashboard", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: "Signed in",
    }),
  );
  await loginWithSession(page, {
    email: "synthetic@example.test",
    password: "synthetic",
    token: "",
    userId: "synthetic",
    username: "synthetic",
  });
  expect(attempts).toBe(2);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("concurrent fixture authentication is spaced and a failed request does not block the queue", async () => {
  const { pacedAuthRequest } = await import("./support/auth-request");
  const starts: number[] = [];
  const wait = async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  };
  const first = pacedAuthRequest(async () => {
    starts.push(Date.now());
    throw new Error("synthetic connection failure");
  }, wait);
  const second = pacedAuthRequest(async () => {
    starts.push(Date.now());
    return new Response("{}", { status: 200 });
  }, wait);
  const results = await Promise.allSettled([first, second]);
  expect(results[0].status).toBe("rejected");
  expect(results[1].status).toBe("fulfilled");
  expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(600);
});
