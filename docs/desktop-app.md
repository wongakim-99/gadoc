# 가독 GaDoc 데스크톱

가독 데스크톱은 웹 서비스를 표시하는 Electron 앱이다. 소스와 관련 문서는
**kscold(김승찬) / Colding**의 독점 소유이며 [LICENSE](../LICENSE)를 따른다.
MIT 라이선스가 아니다.

## 지원 플랫폼과 현재 정책

| 플랫폼              | 공개 설치 파일           | 업데이트                        |
| ------------------- | ------------------------ | ------------------------------- |
| macOS Apple Silicon | arm64 DMG, 릴리즈용 ZIP  | 새 DMG 수동 설치                |
| Windows x64         | NSIS EXE                 | 앱 내 확인·다운로드·재시작 적용 |
| Linux / Intel Mac   | 현재 전용 설치 파일 없음 | 웹 서비스 사용                  |

현재 공개 버전 1.1.1은 macOS 서명·공증과 Windows 코드 서명이 없는 릴리즈다.
CI가 여러 OS에서 통과하는 것과 각 OS용 서명된 설치 파일을 제공하는 것은 다르다.
최신 배포 파일과 실제 서명 상태는 [GitHub Releases](https://github.com/kscold/gadoc/releases/latest)에서 확인한다.

Gatekeeper·SmartScreen 경고가 발생할 수 있다. 릴리즈의 `SHA256SUMS.txt`를 확인하고,
설치가 차단되면 웹 서비스를 사용한다. 시스템 보안 설정을 일괄 해제하지 않는다.
Apple 계정 로그인이나 서명 환경 변수 설정만으로 공증이 완료된 것으로 안내하지 않는다.

## 구성과 호환성

- [desktop](../packages/desktop/package.json): Electron main process·preload, electron-builder 패키징, electron-updater.
- [contracts](../packages/contracts/package.json): 웹·데스크톱의 공유 IPC 계약.
- 새 설치 앱은 `https://gadoc.kr/auth/login`을 표시한다. 구 도메인은 기존 설치본 전환 기간에만 유지한다.
- 새 제품 이름·파일 이름은 GaDoc이며, 기존 앱 ID `com.kscold.slacord`와 설치·업데이트 식별자는 유지한다.
- 기존 Slacord 프로필은 호환성을 위해 재사용하고 새 설치는 GaDoc 프로필을 사용한다.
- 원격 웹 콘텐츠에는 `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`를 유지한다.

웹 배포만으로 설치된 Electron 실행 파일이 교체되지는 않는다. 네이티브 창·권한·시작 주소를
수정했다면 새 설치 파일이 필요하다. 버전별 변경은 [릴리즈 기록](./releases/v1.1.1.md)을 참고한다.

## 개발과 로컬 패키징

소스 사용 허가를 받은 개발자는 모노레포 루트에서 실행한다. Node·pnpm 버전과
서버·저장소 준비는 [README](../README.md)와 [실행 프로필](./runtime-profiles.md)을 따른다.

```bash
pnpm dev:desktop
pnpm test:desktop
pnpm build:desktop
pnpm dist:desktop
pnpm dist:desktop:win
```

`pnpm dev:desktop`은 웹 개발 서버와 Electron shell을 함께 띄운다. 백엔드·MongoDB·저장소는
별도로 준비해야 한다. 로컬 패키징 결과는 `packages/desktop/release/`에 저장되며,
`dist:desktop` 계열 명령은 릴리즈를 공개하지 않는다. macOS 패키징은 Mac 환경에서 진행한다.

## 서명과 공증 준비

| 용도               | 필요한 환경 변수                                                                       |
| ------------------ | -------------------------------------------------------------------------------------- |
| GitHub 릴리즈 게시 | `GH_TOKEN`                                                                             |
| macOS 서명         | `CSC_LINK`, `CSC_KEY_PASSWORD`                                                         |
| Apple 공증         | `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`                             |
| Apple API 키 공증  | `APPLE_API_KEY`(로컬 p8 경로), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_TEAM_ID` |
| Windows 서명       | `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`                                                 |

인증서·비밀번호는 GitHub Secrets 또는 승인된 비밀 저장소에서 전달한다.
소스·문서·PR 본문에 값을 기록하지 않는다. macOS 사전 점검은 다음 명령을 사용한다.

```bash
pnpm release:desktop:preflight --target=mac
```

새 릴리즈 워크플로우는 macOS 서명·공증을 필수로 요구한다. Windows만 서명 정보가 전혀
없는 경우 미서명 배포를 허용하며, 일부만 설정된 그룹은 실패시킨다. Apple 공증 인증은
앱 전용 암호와 팀 API 키 중 한 가지를 선택한다. CI의 p8 파일은
`APPLE_API_KEY_BASE64` Secret에서 일시 생성한 뒤 항상 삭제한다.
로컬에서는 `APPLE_KEYCHAIN_PROFILE`에 저장한 공증 인증도 사용할 수 있다.
팀 API 키는 특정 앱으로 범위를 제한할 수 없으므로 관리자 권한 대신 필요한 최소 역할로 발급한다.

`verify-desktop-platform.mjs`는 실제 OS에서 macOS 앱·DMG·ZIP의 코드 서명, 팀 ID,
공증 티켓, Gatekeeper 검사를 수행한다. DMG 자체도 Apple에 제출해 `Accepted`를 확인하고
티켓을 첨부한 뒤 업데이트 해시와 blockmap을 다시 만든다. Windows는 실제 Authenticode
검사로 서명 여부를 결정한다. 인증 정보가 존재한다는 이유만으로 완료로 표시하지 않는다.
게시 단계는 파일 해시와 일치하는 `verification-*.json`을 요구하며,
`desktop-verification.json`을 설치 파일·체크섬과 함께 공개한다.

서명·공증 검증이 끝나기 전에는 macOS 자동 업데이트를 활성화된 기능으로 안내하지 않는다.
서명된 첫 버전으로 전환할 때는 기존 미서명 앱에서 한 번 수동 설치가 필요할 수 있다.

## 릴리즈 순서

1. [릴리즈 체크리스트](./desktop-release-checklist.md)에 따라 테스트·빌드·필수 CI를 통과시킨다.
2. 검토된 변경을 `main`에 반영하고 배포한 커밋을 확인한다.
3. `pnpm version:all <version>`으로 자체 패키지 버전을 맞추고 릴리즈 설명·다운로드 안내도 갱신한다.
4. 검증한 커밋에 태그를 만들고 **해당 태그 하나만** `git push origin refs/tags/vX.Y.Z`로 전송한다. `vX.Y.Z`는 실제 버전으로 바꾼다.
5. GitHub Actions가 macOS DMG/ZIP과 Windows NSIS 파일을 만들고, 필수 파일·버전·업데이트 메타데이터를 검증한 뒤 릴리즈를 공개한다.
6. 공개 설치 파일, 체크섬, 서명·공증 결과와 다운로드 페이지를 확인한다.

전체 태그를 한꺼번에 push하지 않는다. 다른 클론에 남은 폐기 태그가 원격에 다시 생성될 수 있다.
이미 공개한 릴리즈 파일을 덮어쓰지 않는다. `release:desktop:mac`·`release:desktop:win`은
게시 권한을 사용하는 명령이므로 단순 로컬 빌드 대신 실행하지 않는다.

## 서비스 도메인을 변경할 때

시작 URL과 허용 origin은 [데스크톱 설정](../packages/desktop/src/main/config.ts)에 포함된다.
DNS만 바꾸거나 임의의 환경 변수를 설정하는 것으로 배포된 앱의 허용 도메인이 바뀌지는 않는다.

서비스 도메인을 확정하고 HTTPS·API·Socket 연결·인증을 검증한 뒤, 앱의 시작 URL과
허용 origin을 함께 수정하고 새 버전을 빌드·서명·공증한다. 다운로드 파일의 위치만 바꾸는 경우와
앱 안의 설정을 수정하는 경우를 구분한다. 기존 사용자 전환 계획 없이 이전 도메인을 즉시 없애지 않는다.
