const { getDefaultConfig } = require("expo/metro-config");
const { createRequire } = require("node:module");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
const mobileRequire = createRequire(path.join(__dirname, "package.json"));
// The desktop's hoisted workspace also contains the web app's React patch.
// Every mobile import must share this app's Expo-aligned React instance.
config.resolver.resolveRequest = (context, name, platform) => {
  if (/^(react|react-dom)(\/|$)/.test(name)) {
    return { type: "sourceFile", filePath: mobileRequire.resolve(name) };
  }
  return context.resolveRequest(context, name, platform);
};
module.exports = config;
