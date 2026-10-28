import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppState, BackHandler, Platform } from "react-native";
import { MobileApp } from "../src/App";
import { createServices } from "../src/services";
import { LoginScreen } from "../src/screens/LoginScreen";
import { DocumentScreen, IssueScreen } from "../src/screens/ReaderScreens";
import { WorkspaceScreen } from "../src/screens/WorkspaceScreen";
import { ChatScreen } from "../src/screens/ChatScreen";
import { ServicesContext } from "../src/ui/hooks";
import {
  channel,
  documentNode,
  envelope,
  issue,
  memoryStorage,
  member,
  response,
  team,
  testConfig,
  user,
} from "./fixtures";

test("native email login has accessible fields, clears the password and writes only the secure credential", async () => {
  const storage = memoryStorage();
  const transport = jest
    .fn()
    .mockResolvedValue(envelope({ accessToken: "synthetic", user }));
  const services = createServices(testConfig, storage, transport);
  await services.session.restore();
  await render(
    <SafeAreaProvider>
      <ServicesContext.Provider value={services}>
        <LoginScreen />
      </ServicesContext.Provider>
    </SafeAreaProvider>,
  );
  await fireEvent.changeText(
    screen.getByLabelText("이메일"),
    "member@example.test",
  );
  await fireEvent.changeText(
    screen.getByLabelText("비밀번호"),
    "synthetic-password",
  );
  expect(screen.getByLabelText("비밀번호")).toHaveProp("secureTextEntry", true);
  await fireEvent.press(
    screen.getByRole("button", { name: "이메일로 로그인" }),
  );
  await waitFor(() => expect(services.session.snapshot().kind).toBe("ready"));
  expect(storage.set).toHaveBeenCalledWith("synthetic");
  expect(screen.getByLabelText("비밀번호")).toHaveProp("value", "");
  expect(screen.queryByText("synthetic")).toBeNull();
});

test("native restoration offers retry during an outage and does not discard the device login", async () => {
  const storage = memoryStorage("synthetic");
  const transport = jest.fn().mockRejectedValue(new Error("offline"));
  const services = createServices(testConfig, storage, transport);
  await render(
    <SafeAreaProvider>
      <MobileApp services={services} />
    </SafeAreaProvider>,
  );
  expect(
    await screen.findByText(
      "네트워크에 연결할 수 없습니다. 연결 상태를 확인해 주세요.",
    ),
  ).toBeOnTheScreen();
  expect(storage.clear).not.toHaveBeenCalled();
  transport.mockImplementation(async (url) =>
    String(url).endsWith("/auth/me") ? envelope(user) : envelope([team]),
  );
  await fireEvent.press(screen.getByRole("button", { name: "다시 시도" }));
  expect(
    await screen.findByRole("button", { name: /테스트 워크스페이스/ }),
  ).toBeOnTheScreen();
});

test("native document reader renders BlockNote and removes the previous body after a 403 retry", async () => {
  const transport = jest.fn().mockImplementation(async (url) =>
    String(url).endsWith("/auth/me")
      ? envelope(user)
      : String(url).endsWith("/document/doc-1")
        ? envelope({
            ...documentNode,
            content: JSON.stringify([
              {
                type: "paragraph",
                content: [{ type: "text", text: "권한 있는 문서 본문" }],
              },
            ]),
            canEdit: false,
            canDelete: false,
          })
        : envelope([documentNode]),
  );
  const services = createServices(
    testConfig,
    memoryStorage("synthetic"),
    transport,
  );
  await services.session.restore();
  await render(
    <SafeAreaProvider>
      <ServicesContext.Provider value={services}>
        <DocumentScreen
          team={team}
          documentId={documentNode.id}
          onBack={jest.fn()}
          openDocument={jest.fn()}
        />
      </ServicesContext.Provider>
    </SafeAreaProvider>,
  );
  expect(await screen.findByText("권한 있는 문서 본문")).toBeOnTheScreen();
  transport.mockResolvedValue(response({}, 403));
  const scroll = screen.getByLabelText("문서 본문");
  await act(async () => {
    scroll.props.refreshControl.props.onRefresh();
  });
  expect(
    await screen.findByText(
      "접근 권한이 없습니다. 워크스페이스 관리자에게 확인해 주세요.",
    ),
  ).toBeOnTheScreen();
  expect(screen.queryByText("권한 있는 문서 본문")).toBeNull();
  expect(services.session.snapshot().kind).toBe("ready");
});

test.each(["ios", "android"] as const)(
  "%s native login fields preserve secure entry and validation with the platform keyboard branch",
  async (platform) => {
    const previous = Platform.OS;
    Platform.OS = platform;
    try {
      const services = createServices(testConfig, memoryStorage(), jest.fn());
      await render(
        <SafeAreaProvider>
          <ServicesContext.Provider value={services}>
            <LoginScreen />
          </ServicesContext.Provider>
        </SafeAreaProvider>,
      );
      await fireEvent.changeText(screen.getByLabelText("이메일"), "invalid");
      await fireEvent.changeText(
        screen.getByLabelText("비밀번호"),
        "synthetic",
      );
      await fireEvent.press(
        screen.getByRole("button", { name: "이메일로 로그인" }),
      );
      expect(
        screen.getByText("이메일과 비밀번호를 입력해 주세요."),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("비밀번호")).toHaveProp(
        "secureTextEntry",
        true,
      );
      expect(screen.getByLabelText("이메일")).toHaveProp(
        "keyboardType",
        "email-address",
      );
    } finally {
      Platform.OS = previous;
    }
  },
);

test("Android hardware back returns from workspace to the team list", async () => {
  const previous = Platform.OS;
  Platform.OS = "android";
  const listener = jest.spyOn(BackHandler, "addEventListener");
  try {
    const transport = jest
      .fn()
      .mockImplementation(async (url) =>
        String(url).endsWith("/auth/me")
          ? envelope(user)
          : String(url).endsWith("/channel")
            ? envelope([])
            : String(url).endsWith("/member")
              ? envelope([member])
              : envelope([team]),
      );
    const services = createServices(
      testConfig,
      memoryStorage("synthetic"),
      transport,
    );
    await render(
      <SafeAreaProvider>
        <MobileApp services={services} />
      </SafeAreaProvider>,
    );
    await fireEvent.press(
      await screen.findByRole("button", { name: /테스트 워크스페이스/ }),
    );
    expect(await screen.findByText("팀의 대화")).toBeOnTheScreen();
    await act(async () => {
      listener.mock.calls.at(-1)![1]({
        type: "hardwareBackPress",
        timeStamp: 1,
      });
    });
    expect(await screen.findByText("워크스페이스")).toBeOnTheScreen();
  } finally {
    listener.mockRestore();
    Platform.OS = previous;
  }
});

test("background privacy cover hides private UI and foreground revalidates without deleting credentials", async () => {
  const listener = jest.spyOn(AppState, "addEventListener");
  const storage = memoryStorage("synthetic");
  const transport = jest
    .fn()
    .mockImplementation(async (url) =>
      String(url).endsWith("/auth/me") ? envelope(user) : envelope([team]),
    );
  const services = createServices(testConfig, storage, transport);
  try {
    await render(
      <SafeAreaProvider>
        <MobileApp services={services} />
      </SafeAreaProvider>,
    );
    expect(
      await screen.findByRole("button", { name: /테스트 워크스페이스/ }),
    ).toBeOnTheScreen();
    const change = listener.mock.calls.find(
      ([event]) => event === "change",
    )![1];
    await act(async () => {
      change("background");
    });
    expect(
      screen.queryByRole("button", { name: /테스트 워크스페이스/ }),
    ).toBeNull();
    expect(screen.getByText("가독")).toBeOnTheScreen();
    await act(async () => {
      change("active");
    });
    expect(
      await screen.findByRole("button", { name: /테스트 워크스페이스/ }),
    ).toBeOnTheScreen();
    expect(storage.clear).not.toHaveBeenCalled();
  } finally {
    listener.mockRestore();
  }
});

test("native guest channel has no composer and cannot emit a send", async () => {
  const transport = jest
    .fn()
    .mockImplementation(async (url) =>
      String(url).endsWith("/member")
        ? envelope([{ ...member, role: "guest" }])
        : envelope([channel]),
    );
  const services = createServices(testConfig, memoryStorage(), transport);
  await render(
    <SafeAreaProvider>
      <ServicesContext.Provider value={services}>
        <ChatScreen
          team={team}
          channel={channel}
          user={user}
          onBack={jest.fn()}
        />
      </ServicesContext.Provider>
    </SafeAreaProvider>,
  );
  expect(await screen.findByText("읽기 전용 대화입니다.")).toBeOnTheScreen();
  expect(screen.queryByLabelText("메시지 입력")).toBeNull();
  expect(screen.queryByRole("button", { name: "전송" })).toBeNull();
});

test("native issue detail uses the existing list endpoint and shows status, assignees and inert Markdown", async () => {
  const transport = jest
    .fn()
    .mockImplementation(async (url) =>
      String(url).endsWith("/member") ? envelope([member]) : envelope([issue]),
    );
  const services = createServices(testConfig, memoryStorage(), transport);
  await render(
    <SafeAreaProvider>
      <ServicesContext.Provider value={services}>
        <IssueScreen team={team} issueId={issue.id} onBack={jest.fn()} />
      </ServicesContext.Provider>
    </SafeAreaProvider>,
  );
  expect(await screen.findByText("테스트 이슈")).toBeOnTheScreen();
  expect(screen.getByText("할 일")).toBeOnTheScreen();
  expect(screen.getByText(user.username)).toBeOnTheScreen();
  expect(
    transport.mock.calls.every(
      ([url]) => !String(url).includes(`/issue/${issue.id}`),
    ),
  ).toBe(true);
});

test("native workspace tabs expose selected state and permission-filtered empty documents", async () => {
  const transport = jest.fn().mockResolvedValue(envelope([]));
  const services = createServices(testConfig, memoryStorage(), transport);
  const setTab = jest.fn();
  await render(
    <SafeAreaProvider>
      <ServicesContext.Provider value={services}>
        <WorkspaceScreen
          team={team}
          user={user}
          tab="documents"
          setTab={setTab}
          onBack={jest.fn()}
          openChannel={jest.fn()}
          openDocument={jest.fn()}
          openIssue={jest.fn()}
        />
      </ServicesContext.Provider>
    </SafeAreaProvider>,
  );
  expect(await screen.findByText("표시할 문서가 없어요")).toBeOnTheScreen();
  expect(
    screen.getByRole("tab", { name: "문서", selected: true }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("tab", { name: "이슈" }));
  expect(setTab).toHaveBeenCalledWith("issues");
});
