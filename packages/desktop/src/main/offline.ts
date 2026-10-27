export function offlinePage(startUrl: string) {
  const href = startUrl.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
  return (
    "data:text/html;charset=utf-8," +
    encodeURIComponent(
      `<!doctype html><html lang="ko"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>GaDoc 연결 대기</title><style>body{margin:0;background:#181b20;color:#eee;font:16px sans-serif;display:grid;place-items:center;height:100vh}main{max-width:420px;padding:32px}p{color:#a5aebc;line-height:1.6}a{display:inline-block;padding:12px 20px;background:#4263eb;border-radius:8px;color:white;text-decoration:none}</style><main><h1>연결을 확인해 주세요</h1><p>GaDoc을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p><a href="${href}">다시 연결</a></main></html>`,
    )
  );
}
