# 가독 GaDoc

문서의 가닥이 잡히는 곳.

대화, 문서, 할 일을 한곳에서.

**Colding / kscold(김승찬) 소유의 독점 소프트웨어입니다. MIT 라이선스가 아닙니다.**
소스 저장소 공개는 자유 사용·수정·재배포 허가를 의미하지 않습니다. 사용 조건은
[LICENSE](./LICENSE)에 따르며, 저작권자의 사전 서면 허가가 필요합니다.

[웹 서비스](https://gadoc.kr) · [설치 파일과 릴리즈](https://github.com/kscold/gadoc/releases/latest) · [변경 이력](./CHANGELOG.md)

## 현재 배포 상태

- 제품 이름과 저장소는 **가독 GaDoc / `kscold/gadoc`**입니다. 새 서비스 주소는 `https://gadoc.kr`이며, `slacord.cloud`는 기존 앱·링크의 전환 검증이 끝날 때까지만 호환을 유지합니다.
- 현재 공개 데스크톱 버전은 [GitHub Releases](https://github.com/kscold/gadoc/releases/latest)에서 확인합니다. **1.1.2** 배포 코드를 준비했으며 웹의 `main` 배포와 설치 파일 발행은 별개입니다.
- macOS Apple Silicon에는 DMG, Windows x64에는 NSIS 설치 파일을 제공합니다. Linux 설치 파일은 제공하지 않습니다.
- 1.1.1은 macOS 서명·공증과 Windows 코드 서명이 없는 릴리즈입니다. macOS는 새 DMG를 수동 설치하며, 서명·공증된 자동 업데이트 기준 버전으로 안내하지 않습니다.
- 설치 파일은 릴리즈의 `SHA256SUMS.txt`와 비교하세요. 보안 경고가 발생하면 시스템 보호를 일괄 해제하지 말고 웹 서비스를 이용하세요.

세부 변경은 [1.1.2 릴리즈 기록](./docs/releases/v1.1.2.md)과 [1.1.1 릴리즈 기록](./docs/releases/v1.1.1.md), 패키징·업데이트 정책은
[데스크톱 앱 안내](./docs/desktop-app.md)를 참고하세요.

## 주요 기능

아래는 현재 `main`에 반영된 기능입니다. 설계 문서나 다른 작업 브랜치에 있는 내용을
모두 출시된 기능으로 간주하지 않습니다.

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
- Yjs 기반 공동 편집, 접속자·커서 표시와 자동 저장

### 문서 데이터베이스

- 문서 안의 인라인 데이터베이스와 연결된 보기
- 속성·행 편집, 관계·롤업·수식, 달력·타임라인 보기
- 문서 데이터베이스를 이슈 보드의 소스로 연결
- 리비전 기반 동시 수정 충돌 검사와 워크스페이스 접근 제어

### 공지사항

- 팀 전체 공지, 핀 고정

### 데스크톱 앱

- Electron 기반 (macOS / Windows)
- Windows 앱 내 업데이트 확인·다운로드·재시작 적용, macOS 수동 DMG 업데이트
- 네이티브 알림
- 사진·스레드 첨부 미리보기와 로그인 상태를 유지하는 비공개 첨부 다운로드

### 기타

- 팀원 온라인 프레즌스
- GitHub Webhook 알림 연동
- 디스코드 봇 연동 (회원가입/에러 모니터링)
- 모바일 반응형 레이아웃
- 가입·로그인·워크스페이스 접근 활동 기록과 관리자 조회 API

## 워크스페이스 참여

회원가입과 워크스페이스 참여는 별개입니다. 계정을 만든 뒤 초대 링크 또는 허용된
참여 절차로 해당 워크스페이스에 들어가야 채팅·문서·이슈를 볼 수 있습니다.
사용자 역할과 문서·채널의 접근 범위에 따라 보이는 내용이 달라집니다.

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
├── contracts/   웹·데스크톱 공유 IPC 타입
└── document-core/ 문서·데이터베이스 도메인 계약과 검증
```

내부 패키지 이름 `@slacord/*`, 앱 ID `com.kscold.slacord`, 일부 `SLACORD_*` 환경 변수는
기존 설치·설정·업데이트 호환성을 위해 유지합니다. 제품 이름이 Slacord로 되돌아간 것이 아닙니다.

## 로컬 실행 프로필

이 절차는 소스 사용 허가를 받은 개발자를 위한 안내입니다. MongoDB와 S3 호환 저장소가
필요하며, 통합 검증에는 운영 데이터가 아닌 격리 저장소를 사용합니다.

- 개발 프로필: `config/profiles/local-container.env`
- 통합 검증: `config/profiles/isolated-test.env` (Mongo 27127, MinIO 19000, 서버 18094, 웹 3202)
- Discord mock 검증: `config/profiles/isolated-discord-mock.env`
- 민감값 override: `config/profiles/*.local.env` (gitignored)

Node 22.12 이상과 `packageManager`에 고정된 pnpm 10.34.9를 사용합니다. Yarn은 사용하지 않습니다.

```bash
corepack enable
pnpm install --frozen-lockfile
```

격리된 MongoDB·MinIO를 준비한 뒤 프로필을 확인하고, 서버와 웹을 각각의 터미널에서 실행합니다.
프로필 명령은 저장소 컨테이너를 자동 생성하거나 운영 DB를 초기화하지 않습니다.

```bash
pnpm profile:print --profile isolated-test
pnpm dev:server:profile --profile isolated-test
pnpm dev:web:profile --profile isolated-test
```

검증·빌드 명령:

```bash
pnpm test:metadata
pnpm test:document-core
pnpm test:server
pnpm test:web
pnpm test:desktop
pnpm build:server
pnpm build:web:profile --profile isolated-test
pnpm build:desktop
pnpm verify:full
```

`pnpm verify:full`은 격리 테스트 저장소가 실행 중이어야 합니다. 기본 개발 프로필인
`local-container`는 기존 컨테이너 연결을 재사용하므로, 운영 데이터가 연결돼 있지 않은지
확인 없이 검증 명령을 실행하지 마세요. 비밀 값은 Git에서 제외된 `*.local.env`에만 둡니다.

상세 동작과 override 예시는 [runtime-profiles.md](./docs/runtime-profiles.md)에서
확인할 수 있습니다.

## 보안 검증

확인한 문제, 수정 내용, 운영 반영 전 남은 항목은
[2026-10-27 보안 점검 기록](./docs/security-review-2026-10-27.md)에 정리했습니다.
가독 첨부는 `gadoc` 비공개 버킷에 저장하고 팀·채널·문서 권한 검증을 거쳐 제공합니다. 블로그 공개 정책은 변경하지 않습니다.

사용자 활동은 요청 ID와 함께 기록하며 비밀번호·토큰·쿠키·문서/메시지 본문을 저장하지 않습니다.
워크스페이스 접근 기록은 해당 팀 owner/admin만 API로 조회할 수 있고, DB 기록에는 30일 TTL을
적용합니다. 기록 범위와 제한은 [사용자 활동 로그 안내](./docs/operations/user-activity.md)를 참고하세요.

## 운영과 저장 공간

현재 운영 웹 배포는 GitHub Actions가 검증한 소스를 기존 Ubuntu 컨테이너에 전송하고
그 안에서 서버·웹을 빌드하는 방식입니다. 매 웹 배포마다 새 Docker 이미지를 만드는 방식은 아닙니다.
데스크톱 설치 파일은 별도 태그 릴리즈 워크플로우에서 빌드합니다.

다만 운영 컨테이너의 `/app/slacord-deploy/releases`에는 빌드·배포 폴더가 누적되며,
현재 배포 도구에는 오래된 릴리즈를 자동 삭제하는 보관 정책이 없습니다.
정리할 때는 다른 배포가 끝났는지 확인하고 현재 실행본·롤백본·진행 중 빌드를 반드시 보존해야 합니다.
DB·첨부 볼륨이나 전체 Docker 데이터를 일괄 정리하는 방식은 사용하지 않습니다.

## AI 연결과 공동 편집

워크스페이스 설정의 **AI 연결**에서 연결 키를 발급합니다. Streamable HTTP MCP 주소는
`https://gadoc.kr/api/mcp`이며 `Authorization: Bearer <발급된 키>` 헤더를 사용합니다.
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

## 관련 문서

| 문서                                                     | 내용                                    |
| -------------------------------------------------------- | --------------------------------------- |
| [실행 프로필](./docs/runtime-profiles.md)                | 로컬 개발·격리 검증 저장소와 환경 변수  |
| [데스크톱 앱](./docs/desktop-app.md)                     | 지원 플랫폼, 패키징, 도메인과 앱 호환성 |
| [릴리즈 체크리스트](./docs/desktop-release-checklist.md) | CI, 서명 설정, 설치 파일 검증           |
| [사용자 활동 로그](./docs/operations/user-activity.md)   | 기록 항목, 접근 권한과 보관 기간        |
| [개발·반영 규칙](./CONTRIBUTING.md)                      | 커밋, PR, 검증과 라이선스 유지          |

## 소유권과 라이선스

Copyright (c) 2026 kscold (김승찬) / Colding. All rights reserved.

GaDoc의 소스 코드와 관련 문서는 **kscold(김승찬) / Colding**의 독점 소유입니다.
MIT 또는 그 밖의 자유 사용을 허용하는 오픈소스 라이선스로 제공하지 않습니다.
사용·복제·수정·병합·공개·배포·재라이선스·판매에는 저작권자의 사전 서면 허가가 필요합니다.

루트와 자체 패키지는 `license: "UNLICENSED"`, `private: true`로 표시합니다.
이는 권리를 포기한다는 뜻이 아니며, 구체적인 조건은 [LICENSE](./LICENSE)가 기준입니다.
의존하는 제3자 라이브러리의 저작권과 라이선스는 각각의 원래 조건을 유지합니다.

사용 허가 문의: **developerkscold@gmail.com**
