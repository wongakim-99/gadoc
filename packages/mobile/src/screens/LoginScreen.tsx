import { useRef, useState, type ComponentRef } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppError, errorCopy } from "../api/errors";
import { Button } from "../ui/components";
import { useServices } from "../ui/hooks";
import { color, ui } from "../ui/theme";

export function LoginScreen({ expired = false }: { expired?: boolean }) {
  const { session } = useServices();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const submit = async () => {
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await session.login(email, password);
      setPassword("");
    } catch (caught) {
      setPassword("");
      setError(
        caught instanceof AppError && caught.status === 400
          ? "이메일 또는 비밀번호가 올바르지 않습니다."
          : errorCopy(caught),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <KeyboardAvoidingView
      style={ui.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.form}>
          <View style={[ui.row, { marginBottom: 26 }]}>
            <Image
              source={require("../../assets/brand.png")}
              style={{ width: 44, height: 44 }}
              accessibilityLabel="가독"
            />
            <Text style={[ui.subtitle, { fontSize: 23 }]}>
              가독{" "}
              <Text style={{ color: color.muted, fontSize: 17 }}>GaDoc</Text>
            </Text>
          </View>
          <Text style={ui.eyebrow}>YOUR WORK, CONNECTED</Text>
          <Text
            accessibilityRole="header"
            style={[ui.title, { marginTop: 12 }]}
          >
            대화에서 문서로,{`\n`}생각에서 다음 일로.
          </Text>
          <Text style={[ui.secondary, { marginTop: 14, marginBottom: 30 }]}>
            어디서든 팀의 흐름을 이어가세요.
          </Text>
          {expired && (
            <Text
              accessibilityRole="alert"
              style={[ui.error, { marginBottom: 16 }]}
            >
              로그인이 만료되었습니다. 다시 로그인해 주세요.
            </Text>
          )}
          <View style={{ gap: 10 }}>
            <Text style={ui.label} nativeID="email-label">
              이메일
            </Text>
            <TextInput
              accessibilityLabel="이메일"
              accessibilityLabelledBy="email-label"
              placeholder="이메일 주소"
              placeholderTextColor={color.muted}
              style={ui.input}
              value={email}
              onChangeText={setEmail}
              maxLength={254}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              keyboardAppearance="dark"
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordInput.current?.focus()}
            />
            <Text
              style={[ui.label, { marginTop: 8 }]}
              nativeID="password-label"
            >
              비밀번호
            </Text>
            <TextInput
              ref={passwordInput}
              accessibilityLabel="비밀번호"
              accessibilityLabelledBy="password-label"
              placeholder="비밀번호"
              placeholderTextColor={color.muted}
              style={ui.input}
              value={password}
              onChangeText={setPassword}
              maxLength={72}
              editable={!busy}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              keyboardAppearance="dark"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />
            {error ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={ui.error}
              >
                {error}
              </Text>
            ) : null}
            <Button
              title={busy ? "로그인 중…" : "이메일로 로그인"}
              disabled={busy}
              onPress={() => void submit()}
              style={{ marginTop: 12 }}
            />
          </View>
          <Text style={[ui.muted, { marginTop: 24, lineHeight: 22 }]}>
            기존 가독 계정으로 로그인합니다.{`\n`}워크스페이스 참여는 초대 후
            가능합니다.
          </Text>
          {Platform.OS === "web" && (
            <Text style={[ui.muted, { marginTop: 12 }]}>
              브라우저 미리보기에서는 로그인 정보를 저장하지 않습니다.
            </Text>
          )}
          <View style={[ui.divider, { marginTop: 36, marginBottom: 20 }]} />
          <Text style={ui.muted}>Colding / kscold · 가독 모바일</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 40,
    paddingBottom: 32,
    justifyContent: "center",
  },
  form: { width: "100%", maxWidth: 440, alignSelf: "center" },
});
