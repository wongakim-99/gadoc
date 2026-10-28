import {
  Component,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  AppState,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { Channel, Team, User } from "./api/contracts";
import { createServices, type Services } from "./services";
import { ChatScreen } from "./screens/ChatScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { DocumentScreen, IssueScreen } from "./screens/ReaderScreens";
import { TeamsScreen } from "./screens/TeamsScreen";
import { WorkspaceScreen, type Tab } from "./screens/WorkspaceScreen";
import { Button, ErrorState, Loading } from "./ui/components";
import { ActiveContext, ServicesContext } from "./ui/hooks";
import { color, ui } from "./ui/theme";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <View style={[ui.canvas, styles.center]}>
        <Text style={ui.secondary}>
          화면을 표시하지 못했습니다. 앱을 다시 열어 주세요.
        </Text>
      </View>
    ) : (
      this.props.children
    );
  }
}

export default function App() {
  const [services] = useState(() => {
    try {
      return createServices();
    } catch {
      return null;
    }
  });
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        {services ? (
          <MobileApp services={services} />
        ) : (
          <SafeAreaView style={[ui.canvas, styles.center]}>
            <Text style={ui.error}>서버 주소 설정을 확인해 주세요.</Text>
          </SafeAreaView>
        )}
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export function MobileApp({ services }: { services: Services }) {
  const session = useSyncExternalStore(
    services.session.subscribe,
    services.session.snapshot,
  );
  const [active, setActive] = useState(
    () => !AppState.currentState || AppState.currentState === "active",
  );
  useEffect(() => {
    void services.session.restore();
  }, [services]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => listener.remove();
  }, []);
  return (
    <ServicesContext.Provider value={services}>
      <ActiveContext.Provider value={active}>
        <StatusBar style="light" />
        <SafeAreaView style={ui.canvas}>
          <View
            style={[ui.fill, !active && { opacity: 0 }]}
            pointerEvents={active ? "auto" : "none"}
            accessibilityElementsHidden={!active}
            importantForAccessibility={active ? "auto" : "no-hide-descendants"}
          >
            {session.kind === "restoring" ? (
              <Loading label="로그인 확인 중…" />
            ) : session.kind === "signedOut" ? (
              <LoginScreen expired={session.expired} />
            ) : session.kind === "ready" ? (
              <WorkspaceApp
                key={session.generation}
                services={services}
                user={session.user}
              />
            ) : (
              <View style={[ui.fill, styles.center]}>
                <ErrorState
                  error={session.error}
                  retry={() =>
                    void (session.kind === "locked"
                      ? services.session.logout()
                      : services.session.restore())
                  }
                />
                {session.kind === "restoreError" && (
                  <Button
                    title="이 기기에서 로그아웃"
                    kind="quiet"
                    onPress={() => void services.session.logout()}
                  />
                )}
              </View>
            )}
          </View>
          {!active && (
            <View
              style={[
                StyleSheet.absoluteFill,
                styles.center,
                { backgroundColor: color.canvas },
              ]}
            >
              <Text style={ui.title}>가독</Text>
            </View>
          )}
        </SafeAreaView>
      </ActiveContext.Provider>
    </ServicesContext.Provider>
  );
}

type Route =
  | { kind: "teams" }
  | { kind: "workspace"; team: Team; tab: Tab }
  | { kind: "channel"; team: Team; channel: Channel }
  | { kind: "document"; team: Team; documentId: string }
  | { kind: "issue"; team: Team; issueId: string };

function WorkspaceApp({
  services: _services,
  user,
}: {
  services: Services;
  user: User;
}) {
  const [route, setRoute] = useState<Route>({ kind: "teams" });
  const back = () => {
    if (route.kind === "teams") return false;
    if (route.kind === "workspace") setRoute({ kind: "teams" });
    else
      setRoute({
        kind: "workspace",
        team: route.team,
        tab:
          route.kind === "document"
            ? "documents"
            : route.kind === "issue"
              ? "issues"
              : "chat",
      });
    return true;
  };
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      back,
    );
    return () => subscription.remove();
  });
  if (route.kind === "teams")
    return (
      <TeamsScreen
        user={user}
        onSelect={(team) => setRoute({ kind: "workspace", team, tab: "chat" })}
      />
    );
  if (route.kind === "channel")
    return (
      <ChatScreen
        key={route.channel.id}
        team={route.team}
        channel={route.channel}
        user={user}
        onBack={back}
      />
    );
  if (route.kind === "document")
    return (
      <DocumentScreen
        key={route.documentId}
        team={route.team}
        documentId={route.documentId}
        onBack={back}
        openDocument={(documentId) => setRoute({ ...route, documentId })}
      />
    );
  if (route.kind === "issue")
    return (
      <IssueScreen team={route.team} issueId={route.issueId} onBack={back} />
    );
  return (
    <WorkspaceScreen
      team={route.team}
      tab={route.tab}
      user={user}
      onBack={back}
      setTab={(tab) => setRoute({ ...route, tab })}
      openChannel={(channel) =>
        setRoute({ kind: "channel", team: route.team, channel })
      }
      openDocument={(document) =>
        setRoute({
          kind: "document",
          team: route.team,
          documentId: document.id,
        })
      }
      openIssue={(issue) =>
        setRoute({ kind: "issue", team: route.team, issueId: issue.id })
      }
    />
  );
}
const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
});
