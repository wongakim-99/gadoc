/** Fixture authentication only: respect the server limit without replaying other writes. */
export async function authRequest(
  send: () => Promise<Response>,
  wait: (milliseconds: number) => Promise<void>,
): Promise<Response> {
  for (let retry = 0; ; retry++) {
    const response = await send();
    if (response.status !== 429 || retry >= 2) return response;
    const header = response.headers.get('Retry-After');
    const seconds = header && /^\d+$/.test(header.trim()) ? Number(header) : NaN;
    // Do not conceal account lockouts (15 minutes), malformed responses or capacity failures.
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 60) return response;
    await response.body?.cancel();
    await wait(seconds * 1000 + 250);
  }
}
