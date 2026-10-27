---
type: research
project: Slacord
project_slug: slacord
status: in_progress
date: 2026-10-20
updated: 2026-10-20
tags: [project/slacord, codex, research, notion, rea]
---

# Notion AI·자동화·개발자 플랫폼·Calendar·Mail·앱 생태계 분석

이 문서는 **공식 공개 문서에서 확인한 제품 동작**을 정리한다. 로그인한 Notion에서 조작하거나 API를 호출해 재현한 보고서가 아니다. 모든 인증 기반 시나리오는 **UNEXECUTED**다. Slacord 통합 방식·구현 선택은 다루지 않는다.

분석 기준일은 2026-10-20이다. 기능 제공 여부는 플랜, 조직 정책, 점진 배포, 베타에 따라 다를 수 있다. 아래 `DOC`는 공식 본문 확인, `DOC-CACHED`는 검색에 남은 공식 문서 스냅샷, `CATALOG`는 목록에 존재하지만 상세 계약 검토가 덜 된 표면, `UNKNOWN`은 미확인이라는 뜻이다. `DOC`는 실행 검증 완료를 뜻하지 않는다.

## 1. 조사 범위와 중요한 경계

AI·Custom Agents·External Agents·AI Connectors·Automations·Calendar·Apps·Marketplace의 **공식 전체 카테고리 목록**과 개발자 `llms.txt`를 출발점으로 삼았다. 검색 몇 개로 기능 범위를 결정하지 않았다. 인덱스 자체와 본문 간 차이도 기록한다. [AI 전체 목록](https://www.notion.com/help/category/notion-ai/all), [개발자 전체 목록](https://developers.notion.com/llms.txt)

- 개인 Notion Agent는 **사용자 권한**으로 동작한다. Custom Agent는 **명시적으로 부여된 에이전트 자신의 권한**으로 동작한다. 두 모델을 같은 ACL 규칙으로 설명하면 안 된다. [개인 Agent](https://www.notion.com/help/notion-agent), [Custom Agent 권한](https://www.notion.com/help/custom-agents-sharing-and-permissions)
- AI Connector의 검색, 외부 앱에서 실행하는 액션, 동기화 데이터베이스, 링크 미리보기, MCP, REST API, Workers는 서로 다른 확장 표면이다.
- 사용자가 설정하는 `Send webhook`과 개발자용 변경 이벤트 구독, Workers가 받는 웹훅은 **세 가지 별도 동작 계약**이다. [Webhook actions](https://www.notion.com/help/webhook-actions), [개발자 Webhooks](https://developers.notion.com/reference/webhooks), [Workers Webhooks](https://developers.notion.com/workers/guides/webhooks)
- Calendar의 Notion 데이터베이스 표시는 외부 Google/iCloud 일정으로 복제하는 기능과 같지 않다. [Calendar와 Notion](https://www.notion.com/help/use-notion-calendar-with-notion)
- Mail의 독립 앱은 현행 제품이라고 확정하지 않는다. 공식 문서 검색 스냅샷에 **2026-09-22 종료 공지**가 남아 있지만 현재 본문 URL은 도움말 홈으로 이동한다. 반면 개인 Gmail 연결 문서는 직접 열리며 현행 기능을 설명한다. 상세는 6절.

## 2. AI와 에이전트

### 2.1 기능별 명세

| ID | 기능과 입력 → 결과 | 권한·제약·경계 | 근거/상태 |
|---|---|---|---|
| AI-001 | 개인 Agent: 질문·현재 페이지·선택 블록·@페이지/사람·파일을 문맥으로 받아 검색, 페이지·데이터베이스 생성/편집, 다단계 작업 수행 | 사용자가 볼 수 없거나 편집할 수 없는 내용은 Agent도 접근/수정 불가. 모델·소스 선택은 별도 상태 | [Agent](https://www.notion.com/help/notion-agent), DOC |
| AI-002 | Enterprise Search: 워크스페이스·연결 앱·웹을 대상으로 질의하고 근거 링크가 있는 답변 반환. 페이지/팀 공간/사람을 문맥으로 제한 | Business/Enterprise. 선택한 모델에 따라 웹만 사용할 수 있으므로 모델 변경 후 동일 검색 범위를 가정하면 안 됨 | [Enterprise Search](https://www.notion.com/help/enterprise-search), DOC |
| AI-003 | 선택 텍스트에서 교정·설명·문체/형식 변경 등의 내장 또는 사용자 Skill 실행 | Skill은 Notion 페이지로 작성·공유한다. 라이브러리에서 관리하며 관련 작업에 자동 선택될 수도 있음 | [Skills](https://www.notion.com/help/create-and-manage-skills), DOC |
| AI-004 | 항상 적용되는 개인 Instructions와 특정 작업에 적용되는 Skill 구분 | 개인 Agent, Skill, 반복 실행 Custom Agent를 구분해야 함. Skill을 공유해도 참조 자료에 대한 추가 접근권이 자동 생성된다고 확인되지 않음 | [Skills](https://www.notion.com/help/create-and-manage-skills), DOC |
| AI-005 | AI로 데이터베이스 생성: 요구 설명 → 스키마 미리보기 조정 → 시각화 선택 → 생성 | 전용 Build 경로는 기존 DB 수정·행 생성·자동화·폼·차트·DB 템플릿 생성을 지원하지 않는다고 명시. 개인 Agent 전체 능력과 혼동 금지 | [AI for databases](https://www.notion.com/help/autofill), DOC |
| AI-006 | Basic Autofill: 해당 행/페이지의 본문으로 요약·태그·번역 등의 속성값 생성 | 다른 페이지나 웹을 검색하지 않음. Business/Enterprise 포함. 생성 실패 시 속성 활성화와 입력 자료 충분성 확인 | [Autofill](https://www.notion.com/help/autofill), DOC |
| AI-007 | Custom Agent Autofill: 워크스페이스/웹 문맥을 이용해 여러 속성을 한 번에 채움. 수동·생성·수정·스케줄 실행 | Notion credits 사용. 빈 셀만 채울지 등 조건을 지시에 명시해야 하며 기존값 보호가 기본이라고 가정하지 않음 | [Autofill](https://www.notion.com/help/autofill), DOC |
| AI-008 | AI Meeting Notes: 오디오 전사 → 요약·수동 메모 → 요약의 전사 인용 위치 이동 | Business/Enterprise 및 일부 AI 포함 모바일 구독. 녹음·마이크·시스템 오디오 환경별 차이 존재. 오디오 동의 안내 강제 설정 가능 | [Meeting Notes](https://www.notion.com/help/ai-meeting-notes), DOC |
| AI-009 | 회의 전사 보존: 요약/노트와 전사 삭제 수명주기 분리 | Enterprise 소유자는 전사 자동 삭제 설정 가능. 요약/노트는 유지, legal hold 페이지는 예외. 공유·삭제의 실제 전파 시간은 미측정 | [Meeting Notes](https://www.notion.com/help/ai-meeting-notes), DOC |
| AI-010 | 이미지 블록/Agent 채팅에서 이미지 생성·편집, 후속 지시로 수정 | Business/Enterprise, 관리자 활성화 필요. Custom Agent는 이미지 생성 불가. 모바일은 채팅 경로만, HIPAA 워크스페이스 제한 | [Image AI](https://www.notion.com/help/create-and-edit-images-with-notion-ai), DOC |
| AI-011 | 개인 Agent 승인 모드: 매번 묻기 / 자동 검토 후 필요시 묻기 / 승인 생략 | 읽기와 변경·외부 액션 구분. 새 채팅은 마지막 모드 사용. Custom Agent 설정과는 별도. 자동 위험 판정 내부 로직 UNKNOWN | [Approval modes](https://www.notion.com/help/choose-how-notion-agent-asks-for-your-approval), DOC |
| AI-012 | Agent 브라우저: 웹 페이지 탐색·클릭·폼 제출·다운로드와 작업 관찰. 내장 컴퓨터에서 코드/파일 작업 | 웹 검색과 실제 브라우저 액션 구분. Enterprise/담당자 계약 조직은 관리자 허용 필요. 조직 허용과 개인 활성화가 별도 | [Web browser](https://www.notion.com/help/turn-on-web-browser-for-notion-agent), DOC |
| AI-013 | Agent에 외부 MCP 서버 연결: 연결 서버가 문맥 소스·도구 표면으로 나타남 | 서버별 인증, 도구 사용 권한과 관리자 통제 상세 조합은 추가 재현 필요 | [Connect MCP](https://www.notion.com/help/connect-mcp-servers-to-your-notion-agent), DOC·부분 |
| AI-014 | Custom Agent: 지시·도구·접근 범위·모델·트리거를 가진 공유 가능한 반복 작업 주체 | 주기/타임존, 댓글 추가, DB 페이지 추가·삭제·속성 변경, 회의 노트 완료, Slack 메시지·반응·멘션 등 실행 사건 | [Custom Agents](https://www.notion.com/help/custom-agents), DOC |
| AI-015 | Custom Agent 접근권: 보기/댓글/편집 대상 자료를 명시적으로 부여. 이용자에게 Agent 자체를 공유 | 이용자의 원문 권한을 상속하지 않음. Agent에 더 넓은 자료/행 접근권이 있으면 이용자는 답변에서 직접 접근 못 하는 자료를 볼 수 있음 | [Agent ACL](https://www.notion.com/help/custom-agents-sharing-and-permissions), DOC |
| AI-016 | Agent 복제: 기본 비공개 복사, 지시 새 페이지 생성, 자료/트리거 권한 재검사 | 복제자가 접근 못 하는 자료·의존 트리거 제외. 외부 도구 인증 재연결 필요. 원본 권한을 그대로 복사하지 않음 | [Agent ACL](https://www.notion.com/help/custom-agents-sharing-and-permissions), DOC |
| AI-017 | 외부 Claude Agent(beta): Notion 안의 채팅/작업 보드에서 외부 실행 환경으로 위임 | Business/Enterprise, 점진 배포. Anthropic 계정 불필요, Notion credits. 문서상 웹 탐색·세션 중 다른 Agent 호출 불가 | [Claude agents](https://www.notion.com/help/use-claude-agents-in-notion), DOC |
| AI-018 | 외부 Cursor Agent(beta): 워크스페이스 문맥으로 코드 작업, 결과/문서 업데이트 | Business/Enterprise 및 개인 Cursor 계정/API 키, desktop only. 비용은 Cursor 계정 청구. Agent별 공유권 사용 | [Cursor](https://www.notion.com/help/connect-cursor-to-notion), DOC |
| AI-019 | 개인 ChatGPT 구독을 Notion Agent에 연결하는 표면 | 상세 자격/과금/조직 통제는 해당 계정에서 확인 필요. BYOK, 개인 구독 연결, Notion 자체 credits를 하나의 기능으로 합치지 않음 | [ChatGPT plan](https://www.notion.com/help/use-your-chatgpt-plan-with-notion-agent), DOC·부분 |
| AI-020 | 모델별 사용량과 credits, 신규 Agent 제어·메모리 확장 | 2026-10-19 발표는 일부 기능의 coming soon/private alpha 상태를 포함. 문서에 경로가 존재해도 모든 계정 출시 완료 증거 아님 | [AI announcement](https://www.notion.com/blog/notion-ai-more-for-less), DOC·배포 미확인 |

### 2.2 데이터·상태 관계

다음은 제품 문서에서 드러난 **논리적 관계의 분석**이며 서버 DB 스키마를 추출한 것이 아니다.

- 개인 Agent 대화는 사용자, 현재/선택 문맥, 소스 범위, 모델, 승인 설정, 도구 실행 결과를 가진다.
- Custom Agent는 자료 ACL, 지시 페이지, 연결 인증, 트리거/스케줄, 실행 세션, 사용량/credit 한도와 연결된다.
- Skill은 재사용 지시가 있는 페이지이며 다운로드 가능한 보조 파일을 연결할 수 있다.
- 회의 노트는 페이지의 회의 블록, 전사, 요약, 사용자 메모, 일정 참여자 관계를 가진다. 전사 삭제 후 요약이 남는 것은 둘이 같은 수명주기를 갖지 않는다는 문서 근거다.
- AI 답변의 정확도, 다단계 변경의 원자성, 중단 시 롤백, 동시 실행 충돌, 승인 후 권한 철회 경합은 공개 문서만으로 확정하지 못했다.

### 2.3 AI Connector별 차이

공통 소개 문서는 Business/Enterprise 중심, 개인 Gmail은 전 플랜 예외를 둔다. 그러나 **수집 지연·객체 범위·사용자 매핑은 커넥터별로 다르다.** 아래 연결은 별도 검증 대상이다. [Connector overview](https://www.notion.com/help/notion-ai-connectors), [전체 목록](https://www.notion.com/help/category/notion-ai-connectors/all)

| ID | 연결 | 확인된 동작·차이 | 미확인 항목 |
|---|---|---|---|
| AI-021 | GitHub | 조직 owner+Notion owner 설정, 2명 이상 Business/Enterprise. 코드/파일/README와 PR·이슈 검색. PR·이슈 1년, 코드 시간 제한 없음. wiki/fork 제외. 비공개는 개별 인증. 초기 최대 72시간 | 저장소 삭제/이름 변경·세부 분기 검색 범위 |
| AI-022 | Google Drive | Docs/Slides/Sheets/업로드 파일 검색. 공유 드라이브·그룹/OU 범위. 링크 공유 자료는 한 번 열어야 검색 가능. 초기 보통36시간·새 자료 약1시간. spreadsheet 파일 검색과 내부 데이터 분석은 별개 | 복잡한 시트·수식 의미 보존 |
| AI-023 | Linear | 프로젝트·이슈 상세·댓글, 제목/담당자/생성자 검색. project progress/milestone 제외. Linear admin+Notion owner, Business/Enterprise. 이메일 매핑·권한 약1시간 갱신 | 첨부·삭제·권한 갱신 실험 미실행 |
| AI-024 | Jira beta | Cloud 프로젝트·이슈·댓글·커스텀 필드. Server/Data Center, 보드·대시보드·필터 자체는 제외 | JSM 제한 자료와 이슈 보안 경합 |
| AI-025 | Teams | 선택 팀의 공개/비공개/공유 채널 및 채팅. 게스트 사용 제외, 외부 B2B direct connect 제외. 여러 권한·수정 갱신이 약1시간 | 권한 철회 직후 응답, 과거 채팅 접근 경계 |
| AI-026 | Slack | 검색 외 개인 계정으로 메시지·답글·반응 액션. 사용자의 참여 채널/DM와 본인 메시지 수정 범위. 새 DM 시작 불가 | Enterprise Grid·retention·삭제 직후 상태 |
| AI-027 | Salesforce beta | 계정/리드/기회/연락처 등 객체·레코드. 문서상 필드 수준 권한·retention 미지원이라고 명시 | 서로 다른 권한 설명 간 상세 해석·실제 노출 |
| AI-028 | Box | Enterprise Notion, Box Admin+Notion owner, Extract Agents API가 포함된 Box 플랜. 파일/폴더와 상위 폴더 ACL, shared-link 권한 미지원. 연결 즉시 완료 명시 | 파일 버전·retention 세부 |
| AI-029 | Outlook | 공식 독립 메일 검색 연결 확인 | 공유 사서함·delegate·첨부 지원 세부 |
| AI-030 | Google Calendar | 공식 독립 AI 검색 연결 확인 | 반복 예외·취소 일정·검색 기간 |
| AI-031 | Asana | workspace/user/team/project/task 검색. Notion owner·Business/Enterprise. Asana Enterprise는 admin service-token 경로, 기타는 OAuth. 초기 최대72시간 | subtask/portfolio 및 custom field 세부 |
| AI-032 | 개인 Gmail | 전 플랜·관리자 불필요, Notion 이메일과 정확 일치 필요. 실시간 메일 검색, 전체 inbox, 첨부 읽기 불가. 연결 해제 즉시 검색 불가·관련 데이터24시간 내 삭제 명시 | 대용량 응답 지연·메일 스레드 잘림 |
| AI-033 | 조직 Gmail | 개인 연결과 별도 Business/Enterprise 설정 문서 존재 | 조직-wide 승인·사용자 매핑의 전체 조합 |
| AI-034 | Notion Calendar AI beta | 개인별 이메일 일치, 전체 일정 검색. 연결 즉시·신규 일정0~30분. 조직 Google Calendar 연결시 개인 Notion Calendar 연결이 대체됨. 첨부 미지원 | provider별 삭제·반복 예외·갱신 실제 지연 |
| AI-035 | SharePoint/OneDrive 새 연결 | 개인 Microsoft live connection, Business/Enterprise. 2026-10-31까지 legacy 전환 요구. 파일 실시간 도구 사용, modern group 지원·classic group 미지원. Custom Agent 부분은 coming soon 표기 | migration 중 검색 중복/삭제, 베타 rollout |

각 행의 근거: [GitHub](https://www.notion.com/help/notion-ai-connector-for-github), [Drive](https://www.notion.com/help/notion-ai-connectors-for-google-drive), [Linear](https://www.notion.com/help/notion-ai-connector-for-linear), [Jira](https://www.notion.com/help/jira-ai-connector), [Teams](https://www.notion.com/help/notion-ai-connector-for-microsoft-teams), [Slack](https://www.notion.com/help/notion-ai-connectors-for-slack), [Salesforce](https://www.notion.com/help/salesforce-ai-connector), [Box](https://www.notion.com/help/box-ai-connector), [Outlook](https://www.notion.com/help/microsoft-outlook-ai-connector), [Google Calendar](https://www.notion.com/help/google-calendar-ai-connector), [Asana](https://www.notion.com/help/asana-ai-connector), [개인 Gmail](https://www.notion.com/help/notion-mail-ai-connector), [조직 Gmail](https://www.notion.com/help/notion-ai-connector-for-gmail), [Calendar AI](https://www.notion.com/help/notion-calendar-ai-connector), [SharePoint 전환](https://www.notion.com/help/connect-sharepoint-and-onedrive-to-notion-agents).

## 3. 버튼과 자동화

| ID | 기능·동작 | 권한·오류·경계 | 근거 |
|---|---|---|---|
| AU-001 | 페이지 안 버튼: 클릭으로 여러 액션 실행. 블록 삽입·페이지 생성/수정·열기·알림·메일·변수 등 | 페이지 Full access/Can edit 필요. 대상 DB 편집·페이지 보기 권한도 따로 검사. 템플릿 값이 버튼 설정값을 덮어쓸 수 있음 | [Buttons](https://www.notion.com/help/buttons) |
| AU-002 | DB Button 속성: 행에서 클릭해 해당 페이지/다른 자료에 액션 실행 | 모든 플랜에서 속성 제공하되 일부 액션 유료. 생성/수정은 Full access/Can edit, 클릭은 Can edit content도 가능 | [DB buttons](https://www.notion.com/help/database-buttons) |
| AU-003 | 버튼 수식·멘션·변수: 실행자/페이지/날짜 등으로 후속 액션 인자 구성 | 액션에 사용, 트리거에는 사용하지 않음. 블록 삽입·URL 열기·Slack 알림의 수식 제약. 설정 오류는 저장 차단 | [Buttons](https://www.notion.com/help/buttons) |
| AU-004 | DB automation: 페이지 추가·속성 변경·주기 실행 → 액션 시퀀스 | 유료 플랜, DB full access. 게스트 생성 불가. Free는 Slack 알림 예외. Slack 자동화 편집은 생성자 제한 | [Automations](https://www.notion.com/help/database-automations) |
| AU-005 | 조건/범위: DB 전체 또는 특정 view. 여러 조건, 반복 시간/시작·종료·타임존 | 주기 트리거와 다른 트리거 혼합 불가. 여러 edited 조건은 약3초 창. 수정 후 view 필터에서 빠진 행은 실행 안 될 수 있음 | [Automations](https://www.notion.com/help/database-automations) |
| AU-006 | 재귀 방지: 자동화가 만든 변경은 다른 DB 자동화의 트리거가 되지 않음 | 버튼 실행은 DB 자동화를 촉발 가능. 반복 템플릿이나 자동화가 생성한 페이지는 촉발 불가. 잠금/접근 제한도 원인 | [Automations](https://www.notion.com/help/database-automations) |
| AU-007 | Send webhook: 버튼/DB 버튼/자동화에서 URL에 POST, 사용자 헤더와 속성 선택 | 유료, 자동화당 최대5개, 페이지 본문 전송 불가. 실패시 자동화 일시중지·수동 재개. 통합 API 이벤트 웹훅과 다름 | [Webhook actions](https://www.notion.com/help/webhook-actions) |
| AU-008 | 구성 의존성: 삭제된 DB·속성, 만료된 Gmail/Slack 연결 때문에 기존 버튼 실패 가능 | 설정 유효성 검사와 실행 중 장애를 구분. 다단계 실행의 전체 rollback·재시도 보장 UNKNOWN | [DB buttons](https://www.notion.com/help/database-buttons) |

모든 행은 DOC/UNEXECUTED. 트리거 수집, 조건 평가, 액션별 실행, 외부 연결 인증, 오류로 인한 pause, 수동 resume를 별도 상태로 기록해야 한다. 다중 클릭 중복 억제, 실행 큐 보장, 세부 재시도 횟수는 확인되지 않았다.

## 4. 공개 API·MCP·Workers

### 4.1 데이터 API와 인증

| ID | 표면·동작 | 확인된 계약·경계 | 근거 |
|---|---|---|---|
| API-001 | HTTPS REST/JSON, bearer 인증, `Notion-Version` 요청 헤더 | 공식 예제와 upgrade guide에서 `2026-03-11` 확인. 페이지의 최신버전 보간값은 빈칸으로 추출되어 예제 버전 이상의 최신 단정 금지. `v1` URL과 날짜 버전 구분 | [Intro](https://developers.notion.com/reference/intro), [Versioning](https://developers.notion.com/reference/versioning) |
| API-002 | Internal connection / Public OAuth / PAT | 내부 bot·공개 설치·사용자 스코프 토큰을 구분. connection의 capability와 대상 자료 공유가 함께 필요 | [Capabilities](https://developers.notion.com/reference/capabilities), [PAT](https://developers.notion.com/guides/get-started/personal-access-tokens) |
| API-003 | PAT 생성·만료·폐기·정책 | 게스트/restricted member 생성 불가. Free owner, Plus member, Business 기본 owner, Enterprise owner/선택 그룹. 정책 변경으로 기존 토큰 요청도 unauthorized 가능. 토큰값은 생성시만 표시 | [PAT](https://developers.notion.com/guides/get-started/personal-access-tokens) |
| API-004 | Database → DataSource → Page → Block | Database는 data sources/views를 포함, DataSource는 schema와 행 페이지의 parent. title 속성은 정확1개. linked view 공유만으로 원본 source 접근권 없음 | [Database model](https://developers.notion.com/guides/data-apis/working-with-databases) |
| API-005 | 블록/페이지/속성 읽기·쓰기·이동·삭제·복원, 사용자·댓글·파일 | endpoint별 capability·읽기 전용 필드·페이지네이션은 별도 계약. endpoint 존재와 UI 전체 지원 동등성은 다름 | [개발자 인덱스](https://developers.notion.com/llms.txt), CATALOG·부분 |
| API-006 | DataSource query: 타입별 필터·복합조건·정렬·페이지네이션 | wiki query는 child data source도 반환 가능, `result_type: page`로 한정. 스키마와 값은 다른 객체 | [Database model](https://developers.notion.com/guides/data-apis/working-with-databases) |
| API-007 | Views CRUD 및 view query | API 2025-09-03 이상. 일반 view는 단일 source 참조이며 다른 DB의 source도 연결 가능. dashboard 자체 data_source_id는 null이고 widget별로 source를 참조. query 생성→캐시 결과 페이지 조회→삭제 경로 | [Views API](https://developers.notion.com/guides/data-apis/working-with-views) |
| API-008 | Markdown 읽기·삽입·치환, enhanced/notion-flavored 표현, async 작업 | `truncated`, `unknown_block_ids`, warnings 확인 필요. 200 또는 작업 생성만으로 전체 블록 보존을 가정하면 안 됨 | [Markdown](https://developers.notion.com/guides/data-apis/working-with-markdown-content) |
| API-009 | File upload 객체, 작은/큰 multipart 업로드, 외부 파일 가져오기 | 업로드·전송·완료·첨부·다운로드 URL은 서로 다른 단계. 만료 링크와 upload 실패/만료 이벤트를 구분 | [Files](https://developers.notion.com/guides/data-apis/working-with-files-and-media), [인덱스](https://developers.notion.com/llms.txt) |
| API-010 | Search endpoint | 이름 중심 탐색. 모든 접근 가능 자료 완전 열거/즉시 일관성 보장 아님. DB 내 검색은 source query 사용. trash도 eventual consistency | [Search limits](https://developers.notion.com/reference/search-optimizations-and-limitations) |
| API-011 | rate limit | Business/Enterprise connection당600/min, 기타180/min. 별도 workspace 공용 제한과 일부 endpoint 제한 존재. 429, `Retry-After`, reason으로 구분 | [Request limits](https://developers.notion.com/reference/request-limits) |
| API-012 | API 계약 진화 | 추가 필드/endpoint는 기존 버전에도 도입 가능. cursor opaque, URL을 ID로 파싱하지 않음. beta는 `Notion-Beta` 별도 flag/버전 | [Versioning](https://developers.notion.com/reference/versioning) |
| API-013 | Integration Webhooks: page/database/source/comment/file/view 변화 신호 | 변경 전체 본문 대신 대상ID로 재조회. 종류별 aggregation, 순서 보장 제한. 수신 미확인시 최대8회 지수 backoff·마지막 약24시간 | [Delivery](https://developers.notion.com/reference/webhooks-events-delivery) |
| API-014 | Webhook 구독 검증·요청 서명 | verification token으로 HMAC SHA256 서명 확인. `X-Notion-Signature`, raw body 그대로 검증해야 함; JSON 재직렬화 시 서명 불일치 | [Webhooks](https://developers.notion.com/reference/webhooks) |
| API-015 | Notion MCP: 외부 AI 클라이언트에서 Notion 도구 사용 | MCP tool catalog는 REST와 별도. OAuth/tool 응답은 `Notion-Version` 적용 대상 아님. 인증 범위/도구별 차이는 별도 검증 필요 | [MCP tools](https://developers.notion.com/guides/mcp/mcp-supported-tools), [Versioning](https://developers.notion.com/reference/versioning) |
| API-016 | Agent APIs(public beta): Agent 조회/상태/credit 한도, 세션 생성·stream·action·이벤트 조회·취소 | PAT 세션은 사용자 소유·Notion에서 이어가기 가능. connection 세션은 연결 소유·API에서 이어감. 타 세션 읽기와 쓰기 권한은 다름 | [Agent APIs](https://developers.notion.com/guides/notion-agent-apis/overview) |
| API-017 | Agent Skills API: plugin 목록, plugin/skill 파일 디렉터리 다운로드 | Skill의 본문은 `SKILL.md` 역할의 Notion 페이지, Files 속성에 보조 파일. Read content와 DB 공유 필요. 미공유 skill은 생략 | [Skills API](https://developers.notion.com/guides/agent-skills/overview) |
| API-018 | Link previews: 외부 URL 자료를 Notion 내부 카드로 표현하는 연결 표면 | 단순 embed, 동기화 source, AI 검색과 구분. partner 설정과 인증 UX 세부는 미완 | [Link previews](https://developers.notion.com/guides/link-previews/introduction), DOC·부분 |
| API-019 | CLI: 인증·API 호출·data source·file upload·Worker 배포/관리 | 공식 CLI 문서 존재. 설치/실행 미수행, 실제 호스트 지원·명령별 오류 실험 없음 | [CLI](https://developers.notion.com/cli/get-started/overview), DOC·부분 |

공식 introduction의 페이지네이션 설명에는 기본10개라는 문장과 파라미터 표의 default100이 함께 존재한다. **default를 확정하지 않고 endpoint별 문서/실응답 확인 대상으로 남긴다.** 최대100, `has_more`/`next_cursor`를 통한 반복은 문서 확인 사항이다. [Intro](https://developers.notion.com/reference/intro)

### 4.2 Workers 실행·동기화

| ID | 기능·동작 | 경계·실패 의미 | 근거 |
|---|---|---|---|
| API-020 | Notion-hosted Node/TypeScript Worker: sync/tool/webhook 등록 후 배포 | sandbox 실행, 외부HTTP·비밀값·OAuth 사용 가능. 호출/자원/비용의 전체 한도 미완 | [Workers](https://developers.notion.com/workers/get-started/overview) |
| API-021 | Sync managed/attached DB, 외부 primary key에 따른 upsert | 동기화 스키마 열은 수동 편집 금지, 미포함 열은 편집 가능. 행 생성/삭제는 sync가 소유. detach는 데이터 유지하고 잠금 해제 | [Syncs](https://developers.notion.com/workers/guides/syncs) |
| API-022 | Replace / Incremental sync | replace는 한 사이클 끝에 미출현 행 삭제, incremental은 명시 삭제 필요. `hasMore`/`nextState`로 배치 지속. 기본30분, 주기 최소5분·최대7일/수동 | [Syncs](https://developers.notion.com/workers/guides/syncs) |
| API-023 | Worker tool: Custom Agent가 호출하는 외부 기능 등록 | 입력 스키마·출력·실행 주체·오류 전달을 독립 검증해야 함. 단순 Worker 배포가 모든 Agent에 자동 권한을 주는지 확정하지 않음 | [Tools](https://developers.notion.com/workers/guides/tools) |
| API-024 | Worker 수신 webhook: 외부 event → enqueue → 비동기 실행 | 기본202는 큐 적재 성공이지 작업 성공 아님. 일반 오류 최대3회 재시도, verification 오류는 재시도 제외. 수신 rate limit429 가능 | [Worker Webhooks](https://developers.notion.com/workers/guides/webhooks) |
| API-025 | 동기식 webhook verify | 약5초 예산. timeout503+Retry-After, 잘못된 응답/반복 검증 실패에 차단 가능. verify 설정 off는 배포 후에도 유지 | [Worker Webhooks](https://developers.notion.com/workers/guides/webhooks) |
| API-026 | Worker OAuth·secrets·공유 | accessToken 자동 refresh. 배포 Worker의 Can connect와 Full access 구분. 소스코드 공유는 별도 Git 관리이며 Notion에서 다운로드 불가 | [OAuth](https://developers.notion.com/workers/guides/oauth), [Sharing](https://developers.notion.com/workers/guides/sharing-workers) |

위 표는 DOC/UNEXECUTED. 호출자·Worker 소유자·외부OAuth 사용자·Custom Agent의 ACL 관계, source schema 변경 중 sync, 부분 성공 후 재시도, 동시 replace/delta 실행은 특히 추가 분석이 필요하다.

### 4.3 추가 API 계열과 실패 계약

전체 개발자 인덱스의 계열을 다시 대조해 다음을 보강했다. 기존 버전 endpoint와 언어별 예제는 새로운 제품 기능으로 중복 집계하지 않았다.

| ID | 기능 계열 | 문서에서 확인한 계약 | 근거/미확인 |
|---|---|---|---|
| API-027 | Comments | 페이지 댓글 생성·댓글 수정/삭제·기존 inline discussion 답글·미해결 댓글 조회. read/insert comment capability 구분. guide는 새 discussion 시작·해결된 댓글 조회 불가 명시 | [Comments](https://developers.notion.com/guides/data-apis/working-with-comments). 개별 endpoint와 guide 차이는 실험 전 보류 |
| API-028 | Meeting note 생성/검색 | 업로드 오디오/비디오 file_upload를 source로, 부모 page와 title·language·요약 옵션으로 생성. 검색은 제목/날짜/사람 조건과 and/or, 정렬·limit | [Create](https://developers.notion.com/reference/create-meeting-note), [Query](https://developers.notion.com/reference/query-meeting-notes). 비동기 완료·용량·언어별 정확도 미실행 |
| API-029 | 템플릿 적용 | default 또는 template_id로 페이지 생성, 초기 응답 페이지는 일시적으로 비어 있을 수 있음. content webhook 뒤 block children으로 적용 결과 확인 | [Templates](https://developers.notion.com/guides/data-apis/creating-pages-from-templates) |
| API-030 | Free workspace block 제한 | 복수 member Free의 lifetime1000블록, 삭제해도 용량 복원 안 됨. 일부 internal/제한OAuth 적용, PAT/모든 workspace 설치가능OAuth 제외. 한도 도달 요청 성공 후3일 grace | [Block limits](https://developers.notion.com/reference/workspace-block-limits) |
| API-031 | 백그라운드 template 부분실패 | 요청 성공 뒤에도 job이 한도를 재검사. 제한에 걸리면 빈/부분 페이지가 남고 실패 webhook/public job status가 없음. replace는 성공 후 원본 제거 | [Block limits](https://developers.notion.com/reference/workspace-block-limits). 자동 재적용은 중복 가능 |
| API-032 | 대량 source/view query | query당10000결과. `has_more=false`만으로 완전 수집 판정 불가, `request_status=incomplete` 확인. created_time 창 분할과 ID중복 제거. view query 캐시는 같은 한도이며 직접 window 불가 | [Large sources](https://developers.notion.com/guides/data-apis/query-large-data-sources) |
| API-033 | 단일 속성의 전체값 | property-item pagination으로 관계/사람 등 전체값과 rollup 최종 결과 조회. 관련 DB도 공유 필요. formula unsupported·rollup incomplete를 정상값으로 취급하면 안 됨 | [Property items](https://developers.notion.com/guides/data-apis/read-page-property-values) |
| API-034 | 인증 토큰 수명 | 공개 연결 OAuth 승인과 token 교환·refresh 경로, 내부 연결과 사용자 PAT 분리. token 생성/introspection/revoke/refresh가 독립 endpoint 계열 | [Authorization](https://developers.notion.com/guides/get-started/authorization), [인덱스](https://developers.notion.com/llms.txt). 전 endpoint 실제 응답 미실행 |
| API-035 | 오류 계약 | HTTP 상태와 기계판독 error code로 validation/auth/access/not-found/conflict/rate/service 오류 구분. 사람이 읽는 message를 안정 식별자로 쓰지 않음 | [Status codes](https://developers.notion.com/reference/status-codes), [Versioning](https://developers.notion.com/reference/versioning) |
| API-036 | Workers 공유 예산 | tool+queued webhook600/h·burst60/min, sync 별도600/h·60/min, build100/day·10/5min. workspace 공용 기본값이며 계약별 예외 가능 | [Worker limits](https://developers.notion.com/workers/reference/limits) |
| API-037 | Workers ingress·DB 쓰기 한도 | 입장600/h·60/min와 per-worker600/min·workspace1200/min ingress 제한 분리. sync row write100만/h·burst25000/min. enqueue와 실행 rate limit은 별도 | [Worker limits](https://developers.notion.com/workers/reference/limits) |
| API-038 | Worker Notion client의 실행 주체 | Custom Agent 호출 tool의 context.notion은 해당 Agent 권한. sync/webhook/local exec는 직접 PAT 또는 internal token 제공 필요 | [API client](https://developers.notion.com/workers/guides/api-client). 가이드 일부 예제는 legacy DB query 형태이므로 버전별 대조 필요 |
| API-039 | Worker secret·SDK·schema builders | secret은 저장시 암호화·실행시 env 주입. SDK는 capability 등록, schema는 DB 구조, builder는 값 생성의 별도 표면 | [Secrets](https://developers.notion.com/workers/guides/secrets), [SDK](https://developers.notion.com/workers/reference/sdk), [Schema](https://developers.notion.com/workers/reference/schema). 모든 타입 enum 동등성 미완 |
| API-040 | MCP 검색의 동적 기능 | `notion-search`는 계정 AI 접근에 따라 AI/keyword 검색. exact filter/빈query/특정sort는 workspace search. 플랜 미지원 filter는 오류 대신 제거+notices를 낼 수 있어 결과 범위 확인 필요 | [MCP tools](https://developers.notion.com/guides/mcp/mcp-supported-tools) |
| API-041 | MCP 데이터·파일·Agent 도구군 | page/source/view 작성·수정, 파일 upload/download, comments, 사용자, async task, Agent 발견·세션 시작/메시지/대기/중단·이벤트 도구. 관리자가 선택한 도구만 노출될 수 있음 | [MCP tools](https://developers.notion.com/guides/mcp/mcp-supported-tools). 호출별 schema 미실행 |
| API-042 | MCP 연결 인증 | OAuth metadata discovery→PKCE→사용자 승인→token/refresh. REST connection OAuth와 MCP 프로토콜 연결을 구분 | [MCP client](https://developers.notion.com/guides/mcp/build-mcp-client). enterprise-managed ID-JAG 문서는 목록 확인했으나 본문 fetch 실패 |
| API-043 | MCP Skill 사용 | skill 페이지의 생성/발견/사용 가이드 존재. 10월19일 발표의 coming soon과 함께 availability 미확인 상태 유지 | [MCP skills](https://developers.notion.com/guides/mcp/notion-skills), [배포 충돌 기록](05-evidence-conflicts-and-availability.md) |

추가 시험은 모두 **UNEXECUTED**:

- API-027: 미해결/해결 discussion을 만들고 connection으로 조회·답글·수정·삭제를 비교한다. guide상의 제한과 실제 endpoint 결과를 분리한다.
- API-028/029/031: 합성 음성과 템플릿으로 생성한 직후/후속 조회를 기록한다. 초기200·202와 실제 콘텐츠 완료를 구분하며, 빈 페이지를 성공으로 처리하지 않는다.
- API-030/036/037: 이미 한도 근처인 테스트 환경 또는 문서/샌드박스 응답으로 제한 상태를 확인한다. 실사용 workspace에 의도적으로 대량자료를 만들어 한도를 소모하지 않는다.
- API-032/033: 충분한 합성 행과 다중 관계값으로 한도/속성pagination을 검증한다. `has_more=false`, incomplete, unsupported를 각기 기록하고 UI 수와 대조한다.
- API-038: 같은 Worker tool을 다른 접근권의 Agent에서 호출하고 sync의 명시 토큰과 비교한다. 작업 성공과 권한 범위를 각각 확인한다.
- API-040/041/042: 제한 플랜·관리자 선택도구 연결에서 tools/list와 notices를 확인한다. 필터가 조용히 제거된 결과를 정확한 필터 결과로 판정하지 않는다.

### 4.4 개발자 인덱스 계열 대조

| 인덱스 계열 | 이 문서의 분석 위치 | 남은 검증 |
|---|---|---|
| 시작/인증/internal/public/PAT/보안/설치/marketplace | API-001~003,034, EXT-007/008 | 공개 connection 등록·검수·OAuth 실패 조합 |
| Agent APIs/Skills API/MCP | API-015~017,040~043 | 세션 state machine·stream 재연결·scope 실제 조합 |
| block/rich text/page/property/parent/icon | API-004~006,008,033 및 편집기/DB 분석 문서 | 모든 필드 enum·중첩·잘림 |
| database/source/schema/filter/sort/template | API-004/006/007/029/032 | 타입별 filter/sort 비교, legacy migration |
| comments/attachments/display name | API-027,009 | unresolved/resolved·작성자 변형·첨부 권한 |
| files/uploads | API-009 | multipart 경계·만료·외부URL 실패 |
| search/users/custom emoji | API-005/010/040/041 | 사용자 정보 capability·custom emoji 표시/삭제 |
| webhook 모든 entity family | API-013/014 및009 | 타입별 payload·aggregation·순서·재전달 |
| async/status/version/limits | API-001/008/011/012/030/031/035 | endpoint별 status polling·한도 실제조건 |
| CLI/Workers/SDK/schema/limits | API-019~026,036~039 | 명령 옵션·배포·rollback·자원제한 |
| Admin/legal hold/group/member/Agent/PAT/MCP/export/analytics | 관리·보안 분석 문서와 교차 검토 | 이 문서에서는 중복 상세명세를 작성하지 않음 |
| Compliance/SIEM/audit | 관리·보안 분석 문서와 교차 검토 | event별 field·retention·전송 실패 |
| 예제/가이드/changelog/prompts/OpenAPI | 발견 및 버전 근거 | 예제나 spec 존재를 실행 지원 증거로 대체하지 않음 |

## 5. Calendar

| ID | 기능·관계 | 제약·경계 | 근거 |
|---|---|---|---|
| CAL-001 | 여러 계정/캘린더를 하나의 일정 격자에서 조회·정렬·숨김·기본 지정 | 문서 서두는 Apple/Google, 본문에는 Outlook/M365 연결도 명시. Outlook 반복·delegation·Teams 회의도 설명하므로 서두만으로 미지원 판정 금지 | [Calendars/events](https://www.notion.com/help/manage-your-calendars-and-events) |
| CAL-002 | 이벤트 생성·수정·이동·삭제·다중 선택·RSVP·참석자/방·회의 링크·공개/비공개·Busy/Free | 동일 event ID 여러 캘린더에서 자동 병합. 특정 캘린더 자격으로 편집/RSVP하려면 다른 것을 숨기는 방법 안내. 모바일 편집 제한 명시 | [Calendars/events](https://www.notion.com/help/manage-your-calendars-and-events) |
| CAL-003 | 일반/집중/부재/생일, 반복/여러날 일정 | Focus/OOO는 일부 Google Workspace 계정 제약. 이동 시간 미지원. 반복 인스턴스/전체 미래 수정은 provider별 확인 필요 | [Calendars/events](https://www.notion.com/help/manage-your-calendars-and-events) |
| CAL-004 | 일정 예약 링크: 일회·반복, 가능 시간, 만료, 예약 기간, 장소/회의 링크 | Avoid conflicts로 새 충돌 반영. 단일사용 링크는 재예약 불가. 재예약/취소 링크 사용시 새 링크 발행 | [Scheduling](https://www.notion.com/help/availability-blocking-and-time-zones) |
| CAL-005 | Event blocking: 개인 일정 시간을 업무 캘린더에 busy로 표시, 개별/자동 전체 | 상세 포함 여부 선택. 원본 접근 상실 뒤 자동 blocking 해제는 지원 문의 경로 안내 | [Blocking](https://www.notion.com/help/blocking) |
| CAL-006 | 여러 타임존 표시와 전환 | DST, date-only, 자정 경계, 여행 중 timezone 변경의 실측 없음 | [Time zones](https://www.notion.com/help/time-zones), DOC·부분 |
| CAL-007 | 날짜 속성이 있는 DB를 Calendar에서 조회/수정. 여러 날짜 중 기준 속성, 추가 view 선택 | 연결 Can view, 쓰기 Can edit content. 최대20DB, 추가는 desktop/web. 페이지별 권한으로 일부 행 누락 가능 | [Calendar with Notion](https://www.notion.com/help/use-notion-calendar-with-notion) |
| CAL-008 | 이벤트에 페이지/회의 노트 연결, 내부 참가자 노트 자동 공유 설정 | 노트 기본은 개인 비공개. DB 일정은 Google/iCloud에 자동 나타나지 않음. Calendar→DB 변환 및 외부 캘린더의 Notion 페이지 내 일반 가져오기 제한 | [Calendar with Notion](https://www.notion.com/help/use-notion-calendar-with-notion) |
| CAL-009 | local deep-link API | desktop macOS/Windows의 `cron://` 경로로 특정 이벤트 열기. accountEmail·iCalUID·시작/종료 인자. 범용 원격 일정 CRUD API라는 증거 없음 | [Connections/API](https://www.notion.com/help/notion-calendar-connections) |
| CAL-010 | 계정별 Mail & Calendar 연결 관리 | Notion/Calendar 관련 개인 연결을 공통 관리. provider 권한 만료/폐기시 재연결. 조직 AI 검색용 관리 연결과 별개 | [Connection settings](https://www.notion.com/help/manage-email-and-calendar-settings) |

CAL-001~010은 모두 DOC/UNEXECUTED. 최종 사용자에게는 한 달력처럼 보여도 외부 provider event, Notion page의 날짜 속성, busy 복제 event, 예약 링크는 별도 개체다. 이 관계는 문서 기반 분석이며 내부 저장 구조 추정과 구분한다.

## 6. Mail: 역사적 기능과 현행 메일 연결 구분

| ID | 표면 | 확인 수준과 동작 |
|---|---|---|
| MAIL-001 | 독립 Notion Mail 생명주기 | DOC-CACHED. 공식 검색 결과의 여러 도움말에 2026-09-22 종료 안내가 보인다. 현재 en-US/en-gb 시작/작성 URL은 help 홈으로 redirect. 종료 공지는 확인했지만 실제 앱 종료/데이터 이전 결과는 미실행 |
| MAIL-002 | 역사적 Gmail 기반 메일 클라이언트 | DOC-CACHED. 계정·별칭·여러 계정, Gmail 스레드 중심 동기화. 초안·예약·snooze 등이 동일하게 sync된다고 보장하지 않던 문서가 남음 |
| MAIL-003 | 역사적 inbox views | DOC-CACHED. 필터·그룹·속성·라벨로 여러 메일 뷰 구성. nested label/subfolder, 무라벨 필터/그룹 제약 명시 |
| MAIL-004 | 역사적 작성/AI/일정 | DOC-CACHED. 블록식 작성·재사용 snippets·AI auto-label·초안·메일 안에서 일정 예약. 종료 이후 동등 경로는 확인 안 됨 |
| MAIL-005 | 현행 개인 Gmail AI Connector | DOC. 독립 Mail 앱 없이 개인 inbox 검색 연결을 설명. 해당 문서의 URL이 과거 `notion-mail-ai-connector`라 URL 이름으로 제품 수명을 판단하면 안 됨 |
| MAIL-006 | 현행 Mail & Calendar 계정·Agent 연계 | DOC. 메일 검색·초안·일정·노트·스레드의 DB 동기화 사용 사례를 설명. 독립 Mail inbox의 모든 기능이 대체됐다는 의미 아님 |

근거: [시작 문서의 공식 검색 스냅샷 원주소](https://www.notion.com/en-gb/help/get-started-with-notion-mail?nxtPslug=get-started-with-notion-mail), [뷰 문서 원주소](https://www.notion.com/en-gb/help/views-groups-filters-and-properties), [작성 문서 원주소](https://www.notion.com/help/compose-an-email), [역사적 공식 가이드](https://www.notion.com/en-gb/help/guides/getting-started-with-notion-mail?nxtPslug=getting-started-with-notion-mail), [현행 개인 Gmail](https://www.notion.com/help/notion-mail-ai-connector), [현행 계정 연결](https://www.notion.com/help/manage-email-and-calendar-settings).

종료 공지의 직접 현재 본문·보존 정책·전환 세부가 확보되기 전까지 MAIL-001~004를 현행 기능 동등성 목표라고 자동 분류하지 않는다. 역사적 기능 분석 요청이라면 별도 버전 기준을 정해야 한다.

## 7. 앱·마켓플레이스 확장 표면

| ID | 기능 | 동작·제약 | 근거 |
|---|---|---|---|
| EXT-001 | 데스크톱 앱 | Mac/Windows 앱, 브라우저와 별도 창·탭·OS 연결 UX. 실제 버전별 조작은 미실행 | [Desktop](https://www.notion.com/help/notion-for-desktop) |
| EXT-002 | 모바일 앱 | iOS/Android의 편집·탐색·공유 진입점. desktop과 기능 배치가 다름 | [Mobile](https://www.notion.com/help/notion-for-mobile) |
| EXT-003 | 홈 화면 위젯 | 페이지/DB, 즐겨찾기, 최근, AI 채팅·카메라·음성 진입. custom emoji 표시 제한 | [Widgets](https://www.notion.com/help/mobile-widgets) |
| EXT-004 | Web Clipper | Chrome/Safari 확장 또는 모바일 share sheet→목적 workspace/page/DB 선택→웹 내용 저장 | [Clipper](https://www.notion.com/help/web-clipper) |
| EXT-005 | New Tab 확장 | 독립 브라우저 새 탭 진입 표면. 지원 브라우저/기업 정책·실제 제공 UI 추가 분석 | [New Tab](https://www.notion.com/help/notion-new-tab-extension), DOC·부분 |
| EXT-006 | 독립 Notion Agents 앱 | iPhone iOS26 이상, AI chat/capture/quick actions 중심. iPad/Android 미지원. 일반 Notion 모바일 AI와 동일 기능 집합이라고 가정 금지 | [Agents app](https://www.notion.com/help/notion-ai-app-for-ios) |
| EXT-007 | Marketplace 템플릿 탐색·구입/복제 | 개인/팀 반복 구조 배포. 템플릿 사용과 원본 페이지 실시간 동기화는 별개 | [Finding templates](https://www.notion.com/help/finding-templates-on-marketplace) |
| EXT-008 | 판매자 템플릿 배포 | 판매·무료 템플릿 access locking, 결제/환불·분석·쿠폰·웹훅 표면. 제한 배포 옵션 존재 | [Selling](https://www.notion.com/help/selling-on-marketplace) |
| EXT-009 | 템플릿 현지화·서비스/파트너 생태계 | 공식 category에 localization, 서비스 제공/탐색, solution partner 별도 문서 존재. 행정·상거래 세부는 미완 | [Marketplace 전체](https://www.notion.com/help/category/template-gallery/all), CATALOG |

## 8. 실행 검증 시나리오 — 전부 UNEXECUTED

아래는 **실행 절차와 문서상 기대 결과**다. 체크리스트 작성 자체는 테스트 통과가 아니다. 외부 발신·실제 고객 자료 대신 테스트 워크스페이스·합성 자료·수신자 소유 테스트 계정을 사용한다.

| 시험 ID | 대상 ID | 절차 | 기대 결과 / 기록할 미확인 값 |
|---|---|---|---|
| T-AI-01 | AI-001/002 | A만 읽는 합성 페이지와 B 공용 페이지 생성, B의 개인 Agent로 둘을 질문 | B는 비공개 자료를 찾거나 인용하지 않음. 답변·인용·직접 URL 접근 각각 기록 |
| T-AI-02 | AI-002 | 동일 질문에서 source=Notion/Slack/web 및 모델 변경 | 선택한 소스 제한 준수. 모델 변경에 따라 workspace context 미지원 여부 표시 확인 |
| T-AI-03 | AI-003/004 | Skill 페이지 작성→선택 텍스트 실행→지시 수정→다른 사용자 실행 | 공유/수정 반영, 문맥 범위 기록. 원본 접근 없는 이용자 결과 확인 |
| T-AI-04 | AI-005/006/007 | DB Build·Basic·Custom Autofill에 같은 외부 문맥 필요 과제 | Build 제한, Basic 행 내부 한정, Custom 검색 여부/credit/기존값 덮어쓰기 관찰 |
| T-AI-05 | AI-008/009 | 합성 음성으로 회의 노트, 중단·재개·요약 인용·전사 삭제 | 요약 인용 위치 확인, 전사 제거 뒤 요약 유지. 참가자 자동 공유 별도 검사 |
| T-AI-06 | AI-010 | desktop 이미지 블록/모바일 채팅/Custom Agent에서 생성 요청 | 경로별 지원·불가·관리자 비활성 동작 기록. 생성 품질을 기능 보장으로 해석하지 않음 |
| T-AI-07 | AI-011/012 | Always ask에서 테스트 페이지 변경·웹 폼 제출 지시, 승인 거절 | 승인 전 변경/제출 안 됨. 웹 조직 차단 우선 적용 확인 |
| T-AI-08 | AI-014/015 | 제한 자료를 읽는 Custom Agent를 자료 미공유 B에게 이용권 제공 | Agent 자체 ACL에 따른 답변 가능성을 확인. 개인 Agent와 결과 차이 기록 |
| T-AI-09 | AI-016 | 접근 없는 자료/Slack 트리거가 있는 Agent를 B가 복제 | 비공개 복제, 미허용 자료/트리거 제외, 외부 재인증 요구 |
| T-AI-10 | AI-014 | schedule timezone 변경, 완료된 회의 노트·Slack 반응 트리거 | next run 및 event별 실행 기록. 중복·동시·실패 retry는 관찰 후 명세화 |
| T-CON-01 | AI-021~035 | 각 커넥터마다 공개·비공개·삭제·최근 수정 합성 자료로 질의 | 객체 지원, citation 원본, 초기/갱신 지연을 별도 측정 |
| T-CON-02 | AI-021/025/035 | 권한 철회 뒤 기존 대화 재질문·새 대화·직접 인용 열기 | 사용자/Agent/커넥터 ACL 차이와 지연 확인. 즉시 철회를 모든 커넥터에 가정하지 않음 |
| T-CON-03 | AI-032 | 다른 이메일 Gmail 연결, 첨부 내용 질의, 연결 해제 | 이메일 불일치 제한, 첨부 미지원, 연결 해제 후 검색 차단 |
| T-AU-01 | AU-001/002 | viewer/content editor/editor별 page 버튼과 DB 버튼 클릭/수정 | 두 버튼 종류의 권한 차이 일치, 대상DB 별도 권한 검사 |
| T-AU-02 | AU-003/008 | 변수+여러 액션 설정, 속성 삭제 후 클릭, 템플릿 제목 충돌 | 설정 오류/실행 오류 구분. 템플릿 우선 결과, 부분 반영 기록 |
| T-AU-03 | AU-004/005 | view 범위 자동화에서 필터를 벗어나는 수정, edited 조건 간격 변경 | 범위 이탈시 미실행, 약3초 조건 창 관찰 |
| T-AU-04 | AU-006 | 수동·버튼·다른 자동화·반복템플릿 각각으로 동일 행 생성 | 버튼/수동은 촉발, 자동화/반복템플릿은 연쇄 실행 안 됨 |
| T-AU-05 | AU-007 | 자체 테스트 수신기로 webhook200→500→재개 | POST/선택속성 payload, 본문 제외, 실패 pause와 수동 resume |
| T-API-01 | API-002/003 | connection/PAT별 공유대상·capability·정책 철회 조합 | 미허용 요청 차단, 정책 변경 토큰 unauthorized, 비밀값 저장 금지 |
| T-API-02 | API-004/006/007 | 다중source DB에서 schema/행/view 조회 후 linked view만 공유 | source별 일관성, 원본 공유 없이 접근 불가, view 쿼리 결과 검증 |
| T-API-03 | API-008 | 미지원/큰 블록 포함 페이지 markdown 읽기→별도 복제에 쓰기 | unknown/truncated/warnings·async 상태 확인, 블록 의미 손실 비교 |
| T-API-04 | API-009 | 작은파일·multipart·외부파일을 생성/완료/첨부, 만료 URL 재사용 | 단계별 오류/만료·재조회 경로 기록 |
| T-API-05 | API-010/011 | 공유 직후 검색·refresh, 테스트 한도 내 burst | 즉시 완전 열거 보장 안 됨. 실제429가 나오면 reason/Retry-After 기록 |
| T-API-06 | API-013/014 | 페이지변경→서명확인→수신500→재전송 관찰 | raw body 서명 일치, event ID/순서/aggregation/재시도 시각 기록 |
| T-API-07 | API-016/017 | PAT/connection 세션 생성, 다른 토큰 읽기/이어쓰기, 미공유 skill 조회 | 세션 소유권 제한, 미공유 skill 생략, 파일 다운로드 구성 확인 |
| T-WKR-01 | API-021/022 | 같은 primary key 반복 upsert, replace 누락, incremental 누락/삭제 | 중복행 방지, replace 누락 삭제, incremental 유지, synced 열 편집 제한 |
| T-WKR-02 | API-024/025 | webhook 서명 오류·일반오류·verify timeout·반복실패 | verification 오류 retry 제외, 일반 retry,503/차단/설정 복구 구분 |
| T-WKR-03 | API-026 | Can connect/Full access 사용자로 Worker 접근·배포·env 관리 | connect와 deploy/env 권한 분리, 코드 배포 공유가 소스 공유를 뜻하지 않음 |
| T-CAL-01 | CAL-001/002/003 | Google/Apple/Outlook 합성 일정·반복 예외·RSVP·delegate | provider별 결과, 동일ID 병합, mobile 편집 차이 기록 |
| T-CAL-02 | CAL-004/005 | 예약 가능시간→충돌 추가→예약→취소/재예약, busy 복제 | 충돌 반영, 링크 교체, 원본 상세 숨김 확인 |
| T-CAL-03 | CAL-006/007 | 날짜-only·UTC·DST 날짜의 여러 날짜 속성 DB 연결 | 선택 속성 기준 표시, 날짜 이동 후 DB 값 반영, 권한 없는 행 숨김 |
| T-CAL-04 | CAL-008/009 | 이벤트 노트 생성/공유 설정, local link 열기 | 기본 private/내부참가자 공유 차이, 정확 일정 열림. Google에 DB행 생성 안 됨 |
| T-MAIL-01 | MAIL-001~006 | 현재 서비스 진입·종료 안내 확인, personal Gmail 연결과 비교 | 현재 Mail 상태·이전 안내를 증거화. 과거 docs만으로 현재 기능 존재 판정 금지 |
| T-EXT-01 | EXT-001~006 | desktop/mobile/clipper/widget/Agent 앱에서 같은 합성 자료 | 저장 목적지·권한·오프라인/연결 복구·기능 패리티 차이 기록 |
| T-EXT-02 | EXT-007/008 | 테스트 무료 template 복제, restricted/open별 재배포 | 원본/복제 데이터 분리, access locking 범위 관찰. 유료구매는 미수행 |

## 9. 미완료·불확실성·후속 분석 항목

1. **전 기능 런타임 분석 미완료:** 로그인 화면이 아니라 실제 Business/Enterprise 테스트 공간, 두 사용자 이상, 제한권한/게스트, 연결 앱의 합성 자료가 필요하다. 이 문서가 전체 reverse engineering 완료 증거는 아니다.
2. **AI 불투명성:** 검색 index 구조·chunking·ranking·모델 routing·시스템 프롬프트·위험 검토 로직·내부 작업 큐는 공개 문서로 복원할 수 없다. 동작 계약의 관찰 대상으로만 둔다.
3. **커넥터 세부:** Box/Outlook/Calendar/Asana/Linear 등은 연결 표면과 문서를 확인했지만 모든 객체·필드·삭제·보존·대량 동작을 아직 펼쳐 검증하지 않았다.
4. **API 전체 endpoint:** 인덱스에 있는 각 endpoint의 모든 JSON 필드·enum·에러·beta flag·page-property pagination·view-type별 config를 완전 명세화하지 않았다. Admin/SIEM/SCIM는 관리/보안 담당 문서와 교차 검토해야 한다.
5. **Workers:** 실행·build·ingress·DB 쓰기 기본 rate limit은 API-036/037에 문서 확인했다. SDK/schema builder 전체 타입, 시간·메모리·payload·billing 한도, OAuth 만료 중 재실행·배포 rollback·동시 sync 일관성 추가 분석이 남아 있다.
6. **발표와 문서의 배포 차이:** 2026-10-19 발표는 MCP memory sync를 설명하면서 Skills via MCP는 coming soon이라고 한다. Skills API/가이드 존재를 전체 계정 MCP 사용 가능 증거로 바꾸지 않는다. BYOK private alpha·AI command center 예정 상태도 별도 관리한다. [발표](https://www.notion.com/blog/notion-ai-more-for-less)
7. **문서 내부 충돌:** Calendar provider 서두/본문, API 기본 page size, Agent 권한 문서의 guest 설명 등은 실험 전 임의로 한쪽을 확정하지 않는다.
8. **Mail 수명주기:** 공식 검색 캐시 종료 공지는 현재 앱 실행 증거가 아니다. 기존 문서 원주소의 redirect와 현행 Gmail 연결을 별도로 기록했다.
9. **앱 패리티·접근성:** OS별 단축키·IME·키보드 탐색·스크린리더·작은 화면·알림·offline 복구는 이 문서에서 아직 세부 재현하지 않았다.
10. **플랜과 credits:** 확인한 개별 조건 외에는 가격·정확 무료 allowance·계약별 조건을 추정하지 않았다. 계획 수립 시 계정의 실제 계약·배포 상태를 확인해야 한다.

## 10. 출처 부록과 관찰 기록

확인일: 2026-10-20. 본문 링크는 각 주장에 가까이 배치했다. 아래는 실제 열거나 검색 스냅샷을 확인한 공식 출처 묶음이다. 문서 전체를 복사하지 않았고 각 출처의 요약량을 제한했다.

개발자 인덱스의 `.md` URL은 이 문서에서 동일 경로의 확장자 없는 HTML URL로 정규화했다. 예를 들어 `/workers/reference/limits.md`와 `/workers/reference/limits`를 별도 기능/별도 출처로 세지 않는다.

### 범위 발견용 목록

- [AI 전체](https://www.notion.com/help/category/notion-ai/all)
- [Custom Agents 전체](https://www.notion.com/help/category/custom-agents/all)
- [External Agents 전체](https://www.notion.com/help/category/external-agents/all)
- [AI Connectors 전체](https://www.notion.com/help/category/notion-ai-connectors/all)
- [Automations 전체](https://www.notion.com/help/category/automations/all)
- [Calendar 전체](https://www.notion.com/help/category/notion-calendar/all)
- [앱 전체](https://www.notion.com/help/category/notion-apps/all)
- [Marketplace 전체](https://www.notion.com/help/category/template-gallery/all)
- [개발자 문서 목록](https://developers.notion.com/llms.txt)

### AI·자동화 본문

- [Agent](https://www.notion.com/help/notion-agent), [Enterprise Search](https://www.notion.com/help/enterprise-search), [Autofill](https://www.notion.com/help/autofill), [Meeting Notes](https://www.notion.com/help/ai-meeting-notes)
- [Skills](https://www.notion.com/help/create-and-manage-skills), [Images](https://www.notion.com/help/create-and-edit-images-with-notion-ai), [Approval](https://www.notion.com/help/choose-how-notion-agent-asks-for-your-approval), [Browser](https://www.notion.com/help/turn-on-web-browser-for-notion-agent)
- [Agent MCP](https://www.notion.com/help/connect-mcp-servers-to-your-notion-agent), [Custom Agents](https://www.notion.com/help/custom-agents), [Agent ACL](https://www.notion.com/help/custom-agents-sharing-and-permissions)
- [Claude](https://www.notion.com/help/use-claude-agents-in-notion), [Cursor](https://www.notion.com/help/connect-cursor-to-notion), [ChatGPT plan](https://www.notion.com/help/use-your-chatgpt-plan-with-notion-agent), [AI announcement](https://www.notion.com/blog/notion-ai-more-for-less)
- [Buttons](https://www.notion.com/help/buttons), [DB buttons](https://www.notion.com/help/database-buttons), [Automations](https://www.notion.com/help/database-automations), [Webhook actions](https://www.notion.com/help/webhook-actions)
- 커넥터 15개 개별 본문은 2.3절 직접 링크 참조.

### 개발자 본문

- [Intro](https://developers.notion.com/reference/intro), [Versioning](https://developers.notion.com/reference/versioning), [Capabilities](https://developers.notion.com/reference/capabilities), [PAT](https://developers.notion.com/guides/get-started/personal-access-tokens)
- [Databases](https://developers.notion.com/guides/data-apis/working-with-databases), [Views](https://developers.notion.com/guides/data-apis/working-with-views), [Markdown](https://developers.notion.com/guides/data-apis/working-with-markdown-content), [Files](https://developers.notion.com/guides/data-apis/working-with-files-and-media)
- [Search](https://developers.notion.com/reference/search-optimizations-and-limitations), [Limits](https://developers.notion.com/reference/request-limits), [Webhooks](https://developers.notion.com/reference/webhooks), [Delivery](https://developers.notion.com/reference/webhooks-events-delivery)
- [MCP tools](https://developers.notion.com/guides/mcp/mcp-supported-tools), [Agent APIs](https://developers.notion.com/guides/notion-agent-apis/overview), [Skills API](https://developers.notion.com/guides/agent-skills/overview), [Link previews](https://developers.notion.com/guides/link-previews/introduction)
- [Workers](https://developers.notion.com/workers/get-started/overview), [Syncs](https://developers.notion.com/workers/guides/syncs), [Tools](https://developers.notion.com/workers/guides/tools), [Worker Webhooks](https://developers.notion.com/workers/guides/webhooks), [OAuth](https://developers.notion.com/workers/guides/oauth), [Sharing](https://developers.notion.com/workers/guides/sharing-workers), [CLI](https://developers.notion.com/cli/get-started/overview)
- [Comments](https://developers.notion.com/guides/data-apis/working-with-comments), [Meeting create](https://developers.notion.com/reference/create-meeting-note), [Meeting query](https://developers.notion.com/reference/query-meeting-notes), [Templates](https://developers.notion.com/guides/data-apis/creating-pages-from-templates)
- [Block limits](https://developers.notion.com/reference/workspace-block-limits), [Large queries](https://developers.notion.com/guides/data-apis/query-large-data-sources), [Property pagination](https://developers.notion.com/guides/data-apis/read-page-property-values), [Authorization](https://developers.notion.com/guides/get-started/authorization), [Status codes](https://developers.notion.com/reference/status-codes)
- [Worker limits](https://developers.notion.com/workers/reference/limits), [Worker API client](https://developers.notion.com/workers/guides/api-client), [Secrets](https://developers.notion.com/workers/guides/secrets), [SDK](https://developers.notion.com/workers/reference/sdk), [Schema/builders](https://developers.notion.com/workers/reference/schema), [MCP client](https://developers.notion.com/guides/mcp/build-mcp-client), [MCP Skills](https://developers.notion.com/guides/mcp/notion-skills)

### Calendar·앱·Mail

- [일정](https://www.notion.com/help/manage-your-calendars-and-events), [예약](https://www.notion.com/help/availability-blocking-and-time-zones), [Blocking](https://www.notion.com/help/blocking), [Timezone](https://www.notion.com/help/time-zones), [Calendar API](https://www.notion.com/help/notion-calendar-connections), [Notion 연결](https://www.notion.com/help/use-notion-calendar-with-notion)
- [계정 연결](https://www.notion.com/help/manage-email-and-calendar-settings), [Desktop](https://www.notion.com/help/notion-for-desktop), [Mobile](https://www.notion.com/help/notion-for-mobile), [Widgets](https://www.notion.com/help/mobile-widgets), [Clipper](https://www.notion.com/help/web-clipper), [New Tab](https://www.notion.com/help/notion-new-tab-extension), [Agents App](https://www.notion.com/help/notion-ai-app-for-ios)
- [템플릿 찾기](https://www.notion.com/help/finding-templates-on-marketplace), [판매](https://www.notion.com/help/selling-on-marketplace)
- Mail의 **DOC-CACHED** 원주소와 redirect 관찰은 6절에 별도 명시했다. API `workers/reference/runtime` 추정 경로는 가져오기 실패하여 근거로 사용하지 않았다.
