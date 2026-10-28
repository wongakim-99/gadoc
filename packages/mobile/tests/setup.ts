import mockSafeArea from "react-native-safe-area-context/jest/mock";
import { AppState } from "react-native";

beforeEach(() => {
  AppState.currentState = "active";
});

jest.mock("react-native-safe-area-context", () => mockSafeArea);

jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
