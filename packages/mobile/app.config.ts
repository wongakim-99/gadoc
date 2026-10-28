import type { ExpoConfig } from "expo/config";

// Identifiers intentionally separate from the desktop's com.kscold.slacord.
const config: ExpoConfig = {
  name: "가독",
  slug: "gadoc-mobile",
  version: "0.1.0",
  scheme: "gadoc-mobile",
  orientation: "default",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  ios: {
    bundleIdentifier: "com.kscold.gadoc.mobile",
    buildNumber: "1",
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "com.kscold.gadoc.mobile",
    versionCode: 1,
    permissions: [],
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.CAMERA",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.VIBRATE",
    ],
    allowBackup: false,
    softwareKeyboardLayoutMode: "resize",
    adaptiveIcon: {
      foregroundImage: "./assets/brand.png",
      backgroundColor: "#181b20",
    },
  },
  plugins: [
    [
      "expo-splash-screen",
      {
        image: "./assets/brand.png",
        imageWidth: 160,
        backgroundColor: "#181b20",
      },
    ],
    [
      "expo-secure-store",
      { configureAndroidBackup: true, faceIDPermission: false },
    ],
    [
      "./plugins/with-transport.cjs",
      { localHttp: process.env.GADOC_MOBILE_DEV_HTTP === "1" },
    ],
  ],
  web: {
    name: "가독 모바일 미리보기",
    bundler: "metro",
    output: "single",
    favicon: "./assets/icon.png",
  },
};

export default config;
