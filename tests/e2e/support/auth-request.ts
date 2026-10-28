/** Fixture authentication only: respect the server limit without replaying other writes. */
export async function authRequest(
  send: () => Promise<Response>,
  wait: (milliseconds: number) => Promise<void>,
): Promise<Response> {
  for (let retry = 0; ; retry++) {
    const response = await send();
    if (response.status !== 429 || retry >= 2) return response;
    const header = response.headers.get("Retry-After");
    const seconds =
      header && /^\d+$/.test(header.trim()) ? Number(header) : NaN;
    // Do not conceal account lockouts (15 minutes), malformed responses or capacity failures.
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 60)
      return response;
    await response.body?.cancel();
    await wait(seconds * 1000 + 250);
  }
}

// One Playwright worker shares this queue across fixture and browser authentication.
// Space attempts below the server's 120/minute IP limit, including concurrent setup.
let authQueue: Promise<unknown> = Promise.resolve();
let nextAuthAttempt = 0;
export function pacedAuthRequest(
  send: () => Promise<Response>,
  wait: (milliseconds: number) => Promise<void>,
): Promise<Response> {
  const request = authQueue.then(() =>
    authRequest(async () => {
      const delay = Math.max(0, nextAuthAttempt - Date.now());
      if (delay > 0) await wait(delay);
      nextAuthAttempt = Date.now() + 650;
      return send();
    }, wait),
  );
  authQueue = request.catch(() => undefined);
  return request;
}
