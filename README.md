# 가독 GaDoc

일의 가닥이 잡히는 곳.

대화, 문서, 할 일을 한곳에서.

> https://slacord.cloud

## 기능

### 실시간 채팅

- 채널 기반 팀 대화 (public / private / DM / 소그룹)
- 이모지 반응, 메시지 편집/삭제, 핀 고정
- 타이핑 표시, 스레드 답글
- 파일 첨부 (MinIO 오브젝트 스토리지)

### 허들 (음성/영상통화)

- WebRTC Mesh P2P 기반 (4명 이하 소규모 팀)
- 음성 채널 + 텍스트 채널 내 허들 시작
- 마이크/카메라 토글, 화면 공유

### 이슈 트래커

- 칸반 보드 (할 일 → 진행 중 → 리뷰 → 완료)
- 담당자 배정, 우선순위, 라벨

### 문서/위키

- BlockNote 리치 에디터 (노션 스타일 블록 편집)
- 문서 트리 구조 (상위/하위 문서)
- RBAC 권한 (문서별 열람/편집 제한)
- 아카이빙 (소프트 삭제 + 복원)
- 버전 히스토리 (수정 시 자동 스냅샷)
- Confluence 문서 일괄 가져오기

### 공지사항

- 팀 전체 공지, 핀 고정

### 데스크톱 앱

- Electron 기반 (macOS / Windows)
- 자동 업데이트 (GitHub Releases)
- 네이티브 알림

### 기타

- 팀원 온라인 프레즌스
- GitHub Webhook 알림 연동
- 디스코드 봇 연동 (회원가입/에러 모니터링)
- 모바일 반응형 레이아웃

## 기술 스택

| 영역           | 기술                                                      |
| -------------- | --------------------------------------------------------- |
| **백엔드**     | NestJS 11, TypeScript, MongoDB (Mongoose), Socket.IO, JWT |
| **프론트엔드** | Next.js 16, TypeScript, Tailwind CSS v4, Zustand          |
| **데스크톱**   | Electron 45, electron-updater                             |
| **스토리지**   | MinIO (S3 호환 오브젝트 스토리지)                         |
| **인프라**     | Docker, Colima, Nginx, PM2                                |
| **아키텍처**   | 헥사고날 (Ports & Adapters), FSD (Feature-Sliced Design)  |

## 패키지 구성

```
packages/
├── server/      NestJS 백엔드
├── web/         Next.js 프론트엔드
├── desktop/     Electron 데스크톱 앱
└── contracts/   공유 타입 정의
```

## 로컬 실행 프로필

현재 코드 기준 로컬 서버/웹을 띄우면서 컨테이너로 포워딩된 MongoDB/MinIO를
함께 쓰는 실행 프로필이 있습니다. 통합 검증은 운영 데이터가 아닌 격리 저장소를 기본으로 사용합니다.

- 개발 프로필: `config/profiles/local-container.env`
- 통합 검증: `config/profiles/isolated-test.env` (Mongo 27127, MinIO 19000, 서버 18094, 웹 3202)
- Discord mock 검증: `config/profiles/isolated-discord-mock.env`
- 민감값 override: `config/profiles/*.local.env` (gitignored)

Node 22.12 이상과 `packageManager`에 고정된 pnpm 10.34.9를 사용합니다. Yarn은 사용하지 않습니다.

```bash
corepack enable
pnpm install --frozen-lockfile
```

자주 쓰는 명령:

```bash
pnpm profile:print
pnpm dev:stack:profile
pnpm build:server
pnpm build:web:profile
pnpm start:stack:profile
pnpm verify:full
```

상세 동작과 override 예시는 [runtime-profiles.md](./docs/runtime-profiles.md)에서
확인할 수 있습니다.

## 보안 검증

확인한 문제, 수정 내용, 운영 반영 전 남은 항목은
[2026-10-27 보안 점검 기록](./docs/security-review-2026-10-27.md)에 정리했습니다.
가독 첨부는 `gadoc` 비공개 버킷에 저장하고 팀·채널·문서 권한 검증을 거쳐 제공합니다. 블로그 공개 정책은 변경하지 않습니다.

## AI 연결과 공동 편집

워크스페이스 설정의 **AI 연결**에서 연결 키를 발급합니다. Streamable HTTP MCP 주소는
`https://slacord.cloud/api/mcp`이며 `Authorization: Bearer <발급된 키>` 헤더를 사용합니다.
헤더 인증을 지원하는 MCP 클라이언트가 필요하며 OAuth 자동 연결은 아직 지원하지 않습니다.
기본 읽기 권한과 문서 수정·첨부·데이터베이스 수정 권한을 따로 선택합니다.
키는 발급 시 한 번만 표시되고 만료·폐기가 가능하며, 실제 사용자 권한보다 넓게 접근할 수 없습니다.

AI는 기존 문서와 인라인 데이터베이스를 읽고, 속성·행·관계·롤업·달력/타임라인 보기를 수정합니다.
인라인 블록의 container ID와 실제 source ID가 다를 수 있으므로 `database_container_get`으로 확인합니다.
생성 요청의 `creationId`는 재시도할 때 재사용하고, 수정에는 조회한 revision을 전달합니다.
임의 URL 다운로드나 셸 실행 도구는 제공하지 않습니다. 첨부 업로드 도구는 요청당 2 MiB까지 지원합니다.

문서는 Yjs 변경분을 현재 MongoDB에 저장하며 접속자와 커서를 표시합니다.
공동 편집이 시작된 문서를 REST로 교체할 때에는 최신 `expectedUpdatedAt`이 필요합니다.
연결이 끊겼을 때의 미저장 변경은 현재 탭 메모리에만 남으므로 연결/저장 완료 전 탭을 닫지 마세요.
제목은 별도 자동 저장되며, 본문은 변경분을 병합합니다. 권한은 접속·변경·배포 수신 때 다시 검사합니다.

Notion 전체 기능과 동등하지 않습니다. WBS 의존성 자동 일정 계산, 시간대별 주간 시간표,
오프라인 디스크 보관 및 OAuth MCP 연결은 후속 개발 범위입니다.

## 라이선스

Copyright (c) 2026 kscold (김승찬) / Colding. All rights reserved.

이 소프트웨어는 저작권자의 서면 허가 없이 사용, 복제, 배포할 수 없습니다.
자세한 내용은 [LICENSE](./LICENSE) 파일을 참고하세요.
