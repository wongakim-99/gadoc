# GaDoc 데스크톱 릴리즈

## 배포 정책

기존 v1.1.1은 미서명 배포이며 공증·자동 업데이트 기준 버전으로 안내하지 않는다.
기본 서비스 주소는 https://gadoc.kr, 공식 배포 저장소는 https://github.com/kscold/gadoc 이다.
구 slacord.cloud 연결은 기존 설치본 전환 검증이 끝날 때까지 유지한다.

새 설치 앱 이름과 파일명은 GaDoc이다. 기존 앱 ID `com.kscold.slacord`, Windows 업그레이드
식별자와 기존 Slacord 프로필은 유지해 환경 설정·로그인을 임의로 초기화하지 않는다.

## 발행 순서

1. 전체 회귀·의존성 검사·필수 PR CI를 통과시킨다.
2. 검토된 기능을 dev에서 main으로 승격하고 실제 운영 배포 SHA를 확인한다.
3. `pnpm version:all <version>`으로 패키지 버전을 동기화하고 해당 버전의 릴리즈 설명을 작성한다.
4. 검증한 main 커밋에 태그를 만들고 그 태그 하나만 원격에 push한다.
5. macOS arm64 DMG·ZIP과 Windows x64 EXE 작업이 모두 성공해야 한다.
6. macOS는 서명·공증이 필수이며 자격 증명 누락을 미서명 성공으로 처리하지 않는다.
7. 각 OS에서 생성한 검증 기록과 파일 해시·버전·업데이트 메타데이터를 대조한다.
8. `desktop-verification.json`, `SHA256SUMS.txt`, 설명과 모든 설치 파일을 draft에 올린 뒤 공개한다.
9. 실제 내려받은 설치 파일의 실행·로그인·복사·도메인 전환과 다운로드 페이지를 확인한다.

이미 공개한 파일은 덮어쓰지 않는다. 일부 작업만 성공하면 공개하지 않고 draft에서 재시도한다.
웹 배포가 기존 설치 프로그램을 교체하는 것은 아니다. 실제 기기 확인을 CI 통과로 대체하지 않는다.

## 서명·공증 근거

- `check-desktop-release-secrets.mjs --allow-unsigned --require-mac-notarized`로 macOS 필수·Windows 선택 정책을 검사한다.
- macOS는 Developer ID Application 서명과 지정한 팀 ID, hardened runtime, 앱 식별자를 검사한다.
- 앱·DMG·압축을 푼 ZIP의 코드 서명·공증 티켓·Gatekeeper 검사까지 통과해야 한다.
- DMG 공증 제출 응답의 `Accepted`를 확인하고 티켓 첨부 후 해시·blockmap을 갱신한다.
- Windows는 Authenticode의 실제 `Valid` 또는 `NotSigned` 상태만 허용한다. 손상된 서명은 실패한다.
- 최종 게시 단계는 검증 후 파일이 변했거나 기록이 누락·불일치하면 실패한다.
- Secret 유무만으로 서명 완료를 표시하지 않으며 자격 증명 값은 로그·문서·앱에 포함하지 않는다.

공증용 인증은 앱 전용 암호 또는 팀 API 키 한 가지를 사용한다. CI의 API 키는
`APPLE_API_KEY_BASE64`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`로 전달한다.
서명 인증서는 `CSC_LINK`, `CSC_KEY_PASSWORD`로 전달하고 `APPLE_TEAM_ID`와 일치시킨다.
개별 사용자 API 키는 `notarytool`에 사용할 수 없으므로 팀 키와 혼동하지 않는다.

macOS는 검증된 첫 서명 버전도 DMG 수동 설치 정책을 유지한다. Windows 미서명 파일에는
SmartScreen 경고를 명확히 안내한다. 보안 설정을 일괄 해제하도록 안내하지 않는다.
