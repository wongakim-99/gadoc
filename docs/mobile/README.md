# 가독 iOS / Android 개발 안내

`packages/mobile`은 네이티브 `View`, `Text`, `TextInput`, `FlatList`, `ScrollView`, `Modal`로 구현한 React Native 앱입니다. 문서의 HTML도 파싱한 뒤 네이티브 읽기 요소로 표시합니다. WebView로 웹사이트를 감싸지 않습니다.

Colding / kscold의 독점 소스이며 [LICENSE](../../LICENSE)를 따릅니다. 앱 아이콘은 기존 가독 벡터를 1024px PNG로 렌더링했고 브랜드 이미지는 기존 자산을 복사했습니다. 자체 패키지는 `UNLICENSED`, `private: true`입니다. 모바일 패키지 버전은 초기 개발 버전 `0.1.0`이며 루트·데스크톱 버전을 바꾸지 않습니다.

## 구현 범위

| 흐름         | 동작                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 인증         | 이메일 로그인, 안전한 토큰 저장, `/auth/me` 기반 재실행 복원, 로그아웃                                                   |
| 워크스페이스 | 서버가 반환한 참여 팀과 채널 목록, DM 상대 이름, 안 읽은 수, 채널 보관 표시                                              |
| 채팅         | ISO 날짜 커서로 이전 메시지 조회, 실시간 채널 입장·수신, 전송 ACK 확인, 실패·확인 필요 상태와 수동 재시도                |
| 문서         | 권한으로 필터링된 문서 트리, 제목 검색, 상세·상하위 문서 이동, BlockNote JSON / Markdown / HTML 읽기                     |
| 이슈         | 상태 필터, 상세 제목·상태·우선순위·담당자·라벨, 네이티브 Markdown 읽기                                                   |
| 모바일 동작  | 안전영역, 다크 UI, 시스템 글자 확대, 접근성 이름·선택·오류 상태, 키보드 회피, Android 뒤로 가기, 빈 상태·새로고침·재시도 |

문서·이슈 편집, 첨부 다운로드/업로드, 스레드 전용 탐색·답글 작성, 반응 편집, 푸시 알림, 허들, 가입·초대 참여, 문서 데이터베이스 전체 조작은 이번 범위에 없습니다. 채팅 이력에 포함된 답글은 답글 표시와 함께 읽습니다. 첨부는 파일명을 표시하며 외부 파일을 자동 요청하지 않습니다. 연결된 데이터베이스와 지원하지 않는 문서 블록에는 웹에서 확인하라는 문구를 표시합니다. 웹으로 나갈 때 인증 토큰을 URL에 붙이지 않습니다.

## 검증한 버전과 설치

2026-10-28에 [Expo SDK 58 공식 릴리스](https://expo.dev/changelog/sdk-58), [공식 SDK 호환 표](https://docs.expo.dev/versions/latest/), [Expo 레지스트리](https://registry.npmjs.org/expo/58.0.20), [공식 템플릿 레지스트리](https://registry.npmjs.org/expo-template-blank-typescript/58.0.29)와 설치한 `expo/bundledNativeModules.json`을 대조했습니다.

| 항목              | 고정 기준                                           |
| ----------------- | --------------------------------------------------- |
| Expo              | `~58.0.20`                                          |
| React Native      | `0.88.0` (SDK 58 권장값)                            |
| React / React DOM | `19.3.0`                                            |
| React Native Web  | `~0.21.4`                                           |
| SecureStore       | `~58.0.2`                                           |
| 안전영역          | `react-native-safe-area-context ~5.10.1`            |
| TypeScript        | 공식 템플릿의 `~6.0.3`                              |
| Node / pnpm       | Node `22.13+` 또는 `24.3+` LTS 권장, pnpm `10.34.9` |

이 worktree의 검증 런타임은 설치되어 있던 **Node 22.22.0**입니다. Node 25는 Expo 58의 지원 엔진 범위에 없으므로 선택하지 않습니다. 루트 Node 최소값 22.12보다 모바일 SDK의 최소값이 높습니다.

모바일 전용 worktree의 루트에서 실행합니다. SSD 여유가 **15GiB 미만이면 설치와 빌드를 중단**합니다. 큰 SDK를 자동 설치하지 않습니다.

```sh
# 설치된 지원 Node LTS를 먼저 선택한 상태에서
node --version
pnpm --version
df -h .
node packages/mobile/scripts/install.cjs
```

이 스크립트는 `pnpm --filter @gadoc/mobile... install --config.node-linker=isolated --ignore-scripts --frozen-lockfile`을 실행합니다. 의존성 설치 스크립트와 Electron 다운로드를 실행하지 않습니다. 저장소의 추적된 `nodeLinker: hoisted` 설정은 그대로입니다. 기존 웹의 React 패치와 모바일의 React 인스턴스를 분리하기 위해 이 checkout에서만 isolated 설치를 사용합니다. 데스크톱 개발과 같은 checkout을 번갈아 쓰지 말고 별도 worktree를 사용하세요. [Expo의 pnpm/모노레포 안내](https://docs.expo.dev/guides/monorepos/)도 참고하세요.

Metro와 Jest는 모바일 패키지의 React 인스턴스를 사용하도록 고정합니다. 루트 lockfile에는 모바일 importer와 필요한 의존성 그래프만 추가하며 기존 importer·패키지·snapshot 값은 보존합니다. 의존성 업데이트 때 root 전체의 재해석 결과가 함께 들어가지 않는지 확인해야 합니다.

## 서버 연결과 개발 실행

기본 REST 주소는 `https://gadoc.kr/api`, Socket.IO namespace는 `https://gadoc.kr/chat`입니다. `slacord.cloud`로 자동 대체하지 않습니다. 운영 DB에 직접 연결하거나 테스트 데이터를 넣는 절차는 없습니다.

```sh
pnpm --filter @gadoc/mobile start
```

현재 SDK를 지원하는 Expo Go가 **이미 설치된** 기기에서 개발 서버를 열 수 있습니다. Expo Go의 배포 버전과 프로젝트 SDK가 맞지 않으면 SDK 58을 지원하는 개발 빌드가 필요합니다. 이 작업은 Expo Go 설치·실행을 검증하지 않았습니다. EAS 로그인이나 유료 서비스는 필요하지 않습니다.

설정 예시는 [모바일 .env.example](../../packages/mobile/.env.example)에 있습니다. `EXPO_PUBLIC_*`는 번들에 들어가는 **공개 값**이므로 비밀번호·토큰·API 키를 넣으면 안 됩니다. 주소만 지정하고 실제 로그인 정보는 앱 입력 화면에서 입력합니다.

개발 서버 연결은 운영 데이터와 분리된 서버에서 합니다. 저장소의 [격리 실행 프로필](../runtime-profiles.md)을 먼저 확인하세요. 프로필이 어떤 DB를 가리키는지 확인 없이 서버를 실행하거나 초기화하지 않습니다.

| 실행 위치          | 격리 서버 예시                                                      |
| ------------------ | ------------------------------------------------------------------- |
| iOS 시뮬레이터     | `http://127.0.0.1:18094/api`                                        |
| Android 에뮬레이터 | `http://10.0.2.2:18094/api`                                         |
| 물리 기기          | 같은 개발 네트워크의 서버 LAN IP 또는 별도로 준비된 개발 HTTPS 주소 |

앱은 `/api`로 끝나는 절대 주소만 받습니다. 사용자명·비밀번호·쿼리·fragment가 포함된 주소는 거부합니다. HTTP는 개발 모드의 loopback·사설 IP에서만 허용합니다. 배포 번들은 HTTPS만 사용합니다.

개발용 네이티브 바이너리에서 LAN/localhost HTTP가 필요하면 패키지의 gitignored `.env.local`에 공개 개발 주소와 `GADOC_MOBILE_DEV_HTTP=1`을 넣은 뒤 네이티브 설정을 다시 생성합니다. iOS에는 로컬 네트워크 예외만, Android에는 개발용 cleartext 옵션을 적용합니다. 운영 빌드에서는 이 변수를 제거하고 HTTPS로 설정한 뒤 다시 prebuild해야 합니다. `NODE_ENV=production`에서 개발 HTTP 플러그인을 실행하면 실패하도록 했습니다. `__DEV__`가 꺼진 앱도 HTTP 주소를 거부합니다.

## iOS / Android 로컬 빌드

공통 식별자는 **`com.kscold.gadoc.mobile`**입니다. 데스크톱 `com.kscold.slacord`는 변경하지 않습니다. 별도 URL scheme은 `gadoc-mobile`이며 외부 링크에 토큰을 받는 자동 로그인은 없습니다.

Expo Continuous Native Generation을 사용합니다. 생성된 `ios/`, `android/`는 gitignored이며 원본은 `app.config.ts`와 `plugins/with-transport.cjs`입니다. 생성 폴더에 수동으로 중요한 설정을 넣지 마세요.

```sh
# SDK나 CocoaPods 설치 없이 양쪽 프로젝트 파일만 생성
pnpm --filter @gadoc/mobile prebuild
pnpm --filter @gadoc/mobile check:native-config
```

기본 설정 검사에는 앱 식별자, iOS ATS, Android cleartext 차단, 백업 제외, 키보드 resize, 카메라·마이크·외부 저장소 권한 제외, Gradle SDK 자동 다운로드 차단이 포함됩니다. 개발 HTTP가 켜진 생성 결과에는 운영용 설정 검사를 사용하지 않습니다.

**iOS:** SDK 58 공식 기준은 iOS 16.4+, Xcode 26.4+입니다. 전체 Xcode와 호환 시뮬레이터, CocoaPods 1.15.2+가 이미 준비된 개발 환경에서 생성된 `ios` 폴더의 pod 의존성을 준비한 뒤 다음을 실행합니다. `ios` 스크립트는 `--no-install`을 사용하므로 패키지·Pods 도구를 자동 설치하지 않습니다.

```sh
pnpm --filter @gadoc/mobile ios
```

시뮬레이터 실행에는 배포 인증서가 필요하지 않습니다. 실제 기기 빌드·Archive에는 소유자가 별도로 준비한 Apple 개발 팀·프로비저닝이 필요합니다. 인증서·키·프로비저닝을 이 저장소에 넣지 않습니다.

**Android:** SDK 58 공식 표는 Android 7+ / compile SDK 37 / target SDK 36입니다. 호환 JDK·Android SDK·에뮬레이터가 이미 설치된 개발 환경에서 `ANDROID_HOME`과 도구 경로를 선택한 뒤 실행합니다.

```sh
pnpm --filter @gadoc/mobile android
```

이 명령도 `--no-install`을 사용합니다. Gradle에 `android.builder.sdkDownload=false`를 설정해 부족한 Android SDK를 자동 설치하지 않도록 했습니다. Gradle 자체와 Maven 빌드 의존성 다운로드는 발생할 수 있습니다. 여유 공간을 계속 확인하고 15GiB 미만이면 중단해야 합니다. Release 서명 키·Play Console·AAB 제출 설정은 소유자가 별도로 준비해야 하며 기본 debug 키를 배포에 사용하지 않습니다.

스토어 승인, TestFlight/GPlay 제출, EAS 로그인, 인증서 발급, 운영 배포, DNS·SSL·SSH·Docker 변경은 이 작업에서 실행하지 않습니다.

## 세션·개인정보·오류 처리

- JWT 한 개만 iOS Keychain / Android Keystore 기반 [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)에 저장합니다. 별도 서비스 이름과 iOS `WHEN_UNLOCKED_THIS_DEVICE_ONLY`를 사용하며 Android 백업에서 제외합니다. 사용자·본문·초안을 평문 파일이나 AsyncStorage에 저장하지 않습니다.
- 복원 시 `/auth/me`가 401이면 저장 토큰을 제거합니다. 403, 네트워크 단절, 시간 초과, 잘못된 응답은 복원 재시도 화면으로 보내며 저장 토큰을 유지합니다. 과거 토큰의 늦은 401이 새 로그인을 지우지 못하게 합니다.
- 보안 저장소에 쓰지 못하면 로그인 성공 상태로 전환하지 않습니다. 로그아웃 시 저장소 삭제가 실패하면 잠금 오류 화면에서 삭제를 재시도합니다. 삭제 성공을 확인하기 전 로그아웃 완료로 표시하지 않습니다.
- 로그인은 서버의 `rememberMe: true` 계약으로 30일 JWT를 받습니다. refresh API는 없습니다. 서버 logout은 쿠키 제거만 수행하고 JWT를 폐기하지 않으므로 모바일은 로컬 토큰을 삭제합니다. iOS Keychain은 앱 삭제 후에도 남을 수 있으며 서버 토큰 만료·폐기 정책과 별개입니다.
- HTTP는 Bearer 헤더·`credentials: omit`·`cache: no-store`, Socket.IO는 `auth.token`을 사용합니다. 토큰을 URL이나 socket query에 넣지 않습니다. 본문·토큰·원시 오류 응답·플랫폼 오류 원문을 로그에 남기는 코드가 없습니다.
- 앱이 비활성화되면 개인정보를 가리는 화면을 표시하고 조회 요청·소켓을 중단합니다. 복귀 시 권한과 최신 내용을 다시 조회합니다. OS의 화면 캡처 방지를 보장하는 기능은 아닙니다.
- 웹 export는 UI 미리보기입니다. 토큰은 메모리에만 남고 새로고침 시 다시 로그인합니다. localStorage·sessionStorage·IndexedDB·서비스 워커에 인증 정보를 기록하지 않습니다.

403이 오면 이전 조회 본문을 제거하고 권한 오류를 표시합니다. 문서의 숨겨진 부모 이름을 추측하거나 별도 권한 우회 API를 호출하지 않습니다. 서버에서 목록·본문을 다시 검사하며 채팅 guest·보관 채널에는 입력란을 제공하지 않습니다. 실제 최종 권한 판단은 서버에 있습니다.

채팅 전송에는 서버 idempotency 키가 없습니다. ACK를 못 받은 메시지를 자동 재전송하지 않습니다. 연결 전 실패는 `전송하지 못했어요`, 전송 후 시간 초과·단절은 `전송 확인 필요`로 표시합니다. 후자는 중복 가능성 확인 후 수동 재시도합니다. 방송 이벤트와 ACK는 서버 message ID로 합치며 같은 내용의 서로 다른 메시지를 임의로 합치지 않습니다. 실패 항목은 현재 세션 메모리에서 채널을 다시 열어 재시도할 수 있지만 앱 종료·로그아웃 시 사라집니다. 아직 전송하지 않은 입력칸의 글은 화면을 떠나면 사라집니다.

본문 링크는 안전한 절대 HTTP(S)/mailto 주소만 확인창을 거쳐 외부 앱으로 엽니다. 외부 이미지·iframe·HTML 스크립트를 자동 실행·요청하지 않습니다. 긴 문서는 50만 자·1,200블록·중첩 깊이 제한을 적용하고 생략 여부를 표시합니다.

## 실제 검증 기록

2026-10-28 이 worktree의 결과입니다. 모든 테스트 데이터와 캡처는 합성 데이터이며 운영 계정·DB·사용자 본문을 사용하지 않았습니다.

```sh
pnpm --filter @gadoc/mobile typecheck
pnpm --filter @gadoc/mobile test
pnpm --filter @gadoc/mobile check:expo
pnpm --filter @gadoc/mobile run doctor
pnpm --filter @gadoc/mobile prebuild
pnpm --filter @gadoc/mobile check:native-config
pnpm --filter @gadoc/mobile export:native
pnpm --filter @gadoc/mobile export:web
node packages/mobile/scripts/verify-web-preview.mjs
pnpm test:metadata
```

- 타입검사, Jest의 네이티브 컴포넌트·모델·본문 파서·실제 로컬 Socket.IO 테스트를 실행합니다. React Native 컴포넌트 테스트는 Jest의 네이티브 모듈 mock을 사용하는 테스트이며 실제 iOS/Android OS 실행은 아닙니다.
- Expo 의존성 정합성 검사는 통과했습니다. 네이티브 폴더 생성 전 Expo Doctor는 20/20 통과했습니다. 생성 후에는 CocoaPods 부재로 native tooling 검사 1개가 실패하고 나머지 19개가 통과했습니다. 이를 건너뛰어 바이너리 검증으로 표시하지 않습니다.
- `prebuild --no-install`로 iOS·Android 프로젝트 파일을 만들고 생성 설정 검사를 통과했습니다. Pods·Android SDK는 설치하지 않았습니다.
- iOS와 Android 각각 Hermes `.hbc` 번들을 생성했습니다. IPA/APK/AAB 컴파일·링크·실기기 설치 검증과는 별개입니다.
- Web export와 390px 합성 브라우저 흐름은 로그인 → 워크스페이스 → 문서·이슈 읽기, 가로 넘침과 브라우저 토큰 미보관을 검사합니다. 기존 Playwright 브라우저가 없는 환경에서는 설치하지 않고 실패합니다.

최종 검증에서 모바일 테스트 **34/34**, 저장소 메타데이터 검사 **5/5**, 타입검사·의존성 정합성·양 플랫폼 Hermes export·web export·합성 브라우저 흐름이 통과했습니다. [로그인 미리보기](assets/login-web-preview.png), [문서 읽기 미리보기](assets/document-web-preview.png), [이슈 읽기 미리보기](assets/issue-web-preview.png)는 React Native Web 렌더링이며 기기 캡처가 아닙니다.

이 환경은 Xcode Command Line Tools만 있으며 전체 Xcode·Android SDK·CocoaPods·서명 자격증명이 없습니다. 실제 기기에서 키보드/회전/접근성 읽기 순서, Keychain·Keystore 재실행, 네트워크 전환, 앱 종료·복귀, 권한 회수, 인증 만료, 다자간 실시간 수신, iOS/Android release 빌드는 후속 인수 검증 항목입니다. 스토어 승인이나 운영 배포 완료를 주장하지 않습니다.
