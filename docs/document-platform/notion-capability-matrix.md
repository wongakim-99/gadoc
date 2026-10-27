# Notion 기능 분석 및 Slacord 제품 범위

조사일: 2026-10-20. 목적: 기존 문서 기능을 대체하는 문서·구조화 데이터·협업·자동화 플랫폼.

## 근거와 상태

- **DOC**: 아래 공식 Notion 도움말/API 문서에서 확인한 외부 동작·공개 모델.
- **OBS**: 계정으로 실제 실행하고 화면·입력·출력 증거를 확보한 동작. **이번 조사에서는 0건**이다.
- **TARGET**: Slacord에서 구현·검증할 자체 요구사항. Notion 내부 구현에 대한 주장이 아니다.
- 이 문서는 제품 범위와 인수 시나리오의 초안이다. 구현 완료, 완전한 기능 동등성 또는 REA 런타임 분석 완료를 의미하지 않는다.
- 단계는 의존성에 따른 구현 순서이며 뒤 단계 기능도 전체 제품 범위에 포함한다. 기존 Slacord의 충족 여부는 별도 코드·실행 검증으로 판정한다.

## 데이터 모델에서 먼저 반영할 사실

공개 API는 database, data source, page를 별도 객체로 다룬다. Database는 data source와 view를 담고, data source가 속성 스키마와 소속 페이지를 정의한다. 행은 본문 블록을 가진 page이고 속성 정의와 page의 속성 값은 분리된다. Title 속성은 data source마다 하나이며 표시 이름은 바뀔 수 있다. [DOC: API 데이터 모델](https://developers.notion.com/guides/data-apis/working-with-databases)

하나의 database에서 여러 data source를 사용하거나 기존 source를 연결할 수 있다. 따라서 `문서 + JSON 속성 + 단일 테이블 UI`만으로 전체 범위를 표현한다고 가정하지 않는다. **TARGET 설계 판단:** source, schema, record-page, view, linked placement를 독립 식별자로 관리하고 이름 변경으로 참조가 깨지지 않게 한다. [DOC: Data sources](https://www.notion.com/en-gb/help/data-sources-and-linked-databases)

## 기능 매트릭스

아래 인수 시나리오는 모두 **TARGET / 미실행**이다. 출처가 있는 기능은 DOC이며, 별도로 `조사 필요`라고 쓴 행은 아직 세부 명세를 확정하지 않는다.

| ID | 영역·전체 제품 범위 | 인수 시나리오 | 단계·공식 근거 |
|---|---|---|---|
| DATA-01 | Database / data source / record-page / schema 분리 | 작업·고객 source를 한 database에서 사용하고 작업 행을 열어 문서 본문을 편집한다 | M1, [모델](https://developers.notion.com/guides/data-apis/working-with-databases) |
| DATA-02 | Linked source와 독립 view 설정 | 원본과 연결 뷰에서 같은 record ID의 변경이 보이고 필터 설정은 서로 분리된다 | M2, [sources](https://www.notion.com/en-gb/help/data-sources-and-linked-databases) |
| PROP-01 | Title, text, number, select, multi-select, status, checkbox | 속성명 변경 후 기존 값·필터·수식 참조가 유지되고 잘못된 타입 입력이 거부된다 | M1, [properties](https://www.notion.com/help/database-properties) |
| PROP-02 | Date/range/time/timezone, person/group, files, URL/email/phone | 기간·시간대·복수 담당자·첨부파일을 저장하고 재접속 후 같은 의미로 표시한다 | M1–M2, [properties](https://www.notion.com/help/database-properties) |
| PROP-03 | Created/edited time·actor, unique ID, button, place | 감사 속성을 직접 수정할 수 없고 ID가 중복되지 않으며 위치 값이 지도에 연결된다 | M2–M4, [properties](https://www.notion.com/help/database-properties) |
| PROP-04 | 속성 숨김·순서·표시 형식·조건부 색상·속성 댓글 | 뷰 A의 표현 설정이 B를 바꾸지 않고 값에 연결된 댓글이 유지된다 | M2, [properties](https://www.notion.com/help/database-properties) |
| CALC-01 | Relation, 양방향 관계, relation 기반 rollup | 프로젝트에 작업 3개를 연결하고 작업 예상 시간 변경 시 프로젝트 합계가 갱신된다 | M2, [relations/rollups](https://www.notion.com/help/relations-and-rollups) |
| CALC-02 | 수식: 타입, 연산자, 분기, 문자열·숫자·날짜, 리스트, 관계 접근 | 관련 작업 필터→수치 합산이 동작하고 빈 값·오류·타입 변경 결과를 명시한다 | M2, [formula language](https://www.notion.com/help/formula-syntax) |
| VIEW-01 | Table, board, list, gallery, calendar, timeline | 같은 레코드를 여섯 뷰로 표시하고 보드 상태·캘린더 날짜 변경이 원본 속성에 반영된다 | M2–M3, [view catalogue](https://www.notion.com/help/category/database-views/all) |
| VIEW-02 | 복합 필터, 다중 정렬, 그룹, 개인/공용 설정 | `(담당자=나 AND 미완료) OR 우선순위=높음` 결과를 검증하고 정렬 우선순위를 바꾼다 | M2, [query/view settings](https://www.notion.com/help/views-filters-and-sorts) |
| VIEW-03 | Chart, drilldown, 시각화 내보내기 | 차트 집계를 원본 행과 대조하고 구간 선택 시 해당 데이터만 표시한다 | M3, [charts](https://www.notion.com/help/charts) |
| VIEW-04 | Dashboard, 위젯 배치, 공통 필터 | 보드·차트·테이블을 배치하고 공유 속성의 필터가 관련 위젯에 적용된다 | M3, [dashboards](https://www.notion.com/en-gb/help/dashboards) |
| VIEW-05 | Map와 place, feed, 페이지 속성 layout | 지도 핀에서 원래 페이지를 열고 feed·layout 설정을 재접속 후 복원한다 | M3, [map](https://www.notion.com/help/maps), [catalogue](https://www.notion.com/help/category/database-views/all); feed/layout 세부 OBS 필요 |
| FORM-01 | 속성에 연결된 form, 공개·내부 응답, 응답 후 자동화 | 비회원 응답이 record로 생성되지만 다른 응답 목록을 열람할 수 없다 | M3, [forms](https://www.notion.com/help/forms) |
| TEMPLATE-01 | Database 템플릿, 기본값·본문, 반복 템플릿 | 회의록 템플릿으로 독립 문서를 생성하고 반복 생성의 시간대·중복을 검사한다 | M3–M4, [templates](https://www.notion.com/help/database-templates) |
| BLOCK-01 | 중첩 페이지·블록, 텍스트/목록/토글/코드/미디어, 다단·드래그·변환 | 중첩 이동·복사·붙여넣기·실행 취소 후 본문과 블록 ID 참조가 보존된다 | M1–M3, 상세 블록 목록·키보드·IME 동작 REA 조사 필요 |
| BLOCK-02 | Synced block과 재사용 | 두 위치 중 한 곳 편집 시 모두 갱신되고 원본 접근 불가 사용자는 내용을 못 본다 | M3, [synced blocks](https://www.notion.com/en-gb/help/synced-blocks) |
| COLLAB-01 | 댓글·멘션·반응·알림 | 문장 댓글과 사용자 멘션을 만들고 수신자의 읽기 권한을 유지한다 | M3, [comments](https://www.notion.com/help/comments-mentions-and-reminders) |
| COLLAB-02 | 동시 편집·접속 표시·재연결·오프라인 | 두 사용자의 교차 수정과 오프라인 편집 후 재연결에 유실이 없고 결과가 수렴한다 | M3, [offline](https://www.notion.com/en-gb/help/guides/working-offline-in-notion-everything-you-need-to-know); 충돌 알고리즘은 자체 설계 |
| HISTORY-01 | 삭제·복원·이력 | 삭제된 부모·자식·첨부와 지정 시점 내용을 복원하고 참조 무결성을 검사한다 | M1–M5, [restore](https://www.notion.com/help/duplicate-delete-and-restore-content) |
| ACL-01 | 개인·팀·게스트·공유, 읽기/댓글/내용 편집/구조 편집·관리 | 내용 편집자가 record 값은 바꾸되 schema·권한을 바꿀 수 없다 | M1, [permissions](https://www.notion.com/help/sharing-and-permissions) |
| ACL-02 | Person/created-by 기반 page-level access | 담당자에게 해당 작업 접근만 주고 전체 database·다른 작업 노출을 검사한다 | M2, [page access](https://www.notion.com/help/sharing-and-permissions) |
| ACL-03 | Property-level access: 정의/값의 보기·편집 분리, 예외 | 담당자는 자기 작업의 제한 속성 값만 수정하며 API·export·필터에서도 제한이 유지된다 | M2–M3, [property access](https://www.notion.com/help/database-property-access) |
| AUTO-01 | Page 생성·속성 변경·일정 trigger, 조건·다중 action | 상태 변경→담당자 지정→알림의 실행 결과와 실패·재시도를 확인한다 | M4, [automations](https://www.notion.com/help/database-automations) |
| AUTO-02 | Button action, 수식·멘션 파라미터 | 승인 버튼으로 속성·관련 페이지를 갱신하되 실행자 권한을 재검증한다 | M4, [buttons](https://www.notion.com/help/database-buttons) |
| API-01 | Pages/blocks/data sources/properties/comments/files/views API, 인증·pagination | API 생성 데이터가 UI에 나타나고 cursor로 전체 결과를 누락 없이 조회한다 | M4, [API](https://developers.notion.com/reference/intro) |
| API-02 | Webhook subscription, 인증 검증, 이벤트 전달·중복 처리 | 동일 이벤트 재전달에도 후속 작업이 중복되지 않고 해지 후 전달이 중단된다 | M4, [webhooks](https://developers.notion.com/reference/webhooks) |
| API-03 | Rate limit·용량 제한·retry 정책 | 제한 응답에서 Retry-After를 지키고 재시도 가능한 실패와 영구 실패를 구분한다 | M4, [limits](https://developers.notion.com/reference/request-limits) |
| MOVE-01 | Import/export, 기존 Slacord 문서 이관 | 본문·트리·권한·첨부·이력을 샘플 대조하고 실패 항목과 재실행 결과를 보고한다 | M1 설계/M5 전환, [import](https://www.notion.com/help/import-data-into-notion), [export](https://www.notion.com/help/export-your-content) |
| EXT-01 | 자체 확장점: 블록·속성·뷰·action·connector 등록 | 새 타입을 등록하고 저장·검증·렌더링·검색·이관 버전 정책을 적용한다 | M1 계약/M4 구현, **TARGET**: Notion 플러그인 내부 구조를 추정한 것이 아님 |
| SLACORD-01 | 채팅·이슈·문서·record의 상호 참조, 통합 검색·알림 | 메시지→문서→이슈 연결 후 원래 대화로 돌아가며 권한 없는 대상의 제목도 노출하지 않는다 | M3–M4, **TARGET** |

## 세부 설계·REA에서 빠뜨리지 않을 경계

1. **수식·집계**: AST·타입 검사·의존성 그래프·순환 참조·재계산·자원 제한은 자체 구현 과제다. Notion이 이 내부 구조를 사용한다고 단정하지 않는다. 공식 함수별 fixture와 오류 fixture를 확보한다.
2. **권한**: 뷰의 숨김/필터는 보안 경계가 아니다. 서버 쿼리·검색·댓글·관계 선택·rollup·수식·첨부·export·webhook에도 평가해야 한다. Property access는 page access를 새로 부여하지 않으며 복수 예외·관리자 규칙은 실제 관찰로 확인한다. [DOC](https://www.notion.com/help/database-property-access)
3. **자동화**: 공식 문서는 자동화가 다른 자동화를 재귀적으로 촉발하지 않는다고 설명하며 버튼은 별도 취급한다. 자체 엔진은 event origin, 재시도, idempotency, loop 방지, 실행 이력, 예약 시간대를 명시한다. [DOC](https://www.notion.com/help/database-automations)
4. **API와 UI 차이**: 공개 API 지원 목록을 UI 전체 동등성으로 해석하지 않는다. 현재 문서에는 view 목록/쿼리 endpoint도 있으므로 과거 API 제약을 그대로 적용하지 않는다. [DOC](https://developers.notion.com/reference/intro)
5. **내보내기**: CSV만으로 관계·본문·권한·이력이 모두 보존된다고 가정하지 않는다. 자체 JSON 백업 manifest와 ID remap·무결성 검사를 별도 설계한다. 관계 CSV의 재수입 한계는 공식 문서에도 있다. [DOC](https://www.notion.com/help/relations-and-rollups)
6. **성능**: 데이터 규모별 pagination·가상 스크롤·인덱스·계산 지연을 측정한다. 구체적 p95·동시 사용자·최대 데이터 목표는 Slacord 환경 측정 후 확정하며 근거 없이 성능을 보증하지 않는다.

## 누락 방지용 후속 조사 대기열

다음은 전체 제품 범위를 유지하기 위한 **조사 대기 항목**이다. 이 문서에서 동작·호환성까지 확인한 것으로 취급하지 않는다.

- 블록 종류 전체, inline 수식·코드·링크·색상, 임베드 제공자, 파일 업로드/재개, 모바일·접근성·한국어 IME.
- Backlink, 페이지/블록 링크, 이동·복제 시 링크 처리, wiki·검증/소유자, 검색 ranking.
- Sub-items, dependencies, 날짜 자동 이동, 반복 작업 및 project/task 특화 기능.
- AI 작성/요약/속성 자동 채움/검색/agent, 외부 데이터 connector, 템플릿 갤러리.
- Teamspace 관리, 감사 로그, SSO/SCIM, 게스트 관리, 공개 페이지/사이트 공유 정책.
- Calendar 및 외부 서비스 연동: 문서 플랫폼과의 접점부터 조사하고 별도 앱 전체의 복제 여부는 별도 경계로 기록한다.

## 마일스톤과 완료 게이트

| 단계 | 범위 | 다음 단계 진입 조건 |
|---|---|---|
| M0 관찰·설계 | 공식 기능 지도, 현재 코드 gap, 합성 데이터 fixture, 런타임 관찰표 | DOC/OBS/TARGET 분리, 모델·권한·이관 계약 검토 |
| M1 플랫폼 코어 | page/block/source/schema/value/view 식별자, 기본 타입·권한, API 계약·이관 뼈대 | 생성/수정/삭제/복원·권한 차단·스키마 변경 무결성 테스트 |
| M2 데이터 엔진 | relation/rollup/formula, query/view, 세밀한 권한 | 계산 fixture·관계 정합성·속성 타입 전환·비인가 조회 검사 |
| M3 제품 경험 | 전체 뷰·폼·템플릿·고급 블록·협업·오프라인·검색 | 대표 업무 end-to-end, 충돌/재연결, 접근성·키보드 검증 |
| M4 확장·통합 | 자동화·버튼·API/webhook·connector·Slacord 연결 | 실행 이력·실패 복구·중복 이벤트·권한 변경 검증 |
| M5 대체 운영 | 전체 기능 gap 폐쇄, 데이터 이관, 부하·백업·복구·운영 | dry-run 대조·롤백 연습·관측성·잔여 차이 목록 검토 후 기존 문서 전환 |

M1 완료는 전체 제품 완료가 아니다. 모든 대상 기능은 최종적으로 `구현됨`, `차이 합의`, `미완료` 중 하나로 추적하며, 미완료 기능을 암묵적으로 범위에서 제거하지 않는다.

## 런타임 관찰 기록 형식

각 시나리오에 `case_id`, 기능 ID, 조사 시각, 환경/플랜/앱 버전, 합성 입력 데이터, 역할·권한, 실행 단계, 예상값, 실제값, 화면 증거 경로, 네트워크/공개 API 근거, 재현 횟수, 미확인점, Slacord fixture ID를 기록한다. 인증 토큰·개인 문서·실사용자 데이터는 저장하지 않는다.

현재 상태: 공식 문서 기반 분석 완료, 런타임 OBS 없음, Slacord 인수 시나리오 전부 미실행.
