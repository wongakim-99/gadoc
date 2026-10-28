export type RuntimeConfig = { apiUrl: string; socketUrl: string };

export function runtimeConfig(
  value: string | undefined,
  development: boolean,
): RuntimeConfig {
  const fail = () => {
    throw new Error("서버 주소 설정을 확인해 주세요.");
  };
  let url: URL;
  try {
    url = new URL(value || "https://gadoc.kr/api");
  } catch {
    return fail();
  }
  const localHost =
    /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
      url.hostname,
    );
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(development && localHost && url.protocol === "http:")) ||
    !/^\/api\/?$/.test(url.pathname)
  )
    return fail();
  return { apiUrl: `${url.origin}/api`, socketUrl: url.origin };
}
