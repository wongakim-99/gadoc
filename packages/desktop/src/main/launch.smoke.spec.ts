import http from "node:http";
import path from "node:path";
import os from "node:os";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { _electron } from "playwright";

const requireFromThisFile = createRequire(import.meta.url);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, "../..");
const electronBinary = requireFromThisFile("electron");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=",
  "base64",
);
const authorizedDownloads: string[] = [];

function createSmokeServer() {
  let resolveReady: ((payload: Record<string, string>) => void) | null = null;
  const readyPromise = new Promise<Record<string, string>>((resolve) => {
    resolveReady = resolve;
  });

  let webRevision = 1;
  const server = http.createServer((request, response) => {
    if (request.url?.startsWith("/api/files?")) {
      if (!request.headers.cookie?.includes("gadoc_smoke=1")) {
        response.writeHead(401).end();
        return;
      }
      authorizedDownloads.push(request.url);
      response
        .writeHead(200, {
          "Content-Type": "image/png",
          "Content-Length": png.length,
          "Content-Disposition": 'inline; filename="photo.png"',
        })
        .end(png);
      return;
    }
    if (request.url === "/__web_update__") {
      webRevision = 2;
      response.writeHead(204).end();
      return;
    }
    if (request.url === "/favicon.ico") {
      response.writeHead(204).end();
      return;
    }

    if (request.url?.startsWith("/__desktop_ready__")) {
      const url = new URL(request.url, "http://127.0.0.1");
      resolveReady?.(Object.fromEntries(url.searchParams.entries()));
      response.writeHead(204).end();
      return;
    }

    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": "gadoc_smoke=1; HttpOnly; SameSite=Lax; Path=/",
    });
    response.end(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>GaDoc Desktop Smoke</title>
  </head>
  <body>
    <h1 id="status">대기 중</h1>
    <a id="file" href="/api/files?key=photo.png">Download attachment</a>
    <a id="file-new" href="/api/files?key=photo.png" target="_blank">Open attachment</a>
    <script>
      const revision = ${webRevision};
      const bridge = window.slacordDesktop;
      const target = document.getElementById('status');
      if (bridge && bridge.isDesktop && typeof bridge.getUpdateStatus === 'function') {
        target.textContent = '데스크톱 브리지 준비';
        if (revision === 1) { fetch('/__web_update__').then(() => location.reload()); }
        else bridge.getUpdateStatus().then(() => fetch('/__desktop_ready__?revision=' + revision + '&bridge=' + bridge.bridgeVersion + '&desktop=1&notify=' + Number(typeof bridge.notify === 'function') + '&updater=' + Number(typeof bridge.getUpdateStatus === 'function') + '&href=' + encodeURIComponent(window.location.pathname))).catch(error => fetch('/__desktop_ready__?error=' + encodeURIComponent(error.message)));
      } else {
        target.textContent = '브리지 누락';
        fetch('/__desktop_ready__?desktop=0&notify=0&updater=0&href=' + encodeURIComponent(window.location.pathname));
      }
    </script>
  </body>
</html>`);
  }) as http.Server & {
    waitForReady: () => Promise<Record<string, string>>;
  };

  (server as any).waitForReady = () => readyPromise;
  return server;
}

describe("desktop launch smoke", () => {
  let server: http.Server & {
    waitForReady: () => Promise<Record<string, string>>;
  };
  let baseUrl = "";

  beforeAll(async () => {
    // Invoke the JS CLI directly: Windows cannot exec a pnpm.cmd shim.
    const tsupPackagePath = requireFromThisFile.resolve("tsup/package.json");
    const tsupBin = requireFromThisFile(tsupPackagePath).bin.tsup as string;
    execFileSync(
      process.execPath,
      [
        path.resolve(path.dirname(tsupPackagePath), tsupBin),
        "--config",
        "tsup.config.ts",
      ],
      { cwd: packageRoot, stdio: "pipe" },
    );
    server = createSmokeServer();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("스모크 서버 포트를 확인하지 못했어요.");
    }
    baseUrl = `http://127.0.0.1:${address.port}/auth/login`;
  });

  afterAll(async () => {
    if (!server?.listening) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  it("웹 갱신·인증 첨부 다운로드·기본 창 영역과 닫기 후 재열기를 유지함", async () => {
    const directory = mkdtempSync(
      path.join(os.tmpdir(), "gadoc-desktop-smoke-"),
    );
    const appEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
      ELECTRON_ENABLE_LOGGING: "1",
      SLACORD_DESKTOP_START_URL: baseUrl,
    };
    delete appEnv.ELECTRON_RUN_AS_NODE;
    const app = await _electron.launch({
      executablePath: electronBinary,
      args: [
        ".",
        "--no-sandbox",
        "--disable-gpu",
        `--user-data-dir=${path.join(directory, "profile")}`,
      ],
      cwd: packageRoot,
      env: Object.fromEntries(
        Object.entries(appEnv).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
      timeout: 40000,
    });

    try {
      const page = await app.firstWindow();
      const ready = await Promise.race([
        server.waitForReady(),
        new Promise<Record<string, string>>((_, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Electron 브리지 준비 시간 초과")),
            40000,
          );
          timeout.unref();
        }),
      ]);

      expect(ready).toEqual({
        revision: "2",
        bridge: "2",
        desktop: "1",
        notify: "1",
        updater: "1",
        href: "/auth/login",
      });
      const geometry = await app.evaluate(({ app, BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        return {
          frame: window.getBounds(),
          content: window.getContentBounds(),
          profile: app.getPath("userData"),
        };
      });
      expect(realpathSync(geometry.profile)).toBe(
        realpathSync(path.join(directory, "profile")),
      );
      if (process.platform === "darwin")
        expect(geometry.content.y - geometry.frame.y).toBeGreaterThanOrEqual(
          20,
        );
      for (const id of ["file", "file-new"]) {
        const file = path.join(directory, `${id}.png`);
        await app.evaluate(({ BrowserWindow }, savePath) => {
          BrowserWindow.getAllWindows()[0].webContents.session.once(
            "will-download",
            (_event, item) => item.setSavePath(savePath),
          );
        }, file);
        // Canceled native navigation has no browser navigation-complete event.
        await app.evaluate(
          ({ BrowserWindow }, elementId) =>
            BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
              `document.getElementById(${JSON.stringify(elementId)}).click()`,
              true,
            ),
          id,
        );
        await expect
          .poll(() => {
            try {
              return readFileSync(file).equals(png);
            } catch {
              return false;
            }
          })
          .toBe(true);
        expect(new URL(page.url()).pathname).toBe("/auth/login");
        expect(
          await app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0].webContents.isLoading(),
          ),
        ).toBe(false);
      }
      expect(authorizedDownloads).toHaveLength(2);
      expect(
        await app.evaluate(
          ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
        ),
      ).toBe(1);
      expect(
        await app.evaluate(({ BrowserWindow }) => {
          const window = BrowserWindow.getAllWindows()[0];
          window.close();
          return {
            destroyed: window.isDestroyed(),
            visible: window.isVisible(),
          };
        }),
      ).toEqual({ destroyed: false, visible: false });
      await app.evaluate(({ app }) => app.emit("activate"));
      await expect
        .poll(() =>
          app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0].isVisible(),
          ),
        )
        .toBe(true);
      expect(
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
            "document.getElementById('status').textContent",
          ),
        ),
      ).toBe("데스크톱 브리지 준비");
    } finally {
      await app.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 60000);
});
