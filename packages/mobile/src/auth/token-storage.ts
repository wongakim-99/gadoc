import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}
const key = "gadoc.mobile.access-token";
const options: SecureStore.SecureStoreOptions = {
  keychainService: "com.kscold.gadoc.mobile.session",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export function createTokenStorage(): TokenStorage {
  // Web export is a preview: never copy tokens into localStorage/cookies/IndexedDB.
  if (Platform.OS === "web") {
    let token: string | null = null;
    return {
      get: async () => token,
      set: async (value) => {
        token = value;
      },
      clear: async () => {
        token = null;
      },
    };
  }
  return {
    get: () => SecureStore.getItemAsync(key, options),
    set: (token) => SecureStore.setItemAsync(key, token, options),
    clear: () => SecureStore.deleteItemAsync(key, options),
  };
}
