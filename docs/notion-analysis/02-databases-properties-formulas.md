# Notion 데이터베이스·속성·뷰·수식 분석

조사일: 2026-10-20
범위: Notion의 구조화 데이터 기능 전체를 조사 대상으로 삼은 공개 문서 분석. Slacord 통합 설계나 구현 제안은 포함하지 않는다.
증거 수준: **DOC = 공식 문서에서 확인**, **TEST = 재현 시험 설계, 미실행**, **UNKNOWN = 공개 자료만으로 확정 불가**. 이 문서에는 로그인한 제품의 직접 관찰 결과가 없다. 문서의 기능 존재 확인과 실제 동작 검증은 별개다.

## 1. 핵심 개념과 식별자

| ID | 분석 대상 | DOC로 확인한 동작 | 남은 확인 |
|---|---|---|---|
| D-001 | 데이터베이스 항목 | 각 항목은 속성과 자유로운 블록 본문을 가진 페이지다. 같은 항목을 테이블·보드 등으로 표현한다. | 페이지 이동 때 속성 값의 보존·매핑 |
| D-002 | 배치 | 전체 페이지와 인라인 데이터베이스를 상호 전환할 수 있다. | 인라인 이동과 공유 경계의 동시 변경 |
| D-003 | 복제 | 데이터 포함/제외 복제가 구분된다. | 관계·자동화·템플릿·권한의 복제 범위 |
| D-004 | 편집 경계 | `Can edit content`는 항목과 값 편집을 허용하지만 원본 속성·뷰 구조 변경을 제한한다. | 속성별 UI 예외 및 링크된 뷰에서의 실제 권한 |
| D-005 | 잠금 | 데이터베이스 구조 잠금과 항목 값 편집은 별개다. 편집 권한자는 잠금을 해제할 수 있다. | 잠금은 권한 통제가 아닌 실수 방지인지 역할별 검증 |

근거: [S01 Intro to databases](https://www.notion.com/help/intro-to-databases).

| ID | 분석 대상 | DOC로 확인한 동작 | 남은 확인 |
|---|---|---|---|
| D-006 | 데이터 소스 | 데이터베이스는 하나 이상의 데이터 소스를 담는다. 소스는 페이지 집합이다. | 소스별 스키마의 이름 충돌 처리 |
| D-007 | 링크된 소스 | 기존 소스를 연결하면 같은 원본 데이터에 접근한다. 원본 접근 권한을 따른다. | 접근 철회 직후 열린 화면·캐시 갱신 |
| D-008 | 소스 이동 | 다른 DB 또는 일반 페이지로 이동 가능. 기존 뷰를 함께 옮기거나 링크된 뷰로 남길 수 있다. | 이동 권한 문서의 상충: 앞부분 `Can edit`, 뒷부분 `Full access` |
| D-009 | 링크 제거와 삭제 | 외부 소스 연결 제거와 원본 소스 휴지통 이동은 다른 작업이다. | 참조한 관계·대시보드의 삭제 후 표시와 복원 |

근거: [S02 Data sources](https://www.notion.com/help/data-sources-and-linked-databases). 소스별 별도 권한을 설정할 수 없다는 문구와 링크 원본 권한을 존중한다는 문구를 함께 읽어야 한다.

| ID | API 계약에서 확인한 구조 | 의미 |
|---|---|---|
| D-010 | `database_id`와 `data_source_id` 구분 | 2025-09-03의 다중 소스 도입으로 쿼리·스키마·페이지 부모·관계 대상의 식별 단위가 분리되었다. 이 버전이 현재 최신이라는 뜻은 아니다. |
| D-011 | 데이터베이스 조회의 소스 목록 | 컨테이너 ID만 저장하면 어느 소스를 대상으로 하는지 모호해질 수 있다. |
| D-012 | 소스별 웹훅 이벤트 | content/schema 변경, 생성·이동·삭제·복원 이벤트와 DB 컨테이너 이벤트가 구분된다. |

근거: [S03 API migration guide](https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03). 이는 공개 API 모델이며 내부 저장소 구조를 입증하지 않는다.

## 2. 일반 속성 목록과 조건부 속성

아래 23종은 일반 속성 도움말과 API 스키마를 합친 목록이다. 기능별 문서에만 나타나는 Verification/Owner는 별도로 기록했다. 비공개 기능 플래그까지 포함한 완전한 목록이라고 주장하지 않는다.

| ID | UI 타입 | 공개된 의미 |
|---|---|---|
| P-001 | Title / Name | 항목의 페이지 제목 |
| P-002 | Text | 서식 있는 텍스트 |
| P-003 | Number | 숫자와 통화·진행 표시 등 표현 형식 |
| P-004 | Select | 단일 옵션 |
| P-005 | Multi-select | 복수 옵션 |
| P-006 | Status | 할 일·진행·완료 그룹 안의 상태 |
| P-007 | Date | 날짜 또는 기간, 선택적 시각 |
| P-008 | Person | 워크스페이스 사람 또는 그룹 |
| P-009 | Files / media | 파일·이미지 |
| P-010 | Checkbox | 참/거짓 |
| P-011 | URL | 웹 링크 |
| P-012 | Email | 이메일 주소 |
| P-013 | Phone | 전화번호 |
| P-014 | Created time | 생성 시각, 자동 |
| P-015 | Created by | 생성자, 자동 |
| P-016 | Last edited time | 수정 시각, 자동 |
| P-017 | Last edited by | 수정자, 자동 |
| P-018 | Formula | 수식 평가 결과 |
| P-019 | Relation | 다른 항목과 연결 |
| P-020 | Rollup | 관계를 따라 집계 |
| P-021 | Button | 클릭으로 액션 실행 |
| P-022 | ID | 자동 고유 번호 |
| P-023 | Place | 장소·주소·현재 위치 |

근거: [S04 Database properties](https://www.notion.com/help/database-properties), [S05 Data source properties](https://developers.notion.com/reference/property-object).

**P-033 Verification / P-034 Owner:** Business/Enterprise에서는 일반 DB에 Verification을 추가할 수 있고 Owner도 자동 생성된다. 검증 만료와 소유자 기본값·인원 제한을 관리한다. 일반 Person·Checkbox와 동일시하지 않는다. [S42 Wikis & verified pages](https://www.notion.com/help/wikis-and-verified-pages)

추가 문서 확인:

- **P-024 조건부 색상:** 뷰별 규칙이며, 복제한 뷰에는 규칙도 복제된다. 테이블에서는 행 또는 속성 셀 적용을 선택한다. Table/Calendar/Timeline/List/Board/Feed 지원이 명시되어 있다.
- **P-025 속성 댓글:** 이미 값이 있는 속성에서 가능. 제목·수식·롤업·버튼·ID는 제외한다. 체크박스 댓글은 페이지를 열어 작성한다.
- **P-026 속성 개수:** DB당 500개 상한이 문서에 명시된다. 다중 소스에서의 정확한 집계 단위는 실측 필요.

근거: [S04 Database properties](https://www.notion.com/help/database-properties).

### 2.1 UI 타입과 API 값의 차이

**P-027 스키마 불변 조건:** data source에는 `title` 속성이 정확히 하나 있다. 이름을 바꾸어도 ID는 `title`이다. 삭제·다른 타입 전환·다른 속성을 title로 전환하는 것은 허용되지 않는다. 상태는 옵션과 그룹을 구분하고, 고유 ID는 접두사 설정과 자동 번호를 구분한다. Place에는 좌표와 부가 정보가 있다. Button은 공개 API에서 설정/실행을 노출하지 않는다. [S05 Data source properties](https://developers.notion.com/reference/property-object)

**P-028 값 변경 계약:** 배열 값 업데이트는 추가가 아니라 전체 교체다. 생략한 속성은 기존 값을 유지한다. Place 쓰기는 위도·경도를 필요로 하며 API가 주소를 지오코딩하지 않는다. 전화번호 API 값은 형식을 강제하지 않는다. 상태 값 쓰기로 새 상태 옵션을 만들 수 없다. [S06 Page property values](https://developers.notion.com/reference/page-property-values)

**P-029 불완전 응답:** 페이지 조회의 Relation은 최대 25개 참조 뒤 `has_more`가 나타날 수 있다. Person 및 rich text의 인라인 멘션에도 별도 응답 제한이 있다. 복잡한 Formula/Rollup은 `unsupported` 결과가 가능하며 재요청만으로 해결되지 않는다. UI의 전체 값과 단일 API 응답을 동일시하면 안 된다. [S06 Page property values](https://developers.notion.com/reference/page-property-values)

### 2.2 스키마 변경 분석 항목

**D-013** 공개 API는 소스 이름·아이콘·스키마·부모·휴지통 상태 변경을 구분한다. 속성 변경은 소스 스키마 작업이다. [S07 Update a data source](https://developers.notion.com/reference/update-a-data-source)

**P-031 API 스키마 변경 세칙:** 이름 변경에도 속성 ID가 유지된다. `null` 속성 항목은 소스 전체에서 해당 열을 제거한다. 옵션 목록은 유지할 전체 집합을 보내야 하며 생략한 옵션은 제거된다. 기존 옵션 이름 비교는 대소문자·주변 공백을 무시하고, 기존 옵션 이름 자체 변경은 UI에서 수행하도록 안내한다. Status 옵션에 그룹을 지정할 수 있지만 그룹 이름·순서 변경은 UI 작업이다. API는 Place 타입을 다른 타입과 상호 변환할 수 없다고 명시한다. Map 도움말의 Text→Place 안내와 구분해야 한다. [S35 Update data source properties](https://developers.notion.com/reference/update-data-source-properties)

아래는 **UNKNOWN**이며 변환표를 만들기 전에는 보존을 가정할 수 없다.

1. Text→Number에서 `"001"`, `"1,200"`, `"10%"`, `"abc"`, 빈 문자열의 처리.
2. Multi-select→Select에서 다중 값 축약 기준.
3. Select→Status에서 옵션 ID·그룹·색상 매핑.
4. Date→Text→Date에서 시간대·기간·리마인더 보존.
5. Formula/Rollup→일반 속성의 결과 고정 또는 데이터 손실.
6. 속성 삭제 후 undo/휴지통/페이지 이력 복원에서 스키마와 값의 복구.
7. 이름이 같은 속성 생성 허용 여부, 이름 변경 시 수식·자동화·폼·필터의 참조 유지.
8. 스키마 변경과 오프라인/동시 값 편집의 충돌 처리.

## 3. 뷰 전체와 고유 상호작용

### 3.1 기본 뷰

| ID | 뷰 | DOC로 확인한 기능 | TEST에서 확인할 경계 |
|---|---|---|---|
| V-001 | Table | 셀 편집, 여러 행 속성 일괄 수정, 행/열 이동, 열 폭, 줄바꿈, 집계 | 필터로 숨긴 행의 전체 선택 포함 여부, 붙여넣기 원자성 |
| V-002 | Board | 그룹·하위 그룹, 카드 이동, 카드 크기·이미지·속성 표시, 빈 그룹 숨김 | 다중 선택 그룹 간 드래그가 기존 값에 추가/교체되는지 |
| V-003 | Timeline | 기간을 시간축에 표시하고 시간 단위·표시 속성을 조절 | 시작일/종료일이 다른 속성일 때 이동·리사이즈 |
| V-004 | Calendar | 날짜 속성에 따라 배치, 날짜에서 새 항목 생성, 일정 이동 | 날짜 없는 항목, 기간·자정·시간대 경계 |
| V-005 | List | 간결한 항목 목록과 속성 표시 | 긴 제목·숨긴 속성·그룹에서 키보드 탐색 |
| V-006 | Gallery | 커버·본문·파일 이미지를 카드 미리보기로 표현 | 이미지 없는 페이지와 여러 파일의 대표 이미지 |

근거: [S08 Table](https://www.notion.com/help/tables), [S09 Board](https://www.notion.com/help/boards), [S10 Timeline](https://www.notion.com/help/timelines), [S11 Calendar](https://www.notion.com/help/calendars), [S12 List](https://www.notion.com/help/lists), [S13 Gallery](https://www.notion.com/help/galleries).

**V-007 집계:** 테이블은 전체·빈 값·고유 값·비율·최초/최종 날짜·기간과 숫자의 합·평균·중앙값·최소·최대·범위를 제공한다. Board는 그룹 단위 계산이 존재한다. 필터·하위 항목·권한으로 제외된 값이 집계에 어떻게 반영되는지는 직접 확인해야 한다. [S08 Table](https://www.notion.com/help/tables), [S09 Board](https://www.notion.com/help/boards)

### 3.2 차트

**V-008 Chart:** 세로/가로 막대, 선, 도넛, 숫자 차트가 문서에 열거된다. 차트에서 항목을 직접 수정할 수 없다. 동시에 최대 200개 그룹·50개 하위 그룹을 표시한다. 하위 항목이 빠지면 평탄화 표시 설정을 확인하도록 안내한다. Free는 하나, 유료 플랜은 무제한 차트 생성이 명시된다. [S14 Chart](https://www.notion.com/help/charts)

추가 DOC: 축에는 롤업·버튼·ID·파일·리스트 결과 수식을 사용할 수 없다. Count/Sum과 오름차순 축에는 누적 옵션이 있다. 팔레트·라벨·범례·곡선·그라데이션·도넛 중앙 값 등의 표시 설정이 존재한다. `Omit zero values` 설명은 토글 의미가 앞뒤 문장에서 상충하므로 실제 동작 확인이 필요하다. [S14 Chart](https://www.notion.com/help/charts)

분석 분해 항목: 날짜 버킷, 빈 값, 그룹 상한 초과 시 생략, 드릴다운, 내보내기, 공개 페이지에서의 표시. 이 세부 조합은 아직 **TEST 미실행**이다.

### 3.3 지도와 장소

**V-009 Map:** Place가 없으면 생성 시 추가된다. 위치명·주소·위치 권한을 통한 입력을 지원한다. 지도 핀은 항목을 열고, 지도를 이동·확대할 수 있다. 최대 100개 항목을 동시에 표시한다. Place의 검색·정렬은 이름/주소의 텍스트 기준이다. 지오코딩은 외부 공급자에 의존하며 지역별 품질 차이가 문서화되어 있다. Text→Place 변환 후 주소 정리가 필요할 수 있다. [S15 Map](https://www.notion.com/help/maps)

UNKNOWN: 한국 주소·도로명/지번·영문 표기의 동등성, 같은 좌표의 핀 겹침, 101번째 항목 선정 기준, 오프라인 지도, 거리 반경 검색 지원 여부.

### 3.4 피드

**V-010 Feed:** 세로로 쌓인 카드에서 내용을 탐색하고, 직접 댓글을 작성하며, 게시물 조회를 추적한다. 표시 속성을 조절할 수 있다. [S16 Feed](https://www.notion.com/help/feeds)

UNKNOWN: 본문 미리보기 길이, 조회 중복 집계, 본인/익명 조회, 읽음 상태, 댓글 권한과 페이지 권한의 조합, 정렬 변경 시 스크롤 유지.

### 3.5 대시보드

**V-011 Dashboard:** DB 뷰를 위젯으로 묶는 별도 뷰다. 여러 소스를 함께 표시할 수 있다. 편집/보기 모드, 드래그 배치, 너비·행 높이, 위젯 복제·삭제가 있다. 한 행 4개, 전체 12개 위젯 상한이며 Business/Enterprise 대상이다.

**V-012 전역 필터:** 여러 소스에 적용하되 관련 속성이 있는 위젯만 영향을 받는다. 보기 모드의 필터·정렬은 기본적으로 로컬이며 편집 권한과 전체 저장을 통해 공유한다. 위젯의 기반 뷰 변경은 그 뷰를 사용하는 다른 곳에도 영향을 줄 수 있다. 원본 DB 권한을 따른다. [S17 Dashboards](https://www.notion.com/help/dashboards)

UNKNOWN: 서로 이름은 같고 ID·타입은 다른 속성의 전역 필터 매핑, 권한 없는 위젯의 오류·숨김 방식, 13번째 위젯 실패 UI, 모바일 재배치 순서.

### 3.6 폼

**V-013 Form:** 질문은 DB 속성과 연결되고 응답은 DB에서 사용된다. 모든 플랜의 멤버가 생성·사용 가능하다. 기존 DB로부터 생성은 Full access, 편집은 Can edit 또는 Full access가 필요하다. 생성/커스터마이즈는 웹·데스크톱만 지원한다고 안내한다.

**V-014 폼 구성:** 제목·설명·커버·아이콘, 필수 질문, 긴 텍스트, 옵션 표시 방식, 선택 수 제한, 질문/속성 이름 동기화 여부가 있다. 질문 이름 변경은 기본적으로 속성 이름에 반영된다. 조건 분기는 Business/Enterprise에서 지원한다. 응답자 기록과 익명 응답 설정도 있다. [S18 Forms](https://www.notion.com/help/forms)

UNKNOWN: 익명 제출의 파일 제한·재제출·스팸 방어, 숨긴 필수 질문 처리, 관계 선택의 정보 노출, 제출 중 스키마 변경, 기존 응답 수정 링크의 권한.

### 3.7 페이지 레이아웃

**V-015 Layout:** 뷰의 배치와 항목 페이지의 속성 레이아웃은 구분된다. 레이아웃은 DB의 모든 페이지에 적용되고 특정 행/뷰 전용으로 적용할 수 없다. 최소 Can edit가 필요하다. 머리말에 최대 15개 속성을 고정하고, 하나의 속성 그룹을 섹션으로 나누거나 상세 패널/모듈로 배치할 수 있다. 숨긴·접힌 속성도 이름으로 찾을 수 있다. [S19 Layouts](https://www.notion.com/help/layouts)

UNKNOWN: 다중 소스 DB에서 레이아웃 적용 범위, 모바일 편집 범위, 모듈의 중복 배치 제한, 삭제 속성이 배치에 남는지.

## 4. 검색·필터·정렬·그룹

**V-016** 뷰별 속성 노출, 여는 방식(측면/중앙/전체 페이지), 필터·정렬·그룹을 설정한다. 필터는 AND/OR 조합과 최대 3단계 중첩을 지원한다. 정렬에는 우선순위가 있고, 텍스트·숫자·선택 옵션의 정렬 의미가 다르다. 그룹 숨김·수동 순서·빈 그룹 숨김이 존재한다. 검색은 항목 제목과 속성을 대상으로 하며 문서에서는 3개 이상 페이지일 때 표시한다고 설명한다. [S20 Views, filters, sorts & groups](https://www.notion.com/help/views-filters-and-sorts)

**V-017 API 필터:** 속성 타입별 조건 구조와 `and`/`or` 합성은 별도 공개 계약이다. 문자열 포함·시작/끝·빈 값, 수치 비교, 체크박스, 날짜, 선택·다중 선택, 사람·관계, 수식·롤업 결과에 맞는 조건을 구분한다. UI와 API의 중첩 상한·조건명·지원 범위를 같다고 가정하지 않는다. [S21 Filter data source entries](https://developers.notion.com/reference/filter-data-source-entries)

**V-018 API 정렬:** 속성 또는 생성/수정 timestamp를 기준으로 오름/내림차순을 지정한다. 정렬 배열의 순서가 우선순위다. 동일 키의 안정 정렬·수동 순서와의 상호작용은 실측 대상이다. [S22 Sort data source entries](https://developers.notion.com/reference/sort-data-source-entries)

**V-019 Views API:** 현재 공개 API에는 뷰 객체가 있다. 부모는 DB이고 대상 소스·유형·필터·정렬·구성이 분리된다. 대시보드는 단일 대상 소스가 없고 행 배치를 사용한다. 공식 지원 목록은 Table/Board/Calendar/Timeline/Gallery/List/Form/Chart/Map/Dashboard이며 **Feed는 이 목록에 없다**. 이것만으로 Feed API의 모든 경로가 불가능하다고 단정하지 않는다. [S36 View object](https://developers.notion.com/reference/view)

**V-020 뷰 생명주기 API:** 2025-09-03 이상에서 목록·조회·생성·수정·삭제, 링크 DB 생성, 위젯 배치, quick filter, 뷰를 통한 쿼리와 페이지네이션을 문서화한다. DB 생성 시 소스 하나와 기본 Table이 생성된다. 목록은 ID 중심이므로 세부 구성은 개별 조회한다. 링크된 뷰는 원본과 배치 대상 양쪽 접근이 필요하다. 조건 없는 quick filter와 실제 필터 조건을 구별한다. [S37 Working with views](https://developers.notion.com/guides/data-apis/working-with-views)

**V-021 뷰 재사용:** 원본 소스에서 기존 뷰 설정을 가져오는 흐름, 탭 이동, 개인 필터 변경 후 전체 저장 흐름이 설명되어 있다. “설정 복사”와 “동일 뷰 객체 참조”를 혼동하지 않도록 UI 생성 경로별 ID 비교가 필요하다. [S38 Databases reimagined](https://www.notion.com/help/guides/databases-reimagined-whats-changed)

필수 검사 축(**TEST 설계**):

| 조건 축 | 데이터 예시 | 확인할 관측값 |
|---|---|---|
| 빈 값/0/false | 숫자 공란, 0, -1; 체크박스 false | UI 빈 값 필터와 formula empty가 같은 의미인지 |
| 문자열 | `가`, `각`, `A`, `a`, 이모지, 앞뒤 공백 | 대소문자·정규화·locale 정렬 |
| 다중 값 | `[red, blue]`, `[blue]`, `[]` | contains의 단일/전체 의미, 여러 그룹 중복 표시 |
| 날짜 | 종일·시각·기간, UTC/KST 자정 | 상대 날짜와 기간 포함 규칙 |
| 결과 값 | 빈 롤업, 리스트 수식, 수식 오류 | 필터 타입 변경과 오류 행 포함 여부 |
| 개인/공유 | 두 사용자, 동일 뷰 | 로컬 설정의 새로고침·기기 간 유지와 전체 저장 |
| 필터된 생성 | 상태=진행 AND 담당자=나 | 새 항목 기본값 주입 여부와 OR의 모호성 |

## 5. 관계와 롤업

**D-014 Relation:** 다른 DB 연결은 기본 단방향이며 대응 속성을 켜면 양방향 갱신된다. 값은 페이지 참조이며 하나/무제한 제한을 선택한다. 관계 필드에 상대 페이지의 추가 속성을 표시할 수 있다. 자기 관계에서 한 속성만 사용해도 역방향이 나타날 수 있어 일반 단방향과 구분해야 한다.

**D-015 Rollup:** 관계·상대 속성·집계 함수를 설정한다. 원본/고유 값 표시, 개수·빈 값·비율, 수치 통계, 날짜 집계가 존재한다. 숫자 결과일 때 정렬 가능하다고 안내한다. [S23 Relations & rollups](https://www.notion.com/help/relations-and-rollups)

UNKNOWN: 연결 대상 삭제·이동·권한 회수, 자기 자신 연결, 순환 그래프, 양쪽 cardinality 제한 충돌, 롤업 중첩 가능 범위, 역방향 생성 실패의 원자성.

| TEST ID | 절차 | 기대와 불확실성 |
|---|---|---|
| T-D14 | A/B에 양방향 관계 생성→A1에서 B1 연결→B1에서 제거 | DOC 기대: 양쪽 반영. 지연·충돌 순서는 UNKNOWN |
| T-D15 | 자기 관계 하나 생성→A1에서 A2 연결 | DOC 기대: 역방향이 나타날 수 있음. 설정별 정확한 조건을 캡처 |
| T-D16 | 관계를 1개로 제한→다른 대상을 추가 | DOC 기대: 1개 제한. 이전 값 교체/차단 UI는 UNKNOWN |
| T-D17 | 연결 행 값 `[2, 6, 공란]`에서 sum/평균/빈 값 수 계산 | DOC 기반 예상: 8/4/1. 빈 값의 통계 분모를 실측 확인 |
| T-D18 | 열람자에게 B 권한을 제거→A의 관계/수식/롤업 조회 | UNKNOWN: 마스킹·오류·이전 결과 잔존. 정보 노출 여부 기록 |

## 6. 수식 언어

### 6.1 타입·평가 모델

**F-001** Formula 2.0은 문자열만이 아니라 날짜·수·논리값·사람·페이지 및 리스트를 다룬다. 관계를 통해 상대 속성에 직접 접근할 수 있고, 리스트 연산으로 가공한다. 에디터에는 여러 줄 작성과 타입을 고려한 작성 지원이 있다. [S24 Formula 2.0 guide](https://www.notion.com/help/guides/new-formulas-whats-changed)

**F-002** 수식 속성은 입력 속성으로부터 결과를 계산한다. 일반 속성과 수식의 타입 체계는 동일하지 않다. 작성·수정·오류 수정의 사용자 흐름과 AI 작성 보조가 별도 존재한다. [S25 Intro to formulas](https://www.notion.com/help/formulas)

### 6.2 함수군 인벤토리

**F-003~F-009는 이름 인덱스다. 인수·오류·반환형까지 검증한 언어 규격서는 아니다.**

| ID | 기능군 | 함수/구문 |
|---|---|---|
| F-003 | 분기·바인딩 | if, ifs, let, lets, empty, equal, unequal; 논리·비교·삼항 연산 |
| F-004 | 텍스트·표현 | length, substring, contains, test, match, replace, replaceAll, lower, upper, trim, repeat, link, style, unstyle, format, formatNumber |
| F-005 | 수치 | add, subtract, multiply, divide, mod, pow, min, max, sum, median, mean, abs, round, ceil, floor, sqrt, cbrt, exp, ln, log10, log2, sign, pi, e, toNumber |
| F-006 | 날짜 | now, today, minute, hour, day, date, week, month, year, dateAdd, dateSubtract, dateBetween, dateRange, dateStart, dateEnd, timestamp, fromTimestamp, formatDate, parseDate |
| F-007 | 리스트 | at, first, last, slice, concat, sort, reverse, join, split, unique, includes, find, findIndex, filter, some, every, map, flat |
| F-008 | 객체·속성 | prop, name, email, id; 관계의 페이지 리스트와 사람 리스트 |
| F-009 | 문맥 | current, index; 함수형/메서드형 호출 |

`empty`의 0 처리, `fromTimestamp` 정밀도, `formatNumber` 옵션을 검증 대상으로 구분한다. [S26 Formula syntax & functions](https://www.notion.com/help/formula-syntax)

### 6.3 오류 분류

**F-010** 공식 오류 안내는 참조 권한, 기대 반환형 불일치, 깊이 상한, 자동화 변수 참조, 리스트의 객체 접근, undefined, 구문 오류를 구분한다. Formula/Rollup 참조는 다른 DB를 거쳐도 깊이에 포함되며 최대 15단계다. 자동화에서는 빈 날짜/사람 접근으로 오류·일시정지가 가능하다. 같은 자동화 액션 안의 변수끼리 참조할 수 없고, 자동화의 필터에 변수 사용 제한도 있다. 이 규칙을 일반 `let/lets`와 혼동하면 안 된다. [S27 Common formula errors](https://www.notion.com/help/common-formula-errors)

### 6.4 수식 검증 설계

다음 표현은 **합성 시험 입력**이며 실행 결과가 아니다. 공식 함수 의미에서 유도한 예상과 미정 동작을 구분한다.

| TEST ID | 시험 | 기대 또는 질문 |
|---|---|---|
| T-F01 | `[4, 8].map(current * 3)` | DOC 의미 기반 예상 `[12,24]`; 숫자 리스트 결과 보존 |
| T-F02 | 관계 3행에 비용 2/4/6→관계.map(비용).sum | DOC 의미 기반 예상 12; 관계 순서·빈 값 추가 검사 |
| T-F03 | 빈 Person에서 first().email 접근 | 자동화 오류 가능은 DOC. 수식 속성 셀 표현은 UNKNOWN |
| T-F04 | `empty(0)`와 공란 숫자 비교 | DOC 기대: 0은 true. 공란·0의 저장 차이는 별도 조사 |
| T-F05 | 중첩 map에서 안/밖 current와 index 사용 | UNKNOWN: 변수 shadowing과 외부 변수 캡처 |
| T-F06 | 15/16개 참조 체인 생성 | DOC 기대: 깊이 초과 오류. 경계 카운트의 시작점 캡처 |
| T-F07 | 윤년 2월 말에 한 달 더하기, DST 하루 추가 | UNKNOWN: 월말 보정·현지 시간/경과시간 규칙 |
| T-F08 | 0 나눗셈, 음수 sqrt, 매우 큰 정수 | UNKNOWN: 오류·Infinity·빈 값·정밀도 손실 |
| T-F09 | 이모지·결합문자 length/substring | UNKNOWN: UTF-16/코드포인트/문자소 단위 |
| T-F10 | 정규식 lookbehind·유니코드·잘못된 패턴 | UNKNOWN: 엔진·플래그·타임아웃 |
| T-F11 | 동일 페이지를 포함한 두 관계 concat→unique | UNKNOWN: 객체 동일성 기준과 순서 안정성 |
| T-F12 | 의존 속성 이름 변경→삭제→복원 | UNKNOWN: ID 참조 유지·오류 복구 |
| T-F13 | now() 페이지를 열린 채 유지 | UNKNOWN: 재계산 주기·백그라운드 갱신 |
| T-F14 | UI 계산과 API property-item 결과 비교 | DOC: API 제한 가능. 값·타입·누락을 함께 대조 |

수식의 모든 연산자 우선순위, coercion, null 대수, 순환 참조, 비동기 재계산, 캐시 무효화, locale, 계산량 제한은 아직 **언어 규격 미확정**이다.

## 7. 템플릿·반복·프로젝트 기능

**D-016 DB 템플릿:** 속성 기본값과 본문·하위 페이지·임베드를 포함한다. 생성 후 페이지는 개별 편집 가능하며 템플릿은 해당 DB 범위다. 관계 값을 템플릿에 고정하면 생성 페이지들이 같은 기존 대상을 참조한다.

**D-017 반복 템플릿:** 일/주/월/년 반복과 시작일·시각·간격을 지정한다. 반복 템플릿의 중첩은 3단계까지이며 매일 반복 템플릿 안에는 중첩할 수 없다고 안내한다. [S28 Database templates](https://www.notion.com/help/database-templates)

**D-018 하위 항목:** Table/List/Timeline은 접힌 트리 또는 평탄화, Board/Calendar/Gallery는 카드 속성 또는 평탄화로 표현한다. 부모/자식 필터 적용 옵션은 뷰마다 다르다. 부모 복제·삭제는 자식도 포함한다. 대상 DB에서 하위 항목을 활성화할 권한이 없으면 이동한 자식이 최상위 항목이 될 수 있고, 편집 권한 없는 자식은 이동되지 않는다.

**D-019 의존성:** 날짜 겹침 때만 이동, 간격을 유지하며 이동, 자동 이동 없음의 정책과 주말 회피 옵션이 있다. [S29 Sub-items & dependencies](https://www.notion.com/help/tasks-and-dependencies)

**D-020 Task DB:** 상태·담당자·마감일 속성을 작업 의미에 매핑하고 My tasks에 모은다. 일반 DB로 되돌릴 수 있다.

**D-021 ID:** 접두사와 자동 번호를 가진다. 삭제 페이지에도 번호가 할당되어 있고 번호가 바뀌지 않는다. 접두사가 있는 ID는 짧은 URL을 지원한다.

**D-022 Sprint:** 작업 DB에서 활성화하며 현재·계획·백로그 뷰와 스프린트 DB가 만들어진다. 종료 시 미완료 항목의 다음 스프린트/백로그/현재 잔류를 고른다. Current/Last/Past/Next 전환과 자동 완료 흐름이 존재한다. [S30 Task databases & sprints](https://www.notion.com/help/sprints)

**D-026 Projects & Tasks:** 공식 가이드는 단순 To-do, Projects & Tasks, Projects/Tasks/Sprints 템플릿을 구분한다. 프로젝트와 작업은 관계로 연결되며 완료 작업 비율을 진행률로 표시한다. Mine 뷰의 `Me`는 현재 로그인 사용자에 따라 달라진다. “작업당 프로젝트 하나”는 이 템플릿의 사용 모델이며 모든 Relation의 보편적 제약이 아니다. [S39 Getting started with projects and tasks](https://www.notion.com/help/guides/getting-started-with-projects-and-tasks)

**D-027 설정 적용 범위:** 잠금·속성 편집·자동화·하위 항목·의존성·스프린트·앱 연결·페이지 레이아웃·Task DB 변환은 데이터베이스 설정이다. 뷰별 설정과 구별하며 Can edit 이상이 필요하다. [S40 Database settings](https://www.notion.com/help/customize-your-database)

**P-032 ID 접두사:** 기본 접두사는 팀스페이스와 DB 이름에서 만들어지고 사용자가 바꿀 수 있다. 번호는 자동 할당되는 식별 값이다. 접두사 중복·이름 변경·DB 복제·워크스페이스 이동 때 짧은 URL의 충돌 해소는 미확인이다. [S41 Unique ID](https://www.notion.com/help/unique-id)

| TEST ID | 절차 | 기대 또는 질문 |
|---|---|---|
| T-D20 | 관계 기본값이 있는 템플릿으로 2페이지 생성 | DOC 기대: 동일 기존 대상 참조 |
| T-D21 | 월말·윤년·DST에 반복 일정 지정 | UNKNOWN: 누락일 보정, 시간대 변경, 중복 방지 |
| T-D22 | 부모와 자식의 담당자/상태를 다르게 지정→뷰별 필터 | DOC 옵션별 출력 대조. 숨겨진 부모 아래 자식의 표현 캡처 |
| T-D23 | 부모 복제·삭제·복원 | DOC: 복제/삭제에 자식 포함. 복원까지의 원자성 UNKNOWN |
| T-D24 | A→B→C 의존성에 A 일정 +7일 | 문서의 간격 유지 정책에서 유도한 가설은 연쇄 이동. 3단계 전파·다중 선행자·순환은 UNKNOWN |
| T-D25 | 스프린트 종료와 동시에 다른 사용자가 미완료 작업 이동 | UNKNOWN: 이중 할당·충돌·자동 종료 idempotency |

## 8. 버튼·자동화와의 경계

**P-030 DB Button:** 속성형 버튼에는 액션을 설정하고 클릭으로 실행하는 별도 흐름이 있다. 데이터 셀 값 변경과 버튼 실행을 동일시할 수 없다. 버튼별 권한·확인 단계·다중 액션·수식 문맥은 자동화 분야 보고서와 함께 검토해야 한다. [S31 Database buttons](https://www.notion.com/help/database-buttons)

UNKNOWN: 두 번 클릭 시 중복 실행, 중간 액션 실패 후 롤백, 호출자의 권한과 설정자의 권한 중 무엇으로 실행하는지, 재시도·감사 이벤트. 공개 API에서 버튼 액션을 추출/실행할 수 없다는 제한은 P-027에 기록했다.

## 9. 내보내기·가져오기·성능

**D-023 Export:** DB 내보내기는 현재 뷰 또는 기본 뷰를 고르며 모든 뷰 일괄 내보내기는 지원하지 않는다. Form 뷰 직접 내보내기 대신 Table에서 질문/응답을 내보내도록 안내한다. 게스트는 Full access가 필요하며 Enterprise의 내보내기 차단 설정이 영향을 준다. [S32 Export your content](https://www.notion.com/help/export-your-content)

**D-024 CSV import:** 행→페이지, 열→속성 매핑. 새 DB 또는 기존 DB에 추가하며 기존 행을 업데이트하지 않는다. 새 수식·롤업·관계를 CSV로 생성할 수 없다. 기존 DB에 병합할 때 기존 관계 속성으로 매핑하는 것은 문서상 가능하다. Free 5MB, 유료 50MB 파일 제한이 명시된다. [S33 Import data](https://www.notion.com/help/import-data-into-notion)

따라서 “CSV 왕복=기능 복원”이라는 결론은 성립하지 않는다. 뷰·수식 정의·양방향 관계·자동화·레이아웃·권한·파일 링크·페이지 본문·템플릿의 각 보존 여부를 별도 비교해야 한다. 이것은 여러 출처를 종합한 **분석 추론**이며 내부 백업 형식을 확인했다는 뜻은 아니다.

**D-025 Performance:** 행 수·노출 속성 수·복잡한 필터/정렬·Formula/Rollup 참조 체인이 지연 원인으로 문서화되어 있다. 한 화면의 여러 인라인 DB보다 단일 링크 DB에서 한 뷰만 여는 구성이 업데이트 구독 부담을 줄일 수 있다고 안내한다. [S34 Optimize database performance](https://www.notion.com/help/optimize-database-load-times-and-performance)

| TEST ID | 절차 | 기대 또는 질문 |
|---|---|---|
| T-D30 | 2개 뷰·관계·수식·본문을 가진 DB를 CSV 왕복 | DOC 기대: 정의 일부 재구축 필요. 어느 항목이 누락되는지 diff |
| T-D31 | 같은 CSV를 두 번 병합 | DOC 기대: 기존 행 갱신이 아닌 추가; 중복 식별 |
| T-D32 | 30개 관계가 있는 페이지를 일반 조회/속성 조회로 비교 | DOC 기대: 단일 페이지 응답만으로 전체 관계를 보장 못함 |
| T-D33 | 500개 속성 이후 추가 시도 | DOC 기대: 추가 거절. title 포함 여부·다중 소스 단위 확인 |
| T-D34 | 1천/1만/10만 합성 행과 3단/10단 수식 체인 | UNKNOWN: 로딩·입력 p95, 갱신 지연, 오류율. 허용된 테스트 환경에서만 실행 |
| T-D35 | API 배열에 기존 관계 3개 중 1개만 보내기 | DOC 기대: 1개로 교체. 데이터 보존 경고 UX 별도 확인 |

## 10. 기능군별 재현 검증 패키지

이 절은 아직 수행하지 않은 시험 계획이다. 테스트 데이터는 합성 데이터만 사용한다.

| TEST ID | 준비·조작 | DOC 기대 | UNKNOWN 관측 항목 |
|---|---|---|---|
| T-D01 | DB A에 소스 X/Y, DB B에 X 링크→B에서 행 편집 | 원본 데이터 반영 | 전파 지연·두 탭 충돌 |
| T-D02 | B에서 X 연결 제거→A 확인 | 링크 제거와 원본 삭제는 구별 | 마지막 링크·원본 휴지통 UI |
| T-D03 | Viewer/Content editor/Editor로 소스 이동 시도 | 원본 권한 존중 | 문서상 Can edit/Full access 상충 해소 |
| T-P01 | 일반 23종의 편집 가능 값 입력, 자동·계산·버튼 속성은 생성/수정/실행으로 유도→재접속 | 속성별 편집/계산 계약 구별 | validation·서식 round-trip |
| T-P02 | Person에 개인과 그룹 혼합→수식/API 조회 | 사람/그룹 지원 | 그룹 펼침·퇴사자·멤버 변경 반영 |
| T-P03 | 속성 댓글 후 값 제거·타입 변경 | 특정 타입 댓글 제한 | 댓글 잔존·복원·알림 대상 |
| T-V01 | 같은 소스에 11개 뷰 종류 생성 | 해당 뷰별 데이터 표현 | 구독·모바일·정렬 충돌 |
| T-V02 | Board 카드 이동→Table에서 속성 비교 | 그룹 기반 보드 | 다중 값 수정 의미 |
| T-V03 | Calendar 날짜 드래그→기간 항목 리사이즈 | 날짜 기반 이동 | 시간·기간 길이 보존 |
| T-V04 | Chart 201그룹/51하위그룹 입력 | 표시 상한 | 생략·기타 그룹·정렬 선정 |
| T-V05 | Map 101개, 동일 좌표·빈 Place 포함 | 동시 100개 상한 | 겹침·페이지네이션 |
| T-V06 | Feed에서 댓글·조회 후 타 사용자 확인 | 댓글·조회 추적 | 집계 중복·익명 권한 |
| T-V07 | Dashboard 12개→13개, 공통/비공통 속성 전역 필터 | 위젯 상한·관련 속성만 필터 | 다른 타입 동명 속성 충돌 |
| T-V08 | Form 질문 이름 수정→sync off→다시 수정 | 동기화 설정에 따른 이름 반영 | 질문 삭제의 스키마 영향 |
| T-V09 | 익명/멤버 폼의 필수·조건부 분기 제출 | 필수 입력·분기 설정 | 숨긴 필수 값·권한 없는 관계 |
| T-V10 | Layout 15개 고정→16번째→다른 뷰로 열기 | 최대 15, DB 페이지에 공통 적용 | 다중 소스 범위·모바일 |
| T-V11 | UI 뷰 생성→API 목록/상세 조회→필터 변경→UI 재확인 | 공개 API 뷰 계약에 따른 갱신 | 미지원 설정 손실·Feed 타입·재계산 |
| T-P04 | Select 옵션 `[A,B]` 중 A만 스키마 업데이트 | DOC 기대: B 옵션 제거 | 기존 B 행의 결과, 복원 가능성 |
| T-P05 | UI Text→Place와 API 동일 전환 비교 | 문서상 UI/API 지원 차이 | UI와 API 오류의 정확한 경계 |

각 실행은 플랜, 역할, 플랫폼/앱 버전, 언어·시간대, 시작 상태, 조작 순서, 화면/네트워크의 비밀 제거 증거, 실제 결과, 문서 기대와 차이, 재현 횟수를 함께 남겨야 한다.

## 11. 출처·커버리지

아래는 이 보고서에서 읽은 공식 출처 목록이다. 문서별 링크는 본문 주장에 붙여 두었다. 수집 경로는 공개 Help Center와 Developer Docs이며 인증 데이터는 사용하지 않았다.

| Source | 대상 | 커버리지 |
|---|---|---|
| S01 | Intro to databases | 페이지/DB·인라인·복제·content 편집·잠금 |
| S02 | Data sources | 원본/링크·이동·권한·다중 소스 |
| S03 | API migration 2025-09-03 | 컨테이너/소스 식별·관계·검색·웹훅 |
| S04 | Database properties | 공개 타입·색상·댓글·상한 |
| S05 | Data source properties | 스키마·title 불변·Place·Button |
| S06 | Page property values | 값·배열 교체·pagination·unsupported |
| S07 | Update a data source | 스키마 변경 API 경계 |
| S08–S13 | Table/Board/Timeline/Calendar/List/Gallery | 기본 뷰 6종 |
| S14 | Charts | 차트 5종·플랜·표시 상한 |
| S15 | Maps | Place 입력·지오코딩·지도 |
| S16 | Feeds | 카드 피드·댓글·조회 |
| S17 | Dashboards | 위젯·전역 필터·공유·권한 |
| S18 | Forms | 입력·속성 매핑·조건 분기 |
| S19 | Layouts | 항목 페이지 속성 배치 |
| S20 | Views, filters, sorts & groups | 뷰 공통 조작 |
| S21–S22 | API filter/sort | 쿼리 계약 |
| S23 | Relations & rollups | 관계·자기 관계·집계 |
| S24–S27 | Formula guide/intro/syntax/errors | 타입·언어·오류 |
| S28 | Database templates | 템플릿·반복·중첩 |
| S29 | Tasks and dependencies | 하위 항목·일정 연동 |
| S30 | Sprints | 작업 DB·ID·스프린트 |
| S31 | Database buttons | 액션형 속성 |
| S32–S33 | Export/import | 이동성·CSV 제약 |
| S34 | Performance | 성능 요인과 공개 상한 |
| S35 | Update data source properties | 옵션 전체 교체·ID 유지·Place API 제한 |
| S36–S37 | View/Working with views | 뷰 API 객체·생명주기·쿼리 |
| S38 | Databases reimagined | 뷰 설정 재사용·개인 변경 |
| S39 | Projects and tasks guide | 프로젝트 템플릿·동적 Me |
| S40 | Database settings | DB 전체 설정 범위 |
| S41 | Unique ID | 접두사 생성·짧은 URL |
| S42 | Wikis & verified pages | 일반 DB의 조건부 Verification/Owner |

루트의 `source-catalog.json`에 있는 databases/database-views 카테고리의 **일반 Help 문서 25개 URL은 모두 열어 관련 설명을 읽고 본문 출처와 대조**했다. 각 문서의 모든 절·예시를 동작 명세로 추출한 것은 아니다. Guides는 기능 설명이 추가되는 대표 문서를 선별했으며 모든 직무별 활용 가이드의 모든 예시를 별도 검증하지는 않았다.

## 12. 분석 완료로 간주할 수 없는 부분

1. **로그인 런타임 관찰 0건:** 문서의 문구와 실제 UI·네트워크·권한 동작의 대조가 남아 있다.
2. **속성 변환 매트릭스 미확정:** 타입 간 변환·되돌리기·동시 편집·자동화 영향을 검증하지 않았다.
3. **수식 언어 호환성 미확정:** 함수군은 분류했지만 전체 함수별 오류/경계/타입 시그니처 및 평가기 구현 규격은 완성하지 않았다.
4. **권한 상충:** 소스 이동 권한은 동일 문서 안의 상충을 직접 확인해야 한다.
5. **공개 API와 UI 차이:** UI에서 가능하다고 API로 설정·추출 가능한 것은 아니다. 버전별 기능 노출이 다를 수 있다.
6. **플랜·플랫폼 차이:** 명시적으로 확인된 제한 외에는 무료/유료 동일성을 주장하지 않는다.
7. **성능·복구·일관성 미측정:** 데이터 최대치, 동시성, 오프라인 복구, 재계산 지연, 장애 복원 보장은 알 수 없다.
8. **특수 DB 교차 기능:** Wiki 검증·소유권, AI autofill, 자동화/외부 sync, 권한 규칙은 각각 관련 분야 보고서와 결합해야 한다.

현 상태는 **42개 공식 출처를 기반으로 데이터베이스 기능군·명세 후보·미확인 경계를 정리한 문서 조사**다. 전체 제품의 동등성 분석 완료 또는 재구현 가능성 검증 완료라는 결론을 내리지 않는다.
