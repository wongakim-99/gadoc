import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { errorCopy } from "../api/errors";
import { color, ui } from "./theme";

export function Button({
  title,
  onPress,
  disabled = false,
  kind = "primary",
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: "primary" | "quiet" | "danger";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.button,
        kind === "primary" && { backgroundColor: color.blue },
        {
          borderColor: focused ? color.link : "transparent",
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          {
            color:
              kind === "danger"
                ? color.danger
                : kind === "quiet"
                  ? color.link
                  : "#ffffff",
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Header({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack && (
        <Button
          title="‹ 뒤로"
          kind="quiet"
          onPress={onBack}
          style={{ paddingHorizontal: 0, alignSelf: "flex-start" }}
        />
      )}
      <View style={ui.row}>
        <View style={ui.fill}>
          {subtitle && <Text style={ui.eyebrow}>{subtitle}</Text>}
          <Text
            accessibilityRole="header"
            style={[ui.title, { fontSize: 24, lineHeight: 34 }]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
        {right}
      </View>
    </View>
  );
}

export function Loading({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <View
      style={styles.state}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator color={color.link} />
      <Text style={ui.secondary}>{label}</Text>
    </View>
  );
}
export function ErrorState({
  error,
  retry,
  compact = false,
}: {
  error: unknown;
  retry: () => void;
  compact?: boolean;
}) {
  return (
    <View style={compact ? [ui.card, { margin: 16 }] : styles.state}>
      <Text
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={ui.error}
      >
        {errorCopy(error)}
      </Text>
      <Button title="다시 시도" kind="quiet" onPress={retry} />
    </View>
  );
}
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.state}>
      <Text style={ui.subtitle}>{title}</Text>
      <Text style={[ui.secondary, { textAlign: "center" }]}>{body}</Text>
    </View>
  );
}
export function RowCard({
  title,
  detail,
  badge,
  onPress,
  leading,
}: {
  title: string;
  detail?: string;
  badge?: string;
  onPress: () => void;
  leading?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [ui.card, ui.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      {leading && (
        <View style={styles.leading}>
          <Text style={{ color: color.link, fontSize: 20, fontWeight: "600" }}>
            {leading}
          </Text>
        </View>
      )}
      <View style={ui.fill}>
        <Text style={ui.subtitle}>{title}</Text>
        {detail ? (
          <Text style={ui.muted} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {badge ? <Text style={ui.badge}>{badge}</Text> : null}
      <Text
        style={{ color: color.muted, fontSize: 24 }}
        accessibilityElementsHidden
      >
        ›
      </Text>
    </Pressable>
  );
}

export function Confirm({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  children,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={styles.modalCard} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={{ gap: 16 }}>
            <Text accessibilityRole="header" style={ui.subtitle}>
              {title}
            </Text>
            <Text style={ui.secondary}>{body}</Text>
            {children}
            <Button title={confirmLabel} onPress={onConfirm} />
            <Button title="취소" kind="quiet" onPress={onCancel} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  state: {
    padding: 28,
    gap: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  leading: {
    width: 42,
    height: 42,
    backgroundColor: color.selected,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#000000b3",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: 16,
    padding: 24,
    maxHeight: "90%",
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
});
