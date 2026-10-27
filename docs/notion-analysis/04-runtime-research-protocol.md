# 실제 동작 분석 절차와 교차 기능 시나리오

상태: **조사 설계 작성 / 아래 시나리오 전부 미실행**.
이 문서는 Notion 기능을 조사하기 위한 절차이며 제품 구현 명세나 Slacord 통합 제안이 아니다.

## 분석 단위

카테고리 목록을 확보한 것, 문서를 읽은 것, 사용 화면을 관찰한 것, 예외 동작을 검증한 것은 서로 다른 단계다.

| 상태 | 의미 | 필요한 증거 |
|---|---|---|
| INDEXED | 공식 디렉터리에서 발견 | URL, 발견 시각, 출처 디렉터리 |
| DOC | 공식 문서의 동작·제약을 검토 | 직접 열람 가능한 URL, 주장, 적용 조건 |
| DOC-CACHED | 검색/캐시에만 설명이 남고 직접 본문 확인 실패 | 원 URL, 확인 경로, redirect/오류, 재확인 과제 |
| OBS | 선택한 환경에서 실제 작업 실행 | 환경, 입력, 단계, 화면/응답, Evidence ID |
| VERIFIED | 반복/경계/역할 변형까지 결과 비교 | 반복 횟수, 예상/실제, 반례, 제한 |
| UNKNOWN | 근거 부족·접근 불가·문서 상충 | 질문, 필요한 계정/환경, 다음 검증 방법 |

DOC를 OBS로 바꾸지 않는다. 이름이나 bundle 문자열을 발견해도 해당 기능이 실행됐다고 기록하지 않는다. API 지원과 UI 기능 지원도 별도로 기록한다.

## 현재 확보한 런타임 증거

기존 로그인 캡처만 재사용한다.

- 진입: `https://www.notion.so/login` → `https://app.notion.com/login`.
- Evidence: `ev_60d0df78ceec3031f716d0ca86b1135a86f9622bb821628de1f46e74cc0dd7a6`.
- 원본: 저장소 로컬 `.rea/notion-login-evidence.json`.
- Chrome/Chromium 155.0.8059.80, headless/빈 프로필, 최종 URL와 접근성 트리.
- 로그인 후 편집기·데이터베이스·협업·계산을 입증하지 않는다.

이번 전체 조사에서는 Chrome의 별도 원격 디버깅 프로세스 실행을 시도했으나 자동 승인 검토가 `blocked by policy`로 거부했다. 세부 사유는 반환되지 않았으며, 브라우저/번들 추가 분석은 실행되지 않았다. 같은 차단 동작을 다른 실행 경로로 재시도하지 않았다.

## 조사 환경 기록

각 결과에 다음을 기록한다. 알 수 없는 값은 `unknown`이다.

- 조사 날짜/시각, 웹 URL 또는 데스크톱/모바일 버전, 운영체제, 브라우저 버전.
- 워크스페이스 요금제, beta/rollout 가시성, 계정 역할, 연결된 provider.
- locale, timezone, 화면 크기, 키보드/IME, 온라인/오프라인 상태.
- 개인 설정과 공용 설정, agent/model/credit 설정.
- 테스트 데이터 상태, 행동, 관찰 구간, 네트워크 자료의 수집 범위.
- 문서상 예상, 관찰 실제, 반복 횟수, 실패 조건, 해석과 남은 질문.

## 합성 데이터

테스트 워크스페이스는 실제 업무 자료와 구분된 페이지 트리에서 준비한다.

- 페이지: `Research Home`, `Private Notes`, `Shared Notes`, `Archive Samples`.
- 프로젝트 source: P-001 출시, P-002 유지보수.
- 작업 source: T-001 문서 작성(예상 3), T-002 검토(예상 5), T-003 빈 속성.
- 상태: 대기/진행/완료. 선택 옵션은 표시 이름을 바꿔 비교할 수 있도록 서로 구분.
- 날짜: date-only, UTC timestamp, Asia/Seoul 표시, DST 전환을 포함하는 별도 sample.
- 관계: P-001↔T-001/T-002, P-002↔T-003. 롤업 숫자 합계의 입력은 3과 5.
- 역할: owner/admin, 편집자 A/B, viewer, commenter, guest, 로그아웃 방문자.
- 파일: 합성 텍스트/작은 이미지. 실제 고객 자료나 실제 식별자를 사용하지 않는다.

표시 ID는 테스트용 이름이며 Notion 내부 ID가 아니다. 생성 후 실제 객체 ID는 해당 fixture의 로컬 manifest에서만 연결한다.

## 교차 기능 관찰 목록

아래 “판정할 질문”은 실제 결과가 아니다. 공식 문서가 명확한 경우 해당 영역 보고서의 DOC와 대조하고, 모호한 경우 결과를 예상으로 채우지 않는다.

| ID | 사전조건·행동 | 판정할 질문 | 필요 환경 |
|---|---|---|---|
| X-001 | 페이지 A에 중첩 문단·목록·토글·표·다단 배치 후 복제 | 블록 ID/링크/댓글과 내용 복제 범위가 무엇인가 | 편집자 |
| X-002 | 문단을 다른 부모로 이동하고 링크에서 다시 진입 | identity·앵커·backlink·이력이 어떻게 유지되는가 | 편집자 |
| X-003 | 한국어 IME 조합 중 Enter/Backspace/undo, 붙여넣기 | 조합 확정과 명령 처리 경계·내용 유실 여부 | 한국어 IME |
| X-004 | 토글 내부에 긴 목록을 두고 선택/복사/변환 | 접힌 블록·다중 선택의 범위와 변환 손실은 무엇인가 | 웹/데스크톱 |
| X-005 | simple table 병합/해제 후 database로 변환 시도 | 지원 변환과 손실·거부 메시지는 무엇인가 | 편집자 |
| X-006 | 두 페이지에 synced block 배치 후 원본 권한 제거 | 복제 위치·참조 사용자에게 무엇이 보이는가 | 2역할 |
| X-007 | 페이지 이동 전후 팀스페이스 권한을 변경 | 상속·명시 grant·guest 접근·확인 UI의 우선순위 | 관리자/guest |
| X-008 | 하위 페이지만 공유한 상태로 부모 이름·검색 확인 | 상위 경로와 관련 문서의 노출 경계는 무엇인가 | guest |
| X-009 | 댓글 앵커 텍스트를 수정·삭제·복원 | 앵커 위치와 orphan comment·해결 상태의 수명 | 편집자/commenter |
| X-010 | 사용자/날짜/페이지 mention 생성 후 이름·권한 변경 | 표시 이름·링크·알림·reminder가 어떻게 변하는가 | 2역할 |
| X-011 | 동일 페이지를 두 세션에서 동시에 수정·undo | 병합 순서와 개인 undo 범위는 무엇인가 | 편집자 A/B |
| X-012 | offline 페이지 편집 중 온라인 사용자도 수정 | 재접속 결과·충돌 안내·지원 블록 범위 | 2세션 |
| X-013 | 두 세션에서 같은 속성 값을 다른 값으로 수정 | 승리 값/타임스탬프/이력·충돌 안내 | 2세션 |
| X-014 | 행 title/property 이름 변경 후 view와 수식 재열기 | 표시 이름 변경과 identity 참조는 어떻게 분리되는가 | 편집자 |
| X-015 | 숫자↔텍스트↔선택 타입 변경 후 undo/복원 | 변환 가능한 값·손실 안내·복원 범위 | schema 편집자 |
| X-016 | select/status 옵션 삭제·병합·그룹 재배치 | 기존 값·보드 열·필터·자동화 조건 변화 | schema 편집자 |
| X-017 | 같은 source를 두 위치에서 연결하고 필터 수정 | 값 변경과 view 설정 공유의 실제 범위 | 편집자 |
| X-018 | container에 source 2개를 추가하고 source 이동 | view·page identity와 source/container 권한 변화 | 관리자/편집자 |
| X-019 | relation 단방향→양방향 설정·삭제·복구 | reciprocal 값과 dangling relation 처리 | source 2개 |
| X-020 | 관련 작업 값을 수정·삭제·restore | rollup 갱신 시점·빈 값·삭제 항목 포함 여부 | 2source |
| X-021 | formula에 빈 숫자/0/빈 리스트/삭제 속성을 입력 | 타입·empty·error·파싱/평가 오류 구분 | formula |
| X-022 | relation chain과 상호 참조 formula 설정 | 의존성 깊이·순환 제한·오류 표현 | formula/rollup |
| X-023 | restricted property를 filter/sort/group/chart에서 참조 | UI·집계·검색·API에서 비가시 값의 취급 | 2역할 |
| X-024 | row-level access 변경 후 relation picker/linked view 검색 | 조회 경로마다 동일한 접근 제한이 적용되는가 | 2역할 |
| X-025 | board 카드 이동·calendar 일정 이동·timeline resize | 원본 속성 변경과 undo·알림·자동화 발생 | 복수 view |
| X-026 | date-only/시간 포함 값을 DST·서로 다른 시간대로 표시 | 필터 상대 날짜·grouping·Calendar의 날짜 경계 | 2timezone |
| X-027 | chart에 빈 값·음수·중복 관계를 포함 | 집계 대상·축·드릴다운과 원본 조회의 대응 | chart |
| X-028 | dashboard filter를 여러 source 위젯에 적용 | 적용 가능한 속성·독립 필터·unsupported 상태 | dashboard |
| X-029 | form 공개/내부 설정과 조건부 질문을 바꿔 제출 | 필수값·응답 identity·중복·작성자·접근 범위 | form/방문자 |
| X-030 | 반복 템플릿을 timezone 경계에 예약 | 생성 시각·기간·중복·자동화와의 연결 | 반복 template |
| X-031 | sub-item 완료/부모 삭제·dependency 날짜 수정 | 집계/종속 이동·순환·업무 캘린더 처리 | project DB |
| X-032 | 동일 속성을 직접·버튼·자동화·API로 변경 | trigger 발생 원인과 연쇄·반복 방지 차이 | 자동화 |
| X-033 | 자동화 권한/대상 페이지 삭제 후 실행 | 실패 로그·재시도·실행자·알림 표현 | 자동화 소유자 |
| X-034 | 페이지 trash/archive/version restore | 자식·첨부·관계·댓글·공유 URL·검색의 수명 | 관리자 |
| X-035 | markdown/CSV/HTML/PDF export 후 다시 import | 보존되는 본문·속성·관계·권한·ID와 손실 | export 권한 |
| X-036 | AI에 같은 질문을 역할별·connector 권한별 실행 | 인용·출처·권한·최신성·미확인 응답 | AI 사용 계정 |
| X-037 | AI 수정 제안을 부분 승인 후 undo | 승인 단위·미승인 내용·diff·이력 | AI |
| X-038 | Custom Agent source 접근을 실행 중 철회 | 실행 중/후 읽기·쓰기·로그의 경계 | agent 관리자 |
| X-039 | skill 수정·공유 후 personal/custom/external agent 실행 | skill 버전·선택·권한·지원 표면의 차이 | agents/skills |
| X-040 | API pagination 동안 행 추가/수정·필터 변경 | 안정적 cursor·중복/누락·snapshot semantics | API test connection |
| X-041 | webhook 동일 이벤트 재전달·out-of-order | delivery 보장·중복 ID·재시도·순서 | test receiver |
| X-042 | API token scope·page 공유·workspace 역할 철회 | UI 접근과 integration/PAT의 권한 구분 | 관리자/API |
| X-043 | Worker를 공유하고 권한 다른 사용자가 실행 | caller/owner identity·secret·저장·로그 범위 | Workers beta |
| X-044 | Calendar event와 date property를 이동·해제 | 양방향 반영·반복·시간대·provider 차이 | Calendar 연결 |
| X-045 | Sites publish/unpublish·하위 페이지 권한 변경 | 공개 링크·검색색인·첨부·preview 수명 | 테스트 공개 페이지 |
| X-046 | SSO/SCIM 사용자 제거·그룹 변경 | 활성 세션·guest·API·콘텐츠 소유권 영향 | Enterprise test tenant |
| X-047 | plan/credit 한도를 달리해 기능 접근 | UI 노출·읽기/쓰기 제한·기존 데이터 보존 | 해당 plan |
| X-048 | 웹·데스크톱·모바일에서 같은 fixture 수행 | 편집·드래그·오프라인·권한·접근성 차이 | 각 클라이언트 |

## 증거 저장 형식

```json
{
  "case_id": "X-014",
  "status": "not_run",
  "environment": {"plan": "unknown", "role": "unknown", "client": "unknown"},
  "fixture_id": "research-database-v1",
  "documented_expectation": null,
  "actual_result": null,
  "evidence_ids": [],
  "repeat_count": 0,
  "open_questions": ["Rename behavior has not been observed."]
}
```

캡처 전에 필요한 자료만 선택한다. 로그인 후 실사용 workspace 전체를 수집하지 않는다. 쿠키·토큰·비밀번호는 분석 문서나 공유 증거에 저장하지 않는다.

## 완료 판정

1. 공식 기능 디렉터리·API·release 목록을 대조하여 미분류 기능을 식별한다.
2. 각 기능의 개념·입력·상태 변화·출력·제약·역할·문서 출처를 기록한다.
3. 실제 관찰이 필요한 항목에 fixture와 실험 결과를 연결한다.
4. 미접근 요금제·beta·종료/캐시 기능을 현재 기능과 구별한다.
5. 미확인 사항을 제거하거나 사용자가 인정한 조사 경계로 남긴다.

현재 3–5는 충족하지 않았다. 따라서 이 조사 묶음을 “노션의 모든 기능에 대한 REA 분석 완료”로 부르지 않는다.
