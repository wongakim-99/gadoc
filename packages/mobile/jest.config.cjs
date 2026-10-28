module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  clearMocks: true,
  testEnvironmentOptions: {
    customExportConditions: ["require", "react-native", "expo-source"],
  },
  moduleNameMapper: {
    "^react$": require.resolve("react"),
    "^react/(.*)$": `${require("node:path").dirname(require.resolve("react/package.json"))}/$1`,
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@testing-library|expo|@expo|marked|htmlparser2|domhandler|domutils|domelementtype|entities|dom-serializer|zod))",
  ],
};
