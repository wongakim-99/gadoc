# 웹 중심 데스크톱 안정화

## 업데이트 경계

Windows/macOS 앱은 원격 Slacord 웹을 로드하는 얇은 Electron 셸이다. 채팅, 문서, 이슈, 검색, 권한 안내와 통화 UI는 웹 배포로 업데이트한다. 새 문서는 새 웹 번들을 로드하며 이미 열린 페이지는 재로드가 필요하다. 통화나 작성 중인 문서를 임의로 새로고침하지 않는다.

네이티브 기능은 `@slacord/contracts`의 좁은 preload API를 통해 호출한다. `bridgeVersion: 2`, `onNavigate`, `setBadgeCount`는 추가 기능이며 웹은 메서드 존재 여부를 확인한다. 기존 셸에서도 새 웹을 열 수 있다. 기존 설치본에 트레이·화면 선택·배지 등 새 네이티브 기능을 전달하려면 셸 설치 파일을 한 번 배포해야 한다. 이후 OS API/Chromium/Electron 변경은 셸 릴리스, 제품 기능 변경은 웹 릴리스로 구분한다.

| 영역 | 구현 및 검증 |
| --- | --- |
| 다운로드 | 실제 공개 GitHub 최신 릴리스의 업로드 완료된 파일만 노출. 존재하지 않는 1.0.10 하드코딩 링크 제거. API 실패 시 릴리스 페이지로 안내. |
| Electron 수명주기 | Windows/macOS 창 닫기는 숨김, 트레이에서 다시 열기/명시적 종료. Windows 기본 창 버튼 및 AppUserModelID 적용. 패키징 앱 중복 실행 방지. |
| 네이티브 알림 | 소유 창 복원/포커스, 새 웹의 SPA 경로 이동, 구형 웹의 동일 origin URL 이동, macOS Dock 배지 및 Windows 오버레이/주의 표시. 알림 패널에 시스템 알림 테스트 추가. |
| 웹 알림 | 현재 워크스페이스의 다른 채널/DM도 수신. 현재 읽는 채널의 일반 메시지 알림 억제. 메시지와 멘션 중복 알림 방지. 소켓 재연결 시 채널/알림 방 재참여와 알림 목록 재조회. 읽음 수는 서버와 재동기화. |
| 미디어 | 음성 전용 호출에도 별도 audio 재생. 초기 SDP에서 영상 슬롯 협상. 답변자는 제공받은 transceiver 재사용. ICE 후보 임시 보관. 다른 탭의 소켓 종료가 통화를 끊지 않도록 소켓 소유권 확인. 늦은 참여/권한 요청 취소 및 종료 자원 정리. |
| 화면 공유 | 지원 OS에서는 시스템 선택기 사용, 그 외에서는 화면/창을 명시적으로 선택. 취소/권한 오류를 정상 종료. 전체 화면 자동 선택 제거. |
| 권한/보안 | 전역 팀 권한 가드에서 JWT 인증 먼저 실행. 네이티브 IPC는 신뢰하는 최상위 프레임만 허용. 외부 링크 프로토콜 제한, 알림 경로의 origin 이탈 차단. |
| 문서/휴지통 | 일반 멤버의 휴지통 링크 숨김. 직접 접근 시 403 권한 안내, 조회/복원 실패 처리. 문서 생성 오류/진행 상태 표시. |
| 검색 | 큰 설명 카드 대신 단일 결과 목록. 입력창 초기 포커스, 방향키/Enter/Escape, 한글 IME 조합 처리. 부모 재렌더로 검색 포커스를 잃지 않도록 포커스 트랩 콜백 안정화. |
| 연결 복구 | 웹 응답이 JSON이 아닌 오류도 사용자 안내로 처리. 워크스페이스 초기 조회 실패 재시도. 원격 웹 로드 실패 시 네이티브 재연결 화면. 브리지 작업자의 DB 오류를 처리하여 서버 프로세스 종료 방지. |

## 로컬 검증

2026-09-10~11, macOS의 Orca 내장 브라우저 두 개의 독립 로그인 프로필, `localhost:3002`, 로컬 API `127.0.0.1:8082`, 별도 MongoDB 테스트 DB를 사용했다. 외부 Discord 알림은 테스트 서버에서 비활성화했다.

- 회원가입/로그인, 워크스페이스 생성 및 초대 참여, 채널 메시지 저장과 새로고침.
- 문서 생성, 블록 내용 저장과 재조회, 이슈 생성/할당 및 상대 계정 알림 이동.
- 공지 생성/고정 후 새로고침 유지, DM 생성과 다른 화면에서 알림 수신/배지 증가.
- 관리자 휴지통과 일반 멤버 직접 URL 접근: 일반 멤버는 오류 오버레이 없이 권한 안내를 표시.
- 검색 입력 포커스, 방향키 두 번과 Enter로 문서 이동.
- 실제 RTCPeerConnection/Socket.IO를 사용한 두 계정 연결. 합성 오디오와 canvas 영상 입력으로 검증했으며 장치 입력과 실제 소리 청취 검증은 별개다. 음성 전용 최종 확인에서 양쪽 inbound audio 48,039 / 62,422 bytes, audio 요소 paused=false. 영상 양쪽 320×240 디코드, 화면 공유 및 카메라 복귀 확인. 종료 후 모든 테스트 트랙 ended와 peer closed 확인.
- Electron 실행 스모크: 동일 프로세스에서 서버의 웹 버전을 1→2로 교체하고 새로고침한 뒤 preload bridge v2 및 실제 getUpdateStatus IPC 유지 확인.
- 웹 67개, 서버 112개, 데스크톱 32개 테스트 통과. 각 패키지 빌드/타입 검사 시행. Windows/macOS/Linux 데스크톱 CI 매트릭스 추가.

## 아키텍처 평가와 남은 검증

완전한 클린 아키텍처는 아니다. 서버는 domain/application/infrastructure 구분이 있지만 일부 application이 Mongoose 스키마·외부 클라이언트·WebSocket gateway를 직접 참조한다. 이번 변경에서는 알림 발행 포트를 추가해 알림 use case 세 곳의 gateway 직접 의존을 제거했다. 프런트엔드는 기능별 디렉터리와 미디어/시그널링 헬퍼를 분리했으나 `useHuddle`의 미디어 수명주기와 복구 제어는 아직 큰 훅에 남아 있다.

- 실기기 마이크/카메라와 스피커, 다른 네트워크의 TURN relay, 장시간 연결/절전 복구는 추가 실환경 검증 대상이다.
- 네이티브 알림 단위 테스트는 OS API mock을 사용한다. macOS 실제 Electron 실행은 확인했지만 Windows 설치형 앱의 알림 센터·서명·설치/업데이트는 Windows CI/실기기에서 확인해야 한다.
- 시스템 알림은 앱이 실행 중일 때 수신한다. 트레이로 숨긴 상태는 유지하지만 완전히 종료한 상태의 OS push 서비스는 구현 범위 밖이다. 현재 워크스페이스의 알림을 구독하며 모든 워크스페이스의 상시 통합 구독은 별도 작업이다.
- 파일 저장소/외부 Slack·Discord·Confluence·GitHub 연동의 운영 계정 E2E와 새 서명 설치 파일 발행은 수행하지 않았다.
- 이번 소스 push와 Windows/macOS 설치 파일 릴리스는 별개다. 존재하지 않는 설치 파일을 다운로드 페이지에 미리 노출하지 않는다.

## 관련 공식 문서

- [Electron 알림](https://www.electronjs.org/docs/latest/tutorial/notifications)
- [Electron display media 선택기](https://www.electronjs.org/docs/latest/api/session)
- [Electron IPC 보안](https://www.electronjs.org/docs/latest/tutorial/security)
- [Next.js 환경 변수의 정적 치환](https://nextjs.org/docs/pages/guides/environment-variables)
