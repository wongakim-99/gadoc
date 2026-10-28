const {
  withAndroidManifest,
  withInfoPlist,
  withGradleProperties,
} = require("expo/config-plugins");

module.exports = (config, { localHttp = false } = {}) => {
  if (localHttp && process.env.NODE_ENV === "production") {
    throw new Error("배포 설정에서는 개발 HTTP를 허용할 수 없습니다.");
  }
  config = withAndroidManifest(config, (mod) => {
    for (const application of mod.modResults.manifest.application ?? []) {
      application.$["android:usesCleartextTraffic"] = String(localHttp);
    }
    return mod;
  });
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSAppTransportSecurity = localHttp
      ? { NSAllowsLocalNetworking: true }
      : { NSAllowsArbitraryLoads: false };
    if (localHttp)
      mod.modResults.NSLocalNetworkUsageDescription =
        "개발 중인 가독 서버에 연결합니다.";
    else delete mod.modResults.NSLocalNetworkUsageDescription;
    return mod;
  });
  return withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter(
      (item) => item.key !== "android.builder.sdkDownload",
    );
    mod.modResults.push({
      type: "property",
      key: "android.builder.sdkDownload",
      value: "false",
    });
    return mod;
  });
};
