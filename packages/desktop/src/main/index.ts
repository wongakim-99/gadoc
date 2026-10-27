import { app, ipcMain } from "electron";
import path from "node:path";
import { existsSync } from "node:fs";
import log from "electron-log";
import { createMainWindow } from "./window";
import { configurePermissions, requestMediaAccess } from "./permissions";
import { registerNotificationIpc } from "./notifications";
import { setupAutoUpdates } from "./updates";
import { setupTray } from "./tray";
import { isTrustedSender } from "./ipc-security";

let mainWindow: ReturnType<typeof createMainWindow> | null = null;
const isCiLinux = process.platform === "linux" && process.env.CI === "true";

// 리눅스 CI에서는 Chromium 샌드박스와 GPU 초기화 때문에 창이 안 뜨는 경우가 있어서
// 자동화 실행에 필요한 스위치를 미리 켭니다.
if (isCiLinux) {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-dev-shm-usage");
}

// 메인 프로세스 크래시 방지
process.on("uncaughtException", (error) => {
  log.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
  log.error("Unhandled rejection:", reason);
});

// Keep the installed app's session and preferences across the display-name change.
const userData = app.isPackaged
  ? path.join(app.getPath("appData"), existsSync(path.join(app.getPath("appData"), "Slacord")) ? "Slacord" : "GaDoc")
  : app.getPath("userData");
app.setName("GaDoc");
app.setPath("userData", userData);
if (process.platform === "win32") app.setAppUserModelId("com.kscold.slacord");

if (app.isPackaged && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.show();
    mainWindow?.focus();
  });
  app.whenReady().then(() => {
    configurePermissions();
    registerNotificationIpc();
    ipcMain.handle("desktop:request-media-access", (event, kind: unknown) => {
      if (!isTrustedSender(event)) return { microphone: false, camera: false };
      return requestMediaAccess(
        kind === "microphone" || kind === "camera" ? kind : undefined,
      );
    });
    mainWindow = createMainWindow();
    setupAutoUpdates(mainWindow);
    setupTray(() => mainWindow);
    app.on("activate", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
      } else {
        mainWindow = createMainWindow();
        setupAutoUpdates(mainWindow);
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
