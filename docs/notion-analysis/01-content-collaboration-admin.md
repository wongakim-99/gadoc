---
type: research
project: Slacord
project_slug: slacord
status: in_progress
date: 2026-10-20
evidence_level: DOC
runtime_tests_executed: 0
tags: [notion, research, rea]
---

# Notion 전체 기능 조사 — 콘텐츠·협업·관리

이 문서는 **공식 도움말에서 확인한 제품 동작과 실행 검증 설계**다. 로그인된 노션을 직접 조작한 관찰 결과, 패킷 분석, 내부 구현 복원 결과가 아니다. 확인한 기능 동작은 DOC, 발견만 한 세부 항목은 DISC, C-14는 접근성 탐색 시험 영역으로 구분하며 실제 재현은 0건이다. 아래 테스트의 ‘기대’는 문서 기반 기대 결과이고 통과 결과가 아니다. Slacord 통합 방식·구현 선택은 포함하지 않는다.

조사 기준일은 2026-10-20이다. 공식 문서가 제품 버전·배포 일자를 제공하지 않으면 버전은 **미확인**으로 취급한다. 명시한 요금제 이외의 세부 제공 조건도 미확인이다. 베타·플랫폼별 차이·번역본 차이는 런타임 검증 대상이다. 관계 설명은 사용자에게 보이는 개념 관계이며 실제 DB 스키마라는 뜻이 아니다.

## 공통 재현 환경과 증거 규칙

합성 데이터만 사용한다. `REA-Content-Lab` 아래 부모 P, 하위 Q, 참조 R, DB D(행 60개)를 만들고, O(소유자), E(편집자), C(댓글), V(보기), G(게스트), N(접근 없음)의 테스트 계정을 구분한다. Enterprise 관리 기능은 별도 테스트 조직과 IdP가 필요하다. 웹 Chromium/Firefox, Windows 앱, 모바일 앱을 구분하고 각 실행에 버전·요금제·역할·시간대·locale을 기록한다.

각 테스트는 전 상태 → 조작 → 후 상태 → 새로고침/재로그인 결과 → 두 번째 계정 결과를 캡처한다. URL·대상 페이지 ID·기능 ID·증거 파일명을 연결하되 인증 정보는 기록하지 않는다. 관리자 정책·삭제·공개 발행 테스트는 분석 전용 데이터에서 수행한다. 이 문서의 테스트는 아직 실행하지 않았다.

## C — 페이지·블록·편집

### C-01 블록 생성·선택·변환·이동

- **DOC:** `/`, 새 줄의 추가 버튼, 블록 핸들이 생성·변환·복제·이동·삭제 진입점이다. 블록 안의 텍스트 선택과 블록 전체 선택이 다르며 여러 블록 이동도 가능하다. 블록 링크는 특정 위치를 참조한다.
- **관계:** 페이지에는 순서 있는 블록이 있고 중첩 콘텐츠를 포함할 수 있다. 구조 이동과 텍스트 편집을 구분해야 동작을 기술할 수 있다.
- **미확인:** 모든 블록 유형 간 변환 표, 변환 중 자식 유지, Undo 단위, IME 조합·붙여넣기 정규화.
- **실행:** P에 문단·체크박스·목록·토글·하위 페이지를 만든다 → 목록을 체크박스로 변환 → 자식을 들여쓰기 → 두 블록을 Q로 이동 → Undo. **기대:** 지정 위치·유형 변경과 내용 보존을 확인하되 변환 손실 여부는 관찰로 확정한다. Firefox의 블록 간 부분 텍스트 선택은 문서상 미지원 예외다.
- 근거: [Writing and editing](https://www.notion.com/help/writing-and-editing-basics).

### C-02 기본 블록 종류와 인라인 서식

- **DOC:** 본문, H1/H2/H3, 불릿·번호·할 일 목록, 토글, 인용, 콜아웃, 구분선, 페이지 등은 각기 다른 콘텐츠 단위다. 인라인에는 굵게·기울임·취소선·코드·색상·링크·멘션이 있고 Markdown 입력 단축 변환을 제공한다.
- **관계:** 문자열 서식과 블록 유형은 다른 축이다. 페이지 메뉴의 글꼴(Default/Serif/Mono), 작은 글씨, 전체 폭은 페이지 표시 설정이다.
- **실행:** 같은 문장을 각 블록으로 생성하고 일부만 서식 적용 → 중첩된 텍스트 복사 → 새 페이지에 붙여넣기 → Markdown 내보내기. **기대:** UI에서 서식이 반영된다. 왕복 보존은 미확인으로 비교 기록한다.
- **미확인:** 폰트별 한글 폴백, 접근성 이름, 모바일 서식 메뉴의 완전 동등성.
- 근거: [Style and customize](https://www.notion.com/help/customize-and-style-your-content), [기본 편집](https://www.notion.com/help/writing-and-editing-basics).

### C-03 다단·제목·목차·일반 표

- **DOC:** 블록을 가로로 드래그해 다단을 만들고 폭을 조절한다. 휴대폰에서는 열이 세로로 배열된다. 목차는 제목을 따라 생성되며 들여쓴 제목은 제외된다. 일반 표는 행/열·헤더·셀 색상·병합·분할과 DB 변환을 지원한다. 병합 시 좌상단 콘텐츠를 유지하고 나머지는 지워지며 분할로 돌아오는 셀은 빈 셀이다.
- **실행:** 2열과 H1/H2를 만들고 목차 삽입 → H2 들여쓰기 → 2×2 셀 각각 다른 값을 넣고 병합/분할 → 모바일 확인. **기대:** 목차 제외와 셀 손실 규칙 확인. 표 여러 셀 동시 붙여넣기는 문서상 제한이다.
- **미확인:** 태블릿 열 지원은 같은 문서 본문/FAQ 표현이 달라 실측 필요. 병합 표의 DB 변환 매핑도 미확인.
- 근거: [Format your page](https://www.notion.com/help/columns-headings-and-dividers).

### C-04 이미지·파일·오디오·비디오·임베드

- **DOC:** 파일 업로드와 외부 URL 임베드는 별도 입력 경로다. 이미지 크기·배치 조절 및 하이퍼링크를 지원한다. 이미지를 노션 페이지에 연결해도 백링크는 생성하지 않는다. DB Files & media와 본문 미디어 블록은 서로 다른 위치다.
- **제한:** 도움말은 Free 업로드 5MB 미만, 유료의 표시용 PDF 20MB 미만·PNG/JPG 5MB 미만을 명시한다. 이를 모든 유료 파일의 저장 한도라고 일반화하지 않는다.
- **실행:** 합성 PNG/PDF/MP4를 업로드하고 동일 파일 외부 URL 삽입 → 캡션·링크·크기 변경 → V/G로 보기 → 외부 호스트 중단. **기대:** 지원 파일이 표시되고 외부 의존 실패가 업로드 파일과 구분된다. 경계 크기·만료 URL·코덱 오류는 관찰 항목이다.
- 근거: [Images, files and media](https://www.notion.com/help/images-files-and-media).

### C-05 코드 블록

- **DOC:** 언어 선택에 따른 구문 강조, 줄바꿈 표시, 복사, 캡션을 제공한다. 코드 실행 환경이라는 근거는 없다.
- **실행:** JavaScript 문자열에 탭·한글·긴 줄을 넣는다 → 언어 변경 → Wrap 전환 → Copy 후 원문 바이트 비교. **기대:** 표시 방식은 바뀌고 복사 원문은 유지되는지 확인한다. V의 메뉴 차이도 기록한다.
- **미확인:** 모든 지원 언어 목록, Mermaid 렌더러 버전, 최대 길이, 줄 번호·테마의 제공 조건.
- 근거: [Code blocks](https://www.notion.com/help/code-blocks).

### C-06 수학식

- **DOC:** KaTeX 기반 인라인/블록 수식이며 LaTeX 전체 지원과 같지 않다. 인라인 수식 복사는 소스 형태다. 화학 표기 매크로도 문서에 있다.
- **실행:** `x^2`, 분수, 행렬을 인라인과 블록으로 생성 → 키보드로 수식에 진입 → 수정 → 외부 텍스트 편집기에 복사. **기대:** 렌더링과 원문 복사 확인. 미지원 문법은 오류 형태를 기록한다.
- **미확인:** 사용 중인 KaTeX 버전과 허용 옵션, 비정상 입력의 최대 길이.
- 근거: [Math equations](https://www.notion.com/help/math-equations).

### C-07 페이지 링크·블록 링크·백링크

- **DOC:** `@`, `[[`, `+`로 페이지를 인라인 참조할 수 있고 Link to page 블록은 사이드바에도 나타난다. 블록마다 앵커 링크가 있다. 일반 외부 URL은 링크 멘션 형태로 붙여넣을 수 있다.
- **관계:** 페이지의 실제 부모 관계, 링크 블록이 만드는 탐색 경로, 인라인 참조를 혼동하지 않는다.
- **실행:** P→Q 멘션과 링크 블록을 각각 추가 → Q 이름 변경/이동 → Q에서 백링크 확인 → N에게 링크 전달. **기대:** 허용된 계정의 이동·참조가 동작하고 링크 자체가 접근 권한을 부여하지 않는지 검증한다.
- **미확인:** 삭제·복원·워크스페이스 간 이동 시 참조 유지, 권한 없는 백링크의 제목 노출.
- 근거: [Links and backlinks](https://www.notion.com/help/create-links-and-backlinks).

### C-08 동기화 블록

- **DOC:** 한 원본을 여러 페이지/워크스페이스에서 사용하며 어느 인스턴스에서 편집해도 반영된다. 원본 페이지 보기/편집 권한이 필요하다. Unsync는 독립 콘텐츠로 분리한다. 복사본이 10개를 초과하면 원본 삭제/Unsync all이 모든 복사본을 제거할 수 있고 Undo로 전부 복원되지 않는다.
- **실행:** P 원본을 Q/R에 동기화 → Q에서 수정 → G에게 Q만 공유 → Q Unsync 후 편집. **기대:** P/R 동기화, 원본 권한 없는 G의 제한, 분리 후 독립 편집. 11개 복사본 삭제는 별도 폐기용 페이지에서 수행한다.
- **미확인:** 원본 페이지 이동·권한 회수 시 반영 지연, 재접속 충돌.
- 근거: [Synced blocks](https://www.notion.com/help/synced-blocks).

### C-09 이동·복제·워크스페이스 간 복사

- **DOC:** 워크스페이스 간 이동 경로는 실제로 목적지에 복제하고 원본을 남긴다. 관계·링크·권한·이력 일부가 깨질 수 있다. 문서상 복제 제한은 시간당 50,000블록이다.
- **실행:** 부모/자식·관계형 DB·동기화 블록이 있는 합성 묶음을 다른 테스트 워크스페이스로 이동한다. **기대:** 원본 잔존과 복사본 생성. 두 쪽의 링크·행 참조·권한·이력을 개별 비교한다.
- **미확인:** 각 객체의 ID 재발급 규칙, 부분 실패의 재시도와 중복 생성 방식, 동일 워크스페이스 이동과의 차이.
- 근거: [Move and duplicate content](https://www.notion.com/help/transfer-content-to-another-account).

### C-10 삭제·휴지통·페이지 이력

- **DOC:** 삭제된 페이지는 기본 30일간 Trash에 있고 이후 별도 보존 단계가 있다. Enterprise는 기간 조정 가능하다. 블록 삭제, 페이지 삭제, 과거 버전 복원은 서로 다른 작업이다.
- **실행:** P에서 3회 편집하고 각 시각 기록 → Q 삭제 → Trash의 검색·필터·복원 → P의 버전 메뉴에서 이전 내용을 복원. **기대:** 복원된 본문·부모 위치를 확인한다. 이력 메뉴의 실제 보존 기간과 복원 권한을 요금제별로 캡처한다.
- **미확인:** 현재 각 요금제별 이력 일수, 자동 스냅샷 주기, 댓글·속성·자식이 같은 시점으로 복원되는지. 문서 일부만으로 완전한 트랜잭션 복원을 가정하지 않는다.
- 근거: [Delete and restore content](https://www.notion.com/help/duplicate-delete-and-restore-content).

### C-11 아카이브

- **DOC:** Business/Enterprise beta. 삭제와 달리 접근·기존 링크를 유지한다. 부모 아카이브는 하위 페이지에 적용되고 DB 뷰와 기본 검색에서 숨겨진다. 편집 권한이 있으면 아카이브/해제가 가능하다.
- **실행:** P/Q와 D의 행을 아카이브 → 기존 URL 열기 → 기본 검색/Content status 검색 → DB View archived pages → 해제. **기대:** 배너·아이콘과 노출 필터가 달라지고 링크는 유효하다.
- **미확인:** 부모 해제 시 원래 개별 아카이브 상태 복원, 자동화·AI 검색·알림과의 상호작용.
- 근거: [Archive pages](https://www.notion.com/help/archive-pages).

### C-12 프레젠테이션 모드

- **DOC:** Plus/Business/Enterprise beta. 페이지 제목·아이콘이 제목 슬라이드가 되고 구분선 사이 콘텐츠가 슬라이드로 바뀐다.
- **실행:** 제목과 구분선 2개, 긴 표·이미지·토글을 포함한 P에서 Present 실행 → 앞/뒤 이동 → 편집 화면 복귀. **기대:** 구분선 기반 분할을 확인한다. 긴 콘텐츠 overflow와 비지원 블록은 미확인이다.
- **미확인:** 발표자 노트·공유/외부 화면·키보드 탐색·PDF 출력 동등성, 모바일 지원.
- 근거: [Presentation mode](https://www.notion.com/help/presentation-mode).

### C-13 오프라인

- **DOC:** 모든 요금제 멤버가 데스크톱/모바일 앱에서 사용하며 웹은 제외된다. 다운로드는 기기별이고 하위 페이지는 자동 포함되지 않는다. DB는 첫 뷰의 첫 50행이 기본 다운로드된다. 유료는 최근/즐겨찾기 자동 다운로드를 제공한다. 오프라인 공유·권한 변경, 네트워크 의존 블록은 제한된다.
- **실행:** P와 60행 D를 다운로드 → 네트워크 차단 → P/Q, 1·50·51행 열기 → 텍스트와 select를 두 기기에서 다르게 편집 → 재연결. **기대:** 다운로드 범위와 제한 확인. 텍스트 충돌은 자동 해소를 시도하지만 비텍스트 경쟁 값은 하나만 남을 수 있다.
- **미확인:** 충돌 승자 결정 규칙, 첨부 캐시·회수된 권한의 오프라인 적용, 저장 용량·오류 회복.
- 근거: [Use pages offline](https://www.notion.com/help/use-pages-offline).

## W — 탐색·지식 관리·협업·발행

### W-01 탐색·사이드바·사용자별 구성

- **DOC:** 사이드바는 탭·바로가기·콘텐츠 섹션으로 구성되고 탭마다 바로가기/섹션을 각각 25개까지 둘 수 있다. 숨김은 콘텐츠 삭제가 아니며 다른 사람의 사이드바를 바꾸지 않는다. 관리자 프리셋을 받아 개인적으로 조정할 수 있다.
- **실행:** 탭 추가 → 즐겨찾기 섹션 숨김 → DB 뷰 고정 → 다른 계정 확인 → 탭 재설정. **기대:** 개인 구성과 공유 콘텐츠를 분리해 확인한다.
- **미확인:** 프리셋 수정의 기존 사용자 전파, OS 간 구성 동기화, 25개 초과 UX.
- 근거: [Customize sidebar](https://www.notion.com/help/customize-your-sidebar), [Navigate sidebar](https://www.notion.com/help/navigate-with-the-sidebar).

### W-02 Library

- **DOC:** Teamspaces/Recents/Favorites/Shared/Private/회의 노트/Agents 등의 탐색 탭과 이름 검색·필터·표시 정보 조정이 있다. 페이지 여러 개 이동·삭제·즐겨찾기 해제·아이콘 변경을 할 수 있다.
- **실행:** 서로 권한이 다른 4개 페이지를 Library에서 필터 → 2개를 합성 팀스페이스로 이동 → 즐겨찾기 해제. **기대:** 여러 항목에 일괄 작업이 적용되며 숨긴 사이드바 섹션도 Library로 접근 가능하다.
- **미확인:** 혼합 권한 일괄 작업의 부분 성공 보고, 최대 선택 개수, 아카이브 상태와 결과 정렬.
- 근거: [Manage your Library](https://www.notion.com/help/manage-your-library).

### W-03 일반 검색·Command Search

- **DOC:** 제목과 페이지 콘텐츠 검색, 따옴표 정확 구문, 최근 페이지, 인기 표시, 빠른 위치 이동을 제공한다. 데스크톱의 Command Search는 앱 외부에서 실행된다. AI 전체 소스 검색은 별도 기능이다.
- **실행:** 제목/본문에 서로 다른 토큰을 넣은 P/Q 생성 → 일반/정확 구문 검색 → G/N 반복 → 내용 수정 직후 재검색. **기대:** 해당 콘텐츠 탐색, 접근 권한에 따른 결과를 검증한다.
- **미확인:** 색인 지연 SLA, 한글 형태소·오타·접두어 매칭, 첨부 본문 검색, 검색 순위 함수, 삭제/권한 변경의 색인 전파.
- 근거: [Search](https://www.notion.com/help/search).

### W-04 위키·소유자·검증

- **DOC:** Full access인 독립 페이지를 위키로 바꿀 수 있으나 DB 자체는 불가하다. Home/All pages/Pages I own 기본 뷰가 있고 페이지 담당자와 검증 만료를 관리한다. 검증 표시는 멘션/검색에 나타나고 만료 시 담당자에게 알림이 간다.
- **실행:** P 위키 전환 → Q 소유자 변경 → 만료 검증 설정 → 검색/멘션 확인 → Undo wiki. **기대:** 뷰·소유자·검증 상태 확인. 만료 알림은 실제 경과 후 검증한다.
- **DOC 보완:** 일반 DB의 Verification/Owner 조건부 속성은 DB 분석 P-33/P-34를 참조한다. **미확인:** 담당자 탈퇴·페이지 이동 시 검증 유지, 검증 후 편집 시 상태.
- 근거: [Wikis and verified pages](https://www.notion.com/help/wikis-and-verified-pages).

### W-05 동시 편집·현재 위치·잠금

- **DOC:** 같은 블록 동시 편집과 변경 실시간 표시, 참여자 아바타/위치 이동을 제공한다. 페이지 잠금은 편집자도 해제할 수 있는 실수 방지 장치다. DB 잠금은 데이터 편집을 허용하되 뷰·속성 구조 변경을 막는다.
- **실행:** O/E로 같은 문단 동시 수정 → 상대 아바타 클릭 → Lock page → E로 해제 → Lock database 후 값과 속성명 각각 수정. **기대:** 잠금의 보호 범위를 구분한다.
- **미확인:** CRDT/OT 등 내부 알고리즘, 동일 위치 삽입/삭제의 수렴 규칙, 지연·연결 단절·재접속에서의 손실. 공식 ‘실시간’ 설명은 지연 보장 수치가 아니다.
- 근거: [Collaborate in a workspace](https://www.notion.com/help/collaborate-within-a-workspace).

### W-06 댓글·멘션·반응

- **DOC:** 페이지 전체 토론과 텍스트/블록에 붙는 인라인 댓글을 구분한다. 답글·수정·삭제·해결·재열기와 멘션/반응이 있다. 여러 블록 전체를 한 번에 댓글 대상으로 삼는 것과 여러 블록에 걸친 텍스트 선택 댓글은 다르다.
- **실행:** C가 텍스트 범위에 댓글 → E가 앞부분 텍스트 삽입 → C 답글/멘션/반응 → O 해결 → Resolved에서 재열기. **기대:** 스레드 상태 전환과 위치를 확인한다.
- **미확인:** 원문 삭제/블록 이동 시 앵커, 작성자 외 수정/삭제 권한, 알림 중복 제거, 모바일 다중 문단 선택.
- 근거: [Comments, mentions and reactions](https://www.notion.com/help/comments-mentions-and-reminders).

### W-07 수정 제안

- **DOC:** Can comment 이상이 필요하며 잠긴 페이지에서는 제한된다. 텍스트·할 일·제목·불릿·번호 목록에 제안 가능하다. 인라인 DB·속성·peek 페이지는 제외된다. 승인 시 본문 반영, 거절 시 제안 제거, 댓글/반응이 가능하다.
- **실행:** C가 삽입/삭제 제안 → E가 주변 내용 수정 → O 승인/거절 → DB 속성과 peek에서 같은 조작 시도. **기대:** 승인 전 제안 상태와 승인 후 본문이 구분되고 제외 영역은 편집 제안 불가다.
- **미확인:** 겹친 제안 승인 순서, 제안 승인자의 정확 권한, Undo·이력·API 노출.
- 근거: [Suggested edits](https://www.notion.com/help/suggested-edits).

### W-08 Inbox·구독·알림 상태

- **DOC:** 페이지/스레드별로 알림을 모으며 읽음/안읽음/보관, 유형 필터, 페이지별 구독을 관리한다. 멘션·답글·사용자 속성 지정·초대·리마인더가 주요 발생원이다. 접근/토론/멘션/자동화·실행/업데이트/워크스페이스 유형이 있다.
- **실행:** E가 O 멘션 → O Inbox에서 답글 → 읽음 처리·보관 → 페이지 구독 변경 → 같은 페이지에 새 댓글. **기대:** 대상/스레드로 이동하며 필터 상태가 유지된다.
- **미확인:** push·email 중복 억제, 오프라인 수신 순서, 읽음 기기 동기화, 권한 회수 후 알림 내용 잔존.
- 근거: [Inbox and notifications](https://www.notion.com/help/updates-and-notifications).

### W-09 리마인더·시간대

- **DOC:** 본문 `@remind`와 DB Date 속성에서 날짜/시간·사전 알림·시간대를 설정한다. 타인 리마인더는 같은 블록에 사람을 멘션하는 본문 경로이며 DB 경로와 다르다.
- **실행:** 10분 후 알림을 Seoul 시간대로 생성 → 다른 계정은 다른 시간대 → 본문 멘션과 DB 날짜 각각 생성 → 수신 시각 비교. **기대:** 지정 시점 수신과 인라인 만기 상태 변화 확인.
- **미확인:** DST 경계·기기 시간 변경·반복 알림 지원, 날짜만 있는 알림의 기준 시각.
- 근거: [Reminders](https://www.notion.com/help/reminders).

### W-10 페이지 사용 통계

- **DOC:** 페이지 소유자/편집자가 총 조회·고유 조회와 생성/수정/열람자 정보를 볼 수 있다. 사용자는 전체 또는 특정 페이지에서 본인 열람 기록을 끌 수 있다.
- **실행:** O/E/V가 두 번씩 열람 → O 통계 확인 → V가 기록 끄고 다시 방문. **기대:** 기록 설정 차이를 확인한다.
- **미확인:** 집계 주기·중복 판정, 익명 Site 방문 집계, opt-out의 소급 효과, 워크스페이스 통계와 의미 차이.
- 근거: [Page analytics](https://www.notion.com/help/page-analytics).

### W-11 People Directory·프로필

- **DOC:** 전 요금제에 현재/이전 멤버 디렉터리가 있고 게스트는 제외된다. 멤버는 자기 프로필을, 소유자는 전체 속성을 편집한다. 기본 이름/이메일 속성은 삭제 불가다. Enterprise SCIM/HRIS 동기화는 추가 조건이다. 프로필 hover card는 모바일 미지원이며 게스트는 이용하지 못한다.
- **실행:** O가 사무실 속성 추가 → E 본인 값 수정 → 타인 수정 시도 → G 보기 → 프로필 비활성화. **기대:** 자기 편집/관리 범위 차이 확인.
- **미확인:** 퇴사자 표시 기간, 활동 노출의 권한 필터, SCIM 필드 덮어쓰기.
- 근거: [People Directory](https://www.notion.com/help/people-directory), [People profiles](https://www.notion.com/help/people-profiles).

### W-12 Sites 발행·공개 링크·검색 노출

- **DOC:** Site 발행과 Anyone with link 공유는 다른 경로다. Site 본문 수정은 자동 공개 반영되고 부모를 발행하면 하위 페이지도 공개된다. 외부 사이트에 임베드하는 코드도 제공한다. 유료 slug는 영문자/숫자/하이픈, 최대 60자이며 홈 페이지는 slug가 없다.
- **실행:** 합성 P/Q 발행 → 비로그인 브라우저로 부모/자식/임베드 확인 → 본문 수정 → 공개 취소 → 기존 URL 재확인. **기대:** 하위 공개와 자동 반영 확인. 보호된 참조·동기화 블록은 따로 권한 검증한다.
- **미확인:** 캐시 제거 지연, 검색엔진 색인 해제 지연, 사용자 메타데이터 노출 범위.
- 근거: [Publish a Notion Site](https://www.notion.com/help/public-pages-and-web-publishing).

### W-13 Sites 모양·도메인·사이트 관리

- **DOC:** 유료에서 테마, SEO 제목/설명, 공유 미리보기, favicon, 탐색 헤더, 검색, Analytics를 제공한다. 워터마크 제거는 custom domain 조건이다. 무료 notion.site 도메인 1개, 유료 최대 5개, 별도 구매 custom domain 최대 25개로 설명된다. Public pages에서 접근 가능한 사이트·폼·공개 링크를 관리한다.
- **실행:** 테스트 Site의 테마/미리보기 변경 후 Publish changes → 익명 세션 확인 → Public pages의 발행자/날짜 확인. **기대:** 문서 본문 자동 반영과 사이트 설정 발행 흐름을 구분한다.
- **미확인:** 도메인 충돌·DNS 검증·TLS 완료 시간, GA 차단 시 처리, 요금/지역 세금. 실제 결제나 도메인 구매는 미수행.
- 근거: [Site customization](https://www.notion.com/help/edit-and-customize-your-notion-sites), [Availability](https://www.notion.com/help/notion-sites-availability-and-pricing), [Manage Sites](https://www.notion.com/help/manage-your-notion-sites).

### W-14 가져오기와 데이터 매핑

- **DOC:** 데스크톱/웹에서 Markdown·TXT·HTML·DOCX·CSV 및 여러 서비스 입력을 지원한다. CSV는 행→페이지, 열→속성으로 매핑하며 신규 수식/롤업을 생성하지 못한다. Word의 추적 변경·댓글·복잡한 레이아웃은 보존되지 않는다. ZIP은 형식별 페이지/DB 변환이고 최대 5GB라도 많은 파일에서 부분 실패할 수 있다.
- **실행:** 한글/개행/이미지/병합표/링크를 넣은 합성 파일 묶음을 각각 import → 원문 대비 항목별 비교 → 같은 파일 재시도. **기대:** 지원 콘텐츠 변환, 누락·부분 성공·중복 생성 여부 기록.
- **미확인:** 각 서비스별 완전 매핑 표, Confluence/Jira/Asana 등 별도 importer의 권한·첨부·이력 처리. 직접 import와 ZIP 내부 변환의 지원 형식 차이는 별도로 검증해야 한다.
- 근거: [Import data](https://www.notion.com/help/import-data-into-notion).

### W-15 내보내기·인쇄·복원 가능성

- **DOC:** 페이지 HTML·Markdown·PDF, DB CSV와 workspace export 경로를 구분해야 한다. Markdown에서 콜아웃은 HTML로 표현되고 전체 페이지 DB는 CSV와 하위 페이지 Markdown으로 나뉜다. Form view는 직접 export 불가다. 데스크톱 앱 직접 인쇄 대신 PDF 출력 경로를 사용한다. 전체 workspace PDF는 2026-08-31까지 제거한다는 별도 공지가 있어 현재 제공을 확정하지 않는다(W-29).
- **실행:** 합성 P/Q/D를 하위 포함/미포함으로 각 형식 export → 링크·파일·댓글·권한·수식·뷰를 검사 → 새 테스트 공간으로 재수입. **기대:** 포맷별 콘텐츠 출력 확인. export/import를 완전 백업 복원으로 간주하지 않는다.
- **미확인:** export 작업의 일관 시점, 실패/취소 재개, 비공개 하위 페이지 제외, 형식별 관계·뷰 손실.
- 근거: [Export your content](https://www.notion.com/help/export-your-content).

## A — 권한·조직·보안·운영

### A-01 페이지 권한·상속·겹치는 부여

- **DOC:** Full access/Can edit/Can edit content(DB)/Can comment/Can view를 구분한다. 하위 페이지는 부모 권한을 상속하며 개별 수정할 수 있다. 여러 경로의 권한은 가장 넓은 접근이 유효하다. Private로 이동할 때 부모와 하위의 기존 직접 부여가 동일하게 처리된다고 가정하면 안 된다.
- **실행:** E에게 직접 보기, 그룹으로 편집 부여 → 편집 확인 → 그룹 제거 → 부모 공유·자식 직접 공유 후 Private 이동. **기대:** 넓은 부여가 우선하고 하위 직접 권한은 개별 확인한다.
- **미확인:** 모든 역할×행위의 정확 행렬, 변경 전파 지연, 삭제·복원·공개 링크 상호작용.
- 근거: [Sharing and permissions](https://www.notion.com/help/sharing-and-permissions). DB 행/속성 접근 상세는 데이터베이스 조사 문서가 담당한다.

### A-02 멤버·게스트·초대·임시 멤버

- **DOC:** 멤버는 워크스페이스, 게스트는 특정 페이지 접근 단위다. 유료는 멤버별 과금이다. 초대 링크·허용 이메일 도메인 경로가 있고 초대 권한이 없으면 요청할 수 있다. 인증된 Marketplace 컨설턴트의 임시 멤버는 만료 접근과 좌석 예외가 설명된다.
- **실행:** 테스트 이메일의 게스트 초대와 멤버 초대를 각각 미리보기 → 초대 수락/취소 → 페이지 권한 확인 → 게스트 제한 정책에 따른 오류 확인. **기대:** 실제 역할과 과금 좌석 차이를 확인한다.
- **미확인:** 현재 요금제별 게스트 수치, restricted member 전체 권한, 초대 중복·만료·도메인 변경 처리. 운영 계정에 실제 초대는 수행하지 않는다.
- 근거: [Manage members and guests](https://www.notion.com/help/add-members-admins-guests-and-groups).

### A-03 Teamspace의 공개성·역할·전환

- **DOC:** Open은 참여/열람 가능, Closed는 존재가 보이지만 초대 가입, Private은 비회원에게 숨김이며 Business/Enterprise 조건이다. 페이지→팀스페이스 전환에는 Full access 및 소유자 역할 등 조건이 있다. 팀스페이스 owner/member는 워크스페이스 역할과 별개다.
- **실행:** 3종 팀스페이스에 P를 생성 → 일반 멤버의 검색·가입·직접 링크 → 멤버와 소유자 권한 비교. **기대:** 존재 노출/가입/본문 접근을 별도로 기록한다.
- **미확인:** default teamspace의 탈퇴·아카이브 제약, 기존 페이지 기본 권한 소급 적용, teamspace 간 이동 후 직접 권한.
- 근거: [Intro to teamspaces](https://www.notion.com/help/intro-to-teamspaces).

### A-04 그룹·그룹 소유자·SCIM 동기화 그룹

- **DOC:** 그룹은 멤버만 포함하고 게스트는 제외한다. 페이지별 권한 대상이 될 수 있다. 그룹 소유자는 특정 그룹을 관리하며 SCIM Synced 그룹의 UI 변경은 IdP 변경으로 덮어써질 수 있다.
- **실행:** 그룹 G1에 E 추가 → P 공유 → E 제거 → G에게 그룹 추가 시도 → 동기화 그룹 UI 이름 변경 후 IdP 재동기화. **기대:** 대상 자격과 권한 전파·덮어쓰기 확인.
- **미확인:** 중첩 그룹 지원, 동기화 주기, 마지막 소유자 제거의 모든 경로.
- 근거: [Create and manage groups](https://www.notion.com/help/create-and-manage-groups).

### A-05 조직 정책과 위임 관리자

- **DOC:** Enterprise 조직 설정은 여러 워크스페이스에 적용되며 조직에서 관리한 설정을 워크스페이스 소유자가 바꿀 수 없다. Compliance/People/IT/Analytics 등 사전 역할과 custom admin role(beta)이 있다. 여러 역할은 합산되고 페이지 권한 자체를 변경하는 역할 모델은 아니다. custom role에 신규 기능이 자동 추가되지 않는다.
- **실행:** 테스트 조직에서 한 워크스페이스에만 content-search 역할 위임 → 다른 workspace·보안 메뉴 접근 → 역할 회수. **기대:** 범위 밖 관리자 UI/동작 제한. 새 기능 포함 여부는 별도 확인한다.
- **미확인:** 역할별 세부 action 전체 목록과 API 경로 동등성.
- 근거: [Organization controls](https://www.notion.com/help/organization-level-controls), [Enterprise admins](https://www.notion.com/help/enterprise-admins).

### A-06 SAML SSO

- **DOC:** Business/Enterprise, workspace owner 설정, 검증 도메인·SAML 2.0 IdP가 필요하다. 게스트는 이 SAML 로그인 대상이 아니다. Business 단일 구성과 Enterprise 다중 구성에 차이가 있다.
- **실행:** 테스트 IdP 사용자로 로그인 → SSO 강제 정책 → 비 SSO 로그인 시도 → 게스트 로그인 → IdP 사용자 비활성화. **기대:** 멤버/게스트 인증 경로 차이와 설정 적용 확인.
- **미확인:** 기존 세션 회수 시점, NameID 변경·JIT·도메인 충돌·SSO 복구의 모든 분기.
- 근거: [SAML SSO](https://www.notion.com/help/saml-sso-configuration).

### A-07 SCIM 프로비저닝

- **DOC:** Enterprise에서 멤버/그룹 생성·제거·수정·조회와 역할을 관리한다. 게스트 관리는 제외된다. workspace별 토큰을 사용하며 토큰 소유자 역할 변경/퇴사 시 폐기될 수 있다. 마지막 Full access가 없어지는 그룹 삭제는 거부될 수 있다.
- **실행:** 테스트 IdP에서 멤버와 그룹 생성 → 그룹 공유 페이지 열기 → 멤버 비활성화 → 동기화 토큰 회수. **기대:** 계정/그룹 변화와 연결 중단 확인. 실제 비밀 토큰은 증거에 저장하지 않는다.
- **미확인:** deprovision의 세션/API 토큰 회수 범위, 재프로비저닝 ID 보존, IdP별 동기화 지연.
- 근거: [Provision users and groups](https://www.notion.com/help/provision-users-and-groups-with-scim).

### A-08 게스트 MFA 강제

- **DOC:** Enterprise 조직 소유자가 workspace별 게스트 MFA 요구를 설정한다. MFA 없이 로그인한 게스트는 추가 검증을 완료해야 계속 접근할 수 있다.
- **실행:** 테스트 G로 열람 → MFA 요구 활성화 → 같은 세션 재접근 → 인증 후 재진입. **기대:** 추가 인증 화면과 접근 회복.
- **미확인:** 기존 세션 즉시 적용 여부, 지원되는 인증 수단·복구 절차·웹/앱 차이. 멤버 SSO MFA와 별도 정책으로 취급한다.
- 근거: [MFA enforcement](https://www.notion.com/help/mfa-enforcement).

### A-09 Network control과 IP 제한

- **DOC:** Network control은 회사 프록시/CASB로 허용 workspace를 제한하는 축이다. IP restrictions는 Enterprise 조직의 managed user 로그인 허용 주소/대역을 지정하는 축이다. IPv4/IPv6·CIDR, 규칙당 16주소/대역, 범위 이탈 시 세션 유지 또는 재인증 모드가 있다.
- **실행:** 테스트 관리 계정에 허용망 A/비허용망 B를 준비 → A 로그인 후 B 전환 → 두 세션 정책 반복. **기대:** 유지/재인증 모드 차이. 관리자의 복구 경로를 확보한 시험 환경에서만 실행한다.
- **미확인:** 외부 게스트·봇/API 적용, proxy 우회 경계, mobile offline과의 관계.
- 근거: [Network control](https://www.notion.com/help/network-control), [IP restrictions](https://www.notion.com/help/ip-address-restrictions).

### A-10 관리자 콘텐츠 검색

- **DOC:** Enterprise에서 페이지 ID/제목/내용 및 생성자·일시 등으로 검색하고 공개 범위·접근자·편집자 정보를 확인한다. 소유자는 CSV 출력과 권한 조정이 가능하다. 조직 범위 또는 위임된 workspace 범위가 다를 수 있다.
- **실행:** Private/내부 공유/외부 공유/웹 공개 페이지를 생성 → 각 조건 검색 → 제한 페이지 권한 변경 → 결과 CSV 확인. **기대:** audience는 가장 넓은 공개 범위를 표시한다.
- **미확인:** 검색 색인 지연, 관리자 열람 감사 이벤트, 제한 위임의 CSV·API 범위.
- 근거: [Admin content search](https://www.notion.com/help/admin-content-search).

### A-11 감사 로그

- **DOC:** Enterprise 조직 소유자용이며 업그레이드 이전 이벤트는 포함되지 않는다. 행위자·시각·가능한 IP를 기록하고 일시/사람/이벤트/workspace 필터가 있다. 보존은 최대 365일로 설명되며 UI 반영 지연과 SIEM 스트리밍을 구분한다.
- **실행:** 합성 페이지 열람·권한 변경·외부 공개·사용자 제거를 각각 수행 → 로그 발생 시각/유형/대상 비교 → CSV/SIEM 지원 경로 확인. **기대:** 문서에 정의된 이벤트와 필터를 검증한다.
- **미확인:** 전체 이벤트 스키마·누락/중복 처리·전달 SLA. 페이지 버전 기록과 감사 로그는 동일하지 않다.
- 근거: [Audit log](https://www.notion.com/help/audit-log).

### A-12 데이터 보존 정책

- **DOC:** Enterprise owner는 Trash 체류와 삭제 후 보존을 각각 1일~10년으로 지정한다. 삭제된 AI chat은 Trash 없이 보존 단계로 간다. 최종 만료 뒤에는 소유자도 복원할 수 없다.
- **실행:** 전용 시험 공간에서 최소 허용 기간 설정 → 합성 페이지 삭제 → Trash/retained 검색 → 관리자 복원. **기대:** 두 단계와 사용자별 복원 범위를 확인한다. 장기 만료는 시간 경과 시험이 필요하다.
- **미확인:** 정책 변경의 기존 객체 소급, 백업 잔존, Legal hold와 우선순위의 상세 구현.
- 근거: [Custom retention](https://www.notion.com/help/custom-data-retention-settings).

### A-13 Legal hold

- **DOC:** Enterprise 조직 소유자가 사용자별 생성/편집/열람 범위로 콘텐츠 보존을 설정한다. 멤버·게스트를 대상으로 할 수 있고 여러 workspace에 적용된다. PDF 본문/CSV 메타데이터 출력과 hold 해제가 있다. 해제 후 보존 정책이 다시 적용된다.
- **실행:** 합성 사용자 hold 생성 → 페이지 생성·편집·열람만 한 세 가지 페이지 비교 → 삭제 후 hold export → 해제. **기대:** 선택한 행위 범위에 따른 포함 차이와 메타데이터 확인.
- **미확인:** hold 생성 전 이미 영구 삭제된 콘텐츠 처리, 대규모 export 부분 실패, 여러 hold 중 하나 해제의 상태.
- 근거: [Legal holds](https://www.notion.com/help/legal-holds). 법률 조언이 아닌 제품 기능 조사다.

### A-14 퇴사자 비공개 콘텐츠 인계

- **DOC:** Enterprise workspace owner가 30일 이내 떠난 사용자의 아직 인계되지 않은 비공개 페이지를 현재 사용자에게 넘길 수 있다. 현재 멤버와 공유된 콘텐츠는 이 절차 대상이 아니다. 인계 결과는 새 최상위 private 페이지 아래 나타난다.
- **실행:** 테스트 E가 private/shared 페이지를 각각 남기고 탈퇴 → Recently left에서 O에게 인계 → 대상/부모/권한 확인. **기대:** private만 대상으로 인계되고 중복 인계 대상에서 빠진다.
- **미확인:** 재가입·SCIM 재활성화와 경합, 소유자/검증/댓글 저자 유지, API 재시도 멱등성.
- 근거: [Transfer deprovisioned user content](https://www.notion.com/help/transfer-content-deprovisioned-user).

### A-15 데이터 저장 지역

- **DOC:** Enterprise 대상이며 실제 이관 완료 확인 전에는 기존 미국 저장으로 남는다. 저장 지역 표에는 미국·EU·일본·한국이 있고 일본/한국은 담당팀 확인 안내가 있다. 본문·첨부·검색 색인 등 지정 데이터의 at-rest 위치를 다룬다. 계정/사용 데이터, Calendar/Mail/beta, 외부 서비스는 같은 보장을 받지 않는다.
- **실행:** 관리자에서 현재 지역과 신규 workspace 기본 지역을 확인하고 담당자 승인/이관 상태 문서를 대조한다. **기대:** 선택 지역과 이관 완료를 구분한다. UI만으로 물리 저장 위치 검증 완료를 선언하지 않는다.
- **미확인:** 계정별 제공 지역·이관 시간·백업 삭제 증빙·AI 처리 경로.
- 근거: [Data residency](https://www.notion.com/help/data-residency).

### A-16 청구·플랜 변경·좌석

- **DOC:** 청구 기간 시작 선불이고 기간 중 업그레이드는 즉시 적용 및 새 기간 시작, 이전 잔여분 비례 차감으로 설명된다. 멤버 추가와 게스트 초대의 과금 의미가 다르다.
- **실행:** 실제 결제 없이 테스트 관리자 Billing에서 현재 주기·좌석·청구서·플랜 변경 미리보기 화면을 기록한다. **기대:** 가격/수량/갱신일 및 즉시/차기 적용 구분. 결제 확정은 이 분석에서 수행하지 않는다.
- **미확인:** 통화·지역·계약·판매팀 청구·크레딧·할인·세금·환불/다운그레이드 세부 조건. 공개 가격을 실제 계약 가격으로 대체하지 않는다.
- 근거: [Manage billing](https://www.notion.com/help/billing).

### A-17 워크스페이스 삭제

- **DOC:** 전체 workspace 삭제는 private 페이지까지 모든 사용자에게 영향을 준다. 이름 확인 절차가 있다. 구독은 즉시 중단이 아니라 현재 청구 기간 종료 시 취소되고 갱신하지 않는다고 설명된다.
- **실행:** 폐기용 테스트 workspace만 준비 → export 확인 → 삭제 확인 화면까지 캡처. 실제 삭제 재현이 승인된 별도 시험에서는 두 계정의 접근 불가와 전환 위치를 확인한다.
- **미확인:** 복구 지원 예외, 계약 workspace 제거와 계정 삭제의 관계. 문서 분석만으로 지원팀 복구를 보장하지 않는다.
- 근거: [Delete a workspace](https://www.notion.com/help/delete-a-workspace).

## 범위 점검과 미완료 목록

위 ID는 C-01~C-13(13), W-01~W-15(15), A-01~A-17(17), **총 45개 분석 단위**다. 각각 DOC 근거와 미실행 재현 절차가 있다. 분석 단위 개수는 원자 기능 수나 노션 전체 완성도를 뜻하지 않는다.

다음 공식 디렉터리를 읽어 기능 누락을 점검했다.

- [Pages and blocks 전체](https://www.notion.com/help/category/write-edit-and-customize/all): 편집·형식·미디어·링크·위키·이동·삭제·동기화·코드·수학·단축키·공개 복제·발표·아카이브·오프라인.
- [Sharing 전체](https://www.notion.com/help/category/sharing-and-collaboration/all): 공유·멤버·공동작업·Inbox·댓글·알림·제안·통계·팀스페이스·디렉터리·속성 접근·프로필·역할·그룹.
- [Enterprise admin 전체](https://www.notion.com/help/category/enterprise-admin/all): SAML·SCIM·콘텐츠 검색·인계·감사·보안 연결·통계·managed users·보존·배포·Intune·MFA·network·Legal hold·IP·조직·Admin API.
- [Sites 전체](https://www.notion.com/help/category/notion-sites/all): 발행·스타일·관리·도메인·가용성.
- [Sidebar](https://www.notion.com/help/category/sidebar-navigation), [Import/export](https://www.notion.com/help/category/import-export-and-integrate), [Billing](https://www.notion.com/help/category/plans-billing-and-payment).

**미완료/추가 세분화 대상:**

1. 모든 블록 변환 조합, 클립보드 MIME·IME·접근성·키보드 단축키 전체, 대형 문서 성능, 미디어/임베드 공급자별 동작.
2. 공개 페이지 복제/템플릿 Marketplace의 구매·판매·라이선스·환불·접근 잠금·분석, template 반복과 동기화 의미. 해당 세부 문서 본문은 이 조사에서 아직 읽지 않았다.
3. 모든 importer별 매핑(Confluence/Jira/Asana/Evernote/Trello/Quip/Google Docs/HTML/Markdown/CSV/ZIP/PDF 등), export 재수입 손실의 정량 비교.
4. Enterprise 도메인 관리·managed users·DLP/SIEM 연결·workspace analytics·배포 패키지·Intune·세션 장치 관리·개인 2단계 인증·workspace 계약 제거. 디렉터리에서 발견했으나 개별 본문 분석과 런타임이 남았다.
5. 계정 가입/탈퇴·이메일/비밀번호 변경·다중 계정·언어/시작 주/알림 설정·교육/비영리 플랜·신용/결제 실패·구독 해지 세부 분기.
6. DB 행·속성 권한, 폼·버튼·자동화, AI/Agent/Calendar/Mail/API는 별도 도메인 조사와 대조해야 한다.
7. 모든 기능의 실제 UI·네트워크·역할·플랜·브라우저·모바일 동작 검증. 현재 **0건**이며 DOC를 OBS로 승격한 항목은 없다.

## 확인한 주요 출처 대장

아래는 본문에서 실제로 읽은 공식 문서 URL이다. 문서 제목만 발견한 미완료 영역은 위 목록에서 별도로 표시했다. 본문을 짧게 종합했고 원문 전체를 복제하지 않았다.

| 번호 | 공식 문서 | 대응 |
|---|---|---|
| 01 | https://www.notion.com/help/writing-and-editing-basics | C-01/02 |
| 02 | https://www.notion.com/help/customize-and-style-your-content | C-02 |
| 03 | https://www.notion.com/help/columns-headings-and-dividers | C-03 |
| 04 | https://www.notion.com/help/images-files-and-media | C-04 |
| 05 | https://www.notion.com/help/code-blocks | C-05 |
| 06 | https://www.notion.com/help/math-equations | C-06 |
| 07 | https://www.notion.com/help/create-links-and-backlinks | C-07 |
| 08 | https://www.notion.com/help/synced-blocks | C-08 |
| 09 | https://www.notion.com/help/transfer-content-to-another-account | C-09 |
| 10 | https://www.notion.com/help/duplicate-delete-and-restore-content | C-10 |
| 11 | https://www.notion.com/help/archive-pages | C-11 |
| 12 | https://www.notion.com/help/presentation-mode | C-12 |
| 13 | https://www.notion.com/help/use-pages-offline | C-13 |
| 14 | https://www.notion.com/help/customize-your-sidebar | W-01 |
| 15 | https://www.notion.com/help/navigate-with-the-sidebar | W-01 |
| 16 | https://www.notion.com/help/manage-your-library | W-02 |
| 17 | https://www.notion.com/help/search | W-03 |
| 18 | https://www.notion.com/help/wikis-and-verified-pages | W-04 |
| 19 | https://www.notion.com/help/collaborate-within-a-workspace | W-05 |
| 20 | https://www.notion.com/help/comments-mentions-and-reminders | W-06 |
| 21 | https://www.notion.com/help/suggested-edits | W-07 |
| 22 | https://www.notion.com/help/updates-and-notifications | W-08 |
| 23 | https://www.notion.com/help/reminders | W-09 |
| 24 | https://www.notion.com/help/page-analytics | W-10 |
| 25 | https://www.notion.com/help/people-directory | W-11 |
| 26 | https://www.notion.com/help/people-profiles | W-11 |
| 27 | https://www.notion.com/help/public-pages-and-web-publishing | W-12 |
| 28 | https://www.notion.com/help/edit-and-customize-your-notion-sites | W-13 |
| 29 | https://www.notion.com/help/notion-sites-availability-and-pricing | W-13 |
| 30 | https://www.notion.com/help/manage-your-notion-sites | W-13 |
| 31 | https://www.notion.com/help/import-data-into-notion | W-14 |
| 32 | https://www.notion.com/help/export-your-content | W-15 |
| 33 | https://www.notion.com/help/sharing-and-permissions | A-01 |
| 34 | https://www.notion.com/help/add-members-admins-guests-and-groups | A-02 |
| 35 | https://www.notion.com/help/intro-to-teamspaces | A-03 |
| 36 | https://www.notion.com/help/create-and-manage-groups | A-04 |
| 37 | https://www.notion.com/help/organization-level-controls | A-05 |
| 38 | https://www.notion.com/help/enterprise-admins | A-05 |
| 39 | https://www.notion.com/help/saml-sso-configuration | A-06 |
| 40 | https://www.notion.com/help/provision-users-and-groups-with-scim | A-07 |
| 41 | https://www.notion.com/help/mfa-enforcement | A-08 |
| 42 | https://www.notion.com/help/network-control | A-09 |
| 43 | https://www.notion.com/help/ip-address-restrictions | A-09 |
| 44 | https://www.notion.com/help/admin-content-search | A-10 |
| 45 | https://www.notion.com/help/audit-log | A-11 |
| 46 | https://www.notion.com/help/custom-data-retention-settings | A-12 |
| 47 | https://www.notion.com/help/legal-holds | A-13 |
| 48 | https://www.notion.com/help/transfer-content-deprovisioned-user | A-14 |
| 49 | https://www.notion.com/help/data-residency | A-15 |
| 50 | https://www.notion.com/help/billing | A-16 |
| 51 | https://www.notion.com/help/delete-a-workspace | A-17 |

## 추가 확인: 계정·인증·현지화

다음 8개는 초기 45개에 추가된 조사 단위다. 후속 표까지 포함한 최신 집계는 문서 말미에 있으며 모든 런타임 실행은 여전히 0건이다.

### A-18 로그인 방식·세션

- **DOC:** 이메일 인증코드·이메일/비밀번호·Google·Apple·SAML·passkey 로그인 경로가 있다. Apple Hide My Email은 별도 주소로 새 계정을 만들 수 있어 기존 계정 연결과 다르다. 복수 IdP 조직은 provider 선택 또는 workspace별 재인증이 가능하다.
- **실행:** 동일 합성 계정의 코드/비밀번호 로그인 → 별도 기기 로그인 → 원격 로그아웃 경로 확인. **기대:** 동일 정체성 여부와 세션 종료 범위를 비교한다.
- **미확인:** 이메일 코드 TTL·재발급·시도 제한·계정 연결 충돌, refresh token 구조. 근거: [Log in and out](https://www.notion.com/help/log-in-and-out).

### A-19 Passkey

- **DOC:** 전 플랜 제공, 최대 5개, 동기화형과 FIDO2 보안키 등 device-bound 방식을 지원한다. IdP 로그인을 강제하는 조직은 사용할 수 없다. workspace owner의 전원 passkey 강제는 지원하지 않는다고 명시한다.
- **실행:** 전용 계정에 passkey 등록 → 새 브라우저 로그인 → 서버 측 키 삭제 후 재로그인. **기대:** 등록 키 인증과 제거 효과. 비밀키·복구코드는 기록하지 않는다.
- **미확인:** OS별 cross-device UX·attestation·credential 동기화 장애. 근거: [Passkeys](https://www.notion.com/help/passkeys).

### A-20 개인 2단계 인증

- **DOC:** 전 플랜, 비밀번호 필요, IdP 강제 조직 제외. 인증 앱 또는 지역별 SMS를 사용하고 최대 인증앱 2개+전화 2개를 둘 수 있다. 백업 코드 경로와 수단 변경 시 재검증이 있다.
- **실행:** 테스트 계정에 인증앱 등록 → 비밀번호 로그인 시 추가 검증 → 백업 코드 대체 → 수단 제거 화면 확인. **기대:** 일반 로그인과 복구 흐름 분리. 코드·QR은 증거에서 제거한다.
- **미확인:** 재사용 방지 기간·백업 코드 소진 UX·SMS 지역 목록. 근거: [Two-step verification](https://www.notion.com/help/two-step-verification).

### A-21 보조 이메일

- **DOC:** 한 계정에 검증된 보조 이메일 최대 5개를 연결해 로그인·공유·멘션을 같은 정체성으로 받을 수 있다. 주 이메일은 계정 알림을 수신한다. Enterprise managed user는 도메인 정책 제약이 있다.
- **실행:** 테스트 보조 이메일 검증 → 그 주소로 P 공유 → 두 주소 로그인 결과 비교 → 주 이메일 전환. **기대:** 새 계정 생성 없이 같은 계정의 접근. 교육 주소 제거는 할인 영향이 문서에 명시되어 있다.
- **미확인:** 이미 다른 계정에 사용 중인 이메일 합병 여부, SCIM과 주 이메일 충돌. 근거: [Secondary emails](https://www.notion.com/help/secondary-emails).

### A-22 지원팀 접근 동의

- **DOC:** 개인 계정 대행 접근과 workspace 데이터 접근은 별도 동의다. 하나를 켜도 다른 하나가 켜지지 않는다. 기본 28일 만료와 즉시 철회가 있으며 workspace 접근 변경은 감사 로그에 기록된다.
- **실행:** 실제 지원 접근을 켜지 않고 두 설정의 위치·범위·만료 안내를 캡처한다. 별도 시험에서는 한쪽만 허용해 다른 설정 불변 확인. **기대:** 동의 범위 분리.
- **미확인:** 관리자가 막은 개인 동의 UX, 실제 지원자 행위 감사 세부. 근거: [Data access consent](https://www.notion.com/help/data-access-consent).

### A-23 Managed users·도메인·세션 정책

- **DOC:** Enterprise 검증 도메인 기반 관리 사용자에게 계정 정보 수정·외부 workspace 가입·지원 접근·세션 기간을 제어한다. 기간은 1시간~180일, 전체 로그아웃/비밀번호 초기화가 있으며 외부 workspace 참여 현황을 확인한다.
- **실행:** 전용 검증 도메인 사용자에 외부 가입 제한 → 다른 시험 workspace 초대 → 관리 세션 로그아웃 → 기기별 확인. **기대:** 계정 단위 정책이 workspace 페이지 ACL과 별도로 작동한다.
- **미확인:** 도메인 소유권 이전·여러 조직의 도메인 충돌, 기존 외부 가입 소급, 검증 DNS 만료. 근거: [Managed users](https://www.notion.com/help/managed-users-dashboard), [Domain management](https://www.notion.com/help/domain-management). 도메인 본문 재조회는 성공했으며 A-54에 절차를 추가했다.

### W-16 언어·RTL·지역화

- **DOC:** 한국어를 포함한 UI 언어 선택이 있고 모바일은 OS 언어 우선순위를 따른다. 대부분 텍스트 블록의 방향 자동 판별을 지원하지만 simple table은 예외다. 아랍어/히브리어 UI는 반전되고 블록 방향 수동 선택이 있다.
- **실행:** 한국어→아랍어 UI 전환 → 혼합 한글/RTL/숫자 문단·표 생성 → 블록 방향 변경 → 모바일 비교. **기대:** UI 반전과 본문 방향 구분, 표 예외 확인.
- **미확인:** 날짜/숫자 파싱 locale·검색 토큰화·스크린리더 의미 순서. 근거: [Change language](https://www.notion.com/help/change-your-language).

### C-14 접근성·입력 호환성 검증 영역

- **DOC 범위:** 공식 문서는 키보드 편집과 플랫폼별 제한을 설명하지만 이 조사에서 WCAG 적합성이나 모든 보조기술 동등성은 확인하지 않았다. 따라서 접근성 지원 완료라는 사실 주장은 하지 않는다.
- **실행:** 마우스 없이 새 페이지·블록 이동·속성 편집·댓글·메뉴 닫기 수행 → NVDA로 제목/목록/표/대화상자 탐색 → 200% 확대 → 한글 IME 조합 중 Enter/Undo. **기대:** 제품 동작을 수집하는 탐색 시험이며 합격 기준은 키보드 포커스 유실 없음·라벨 읽기·입력 손실 없음으로 별도 정의한다.
- **미확인:** 스크린리더별 적합성·고대비·감소된 모션·모바일 터치 타깃. 근거: [공식 키보드 문서](https://www.notion.com/help/keyboard-shortcuts). 키보드 본문 분석은 C-15에 추가했으나 접근성 적합성 증거는 없고 런타임은 미실행이다.

## 추가 기능 조사: 설정·운영·템플릿·입출력

이 표의 DOC는 **핵심 동작을 공식 본문에서 확인했다**는 뜻이다. 세부 상태 전이 전체와 런타임 동등성은 미확인이다. 각 행의 시험은 합성 데이터/별도 테스트 조직에서 수행할 미실행 절차다. 금액·세무·계약은 제품의 입력/상태를 조사하며 실제 결제·신청·삭제를 실행하지 않았다.

| ID | 기능과 문서에서 확인한 동작 | 미실행 절차 → 기대 / 미확인 | 공식 근거 |
|---|---|---|---|
| C-15 | 키보드 탐색: 페이지내 찾기, 전체 검색, URL 복사, 뒤/앞, peek 이전/다음, 데스크톱 탭/창 생성. 문서는 영어 QWERTY 기준이다. | Windows/Mac에서 같은 페이지로 이동 → 지정 대상 열림. 한글 배열·브라우저 기본 키 충돌은 미확인. | [Keyboard shortcuts](https://www.notion.com/help/keyboard-shortcuts) |
| W-17 | 공개 페이지 복제는 목적 workspace의 Private 영역에 하위 페이지와 함께 생성한다. 일부 블록은 No access일 수 있고 발행자는 template duplication을 끌 수 있다. | 공개 테스트 P 복제 → 원본 수정 → 복사본 비교. 독립 콘텐츠와 접근 불가 참조를 확인. | [Duplicate public pages](https://www.notion.com/help/duplicate-public-pages) |
| W-18 | Marketplace에서 무료/유료 템플릿, 분류·검색·추가 수·리뷰·평점·업데이트·사용 기능을 보여준다. 추가는 로그인 웹/데스크톱, 구매는 USD·카드로 설명된다. | 무료 합성 템플릿 추가 → workspace 선택 → 하위/DB 구조 확인. 유료는 결제 직전까지. 구매 후 업데이트 배포·환불 시 사본 회수는 미확인. | [Find templates](https://www.notion.com/help/finding-templates-on-marketplace) |
| W-19 | 템플릿 판매자는 일반 프로필과 별도 creator profile을 만들고 직접 판매는 승인/Stripe onboarding을 거친다. 외부 결제 사이트 연결도 가능하다. | creator draft에서 제목·가격·미리보기·발행 상태 확인 → 저장 재진입. 실제 판매 등록 미실행. 정산·복제 제한·라이선스 세부는 미확인. | [Sell templates](https://www.notion.com/help/selling-on-marketplace) |
| W-20 | 템플릿 현지화는 새 상품이 아닌 같은 listing의 언어별 변형이며 같은 링크/slug를 사용한다. AI로 템플릿과 설명을 번역한다. | 같은 listing을 한국어/영어로 열기 → 언어별 표현/링크 비교. 수식·관계명·번역 덮어쓰기는 미확인. | [Template localization](https://www.notion.com/help/template-localization-on-marketplace) |
| W-21 | Marketplace 서비스는 컨설턴트 탐색→프로젝트 양식→수락/거절→예약→협업 확인→리뷰 흐름이다. | 공개 디렉터리·문의 양식까지만 확인 → 제출하지 않는다. 실제 매칭/예약 SLA는 미확인. | [Find services](https://www.notion.com/help/finding-services-on-marketplace) |
| W-22 | 관리자 사이드바 프리셋은 기본/선택으로 나뉘며 기본이 적어도 1개 필요하다. 사용자는 수정/제거/재설정 가능하다. | default/optional 생성 → 신규 멤버 가입 → 개인 수정 → 관리자 변경 → reset. 기본 지급/선택 추가 확인, 기존 사용자 변경 전파는 실측. | [Sidebar presets](https://www.notion.com/help/manage-sidebar-presets-for-your-workspace) |
| W-23 | Confluence ZIP/API/개별 URL·ID 경로가 있으며 API는 댓글·사용자 매핑을 보존한다. 다중 space는 Business/Enterprise에서 최대10개. 권한·역사·대부분 매크로는 이관하지 않는다. | 댓글/첨부/매크로/계층을 가진 합성 space를 ZIP/API 각각 수입 → private 도착·누락 비교. ZIP 5GB(요청15GB), API30GB·페이지50k 상한은 경계 시험 필요. | [Confluence](https://www.notion.com/help/import-from-confluence) |
| W-24 | Asana import는 전 플랜 멤버 가능하며 복제 후 동기화하지 않는다. 프로젝트/태스크/하위태스크/담당/기한/댓글/첨부를 가져오고 규칙·자동화·권한·의존성은 제외한다. | 합성 프로젝트 import → 원본 변경 → 노션 불변 확인. 일방향 synced database와 구분한다. 사용자 미매핑은 미확인. | [Asana](https://www.notion.com/help/asana) |
| W-25 | Monday 보드·그룹·아이템·댓글·파일을 이관하되 자동화·수식·의존성·Docs 본문은 제외한다. task/project 보드는 작업/프로젝트 DB로 매핑한다. | 담당자 열 이름을 Owner/임의 이름으로 달리해 수입 → 담당 값 차이 비교. Docs는 원문 링크 기대. | [Monday](https://www.notion.com/help/monday) |
| W-26 | Site custom domain은 유료 owner의 별도 addon이며 기존 소유 도메인을 연결한다. 도메인 판매 기능은 아니다. 정기 청구 주기와 addon 주기가 일치한다. | 테스트 도메인 설정의 DNS 요구/검증 상태 확인 → 결제·DNS 변경 미실행. TLS/전파 지연은 미확인. | [Custom domain](https://www.notion.com/help/connect-a-custom-domain-with-notion-sites) |
| A-24 | default teamspace 지정은 restricted member를 제외한 기존/신규 멤버를 자동 가입시킨다. default 해제 시 멤버 제거가 문서에 명시된다. | 시험 teamspace default 지정/해제 → 기존 직접 멤버·restricted member 비교. 직접 membership 보존 세부는 실측. | [Manage teamspaces](https://www.notion.com/help/manage-teamspaces) |
| A-25 | Enterprise workspace analytics는 가입 이후부터 최대365일의 사용/콘텐츠/AI/검색 데이터를 제공한다. 위임 관리자 범위와 일반 사용자의 Content 접근이 다르다. | O/일반/범위제한 관리자 화면 비교 → CSV 출력 대상 비교. 집계 지연·opt-out의 영향 미확인. | [Workspace analytics](https://www.notion.com/help/workspace-analytics) |
| A-26 | Enterprise 연결 설치 정책은 제한 없음/승인+추천/승인만으로 나뉜다. owner가 새 연결을 설치하면 승인 목록에 추가된다. | 승인하지 않은 시험 연결을 멤버가 설치 시도 → owner 승인 후 재시도. 기존 설치 소급 차단과 데이터 접근은 미확인. | [Connection settings](https://www.notion.com/help/enterprise-connection-settings) |
| A-27 | Enterprise owner와 파트너 도구 관리자가 보안 연결을 설정한다. DLP는 민감 데이터 감지 후 알림/마스킹/접근 제한을 수행할 수 있다. | 합성 탐지 문자열을 전용 공간에 넣고 시험 DLP 연결 → 탐지/조치/감사 확인. SIEM·eDiscovery별 모든 공급자 설정은 미완료. | [Security connections](https://www.notion.com/help/add-security-and-compliance-integrations) |
| A-28 | 조직 설정에서 workspace 분리와 계약 과금 제거는 별개다. 다중 workspace Enterprise에서 전자는 정책 연결을 끊지만 청구는 자동 중단하지 않는다. | 분리 확인 대화상자의 영향 확인 → 취소. 계약 제거는 담당팀 경로 확인만 한다. 실제 이전/청구 종료 미실행. | [Remove workspace](https://www.notion.com/help/remove-a-workspace-from-your-organization-or-contract) |
| A-29 | Windows 배포는 NSIS silent/custom path를 지원하며 문서상 자동업데이트 끄기는 불가하다. macOS는 공용/사용자별 설치 및 x64/arm64/universal 빌드가 다르다. | 격리 VM 설치/업데이트/제거 → 다른 OS 사용자 캐시 분리 확인. 앱 바이너리 자체 분석은 미수행. | [Windows](https://www.notion.com/help/deploy-notion-for-windows), [macOS](https://www.notion.com/help/deploy-notion-for-macos) |
| A-30 | Enterprise Intune MAM은 장치 전체 대신 앱 데이터를 관리한다. 복사/캡처/공유/백업 제한, PIN·재인증, offline grace, 선택 삭제 등이 있다. | 전용 관리 모바일에 정책 배포 → 노션→비관리 앱 복사 → selective wipe. 정책 적용과 개인 데이터 분리 검증 필요. | [Intune](https://www.notion.com/help/set-up-microsoft-intune-with-notion-ios-and-android) |
| A-31 | 알림은 앱 활동 여부와 email/push 설정에 영향을 받는다. Always send email은 비활성일 때만 메일 보내는 기본 조건과 다르다. 회의 감지 알림도 별도다. | 앱 활성/비활성에서 동일 멘션 발생 → 이메일 항상 보내기 전환 → 채널별 수신 시각 비교. OS 알림 차단을 별도 기록. | [Notifications](https://www.notion.com/help/notification-settings) |
| A-32 | 계정 이름·사진·이메일·보안/환경설정을 편집한다. 이메일 한도는 이 문서 ‘전체5개’와 secondary-email 문서 ‘보조5개’가 충돌한다. | 관리 이메일 화면에서 최대 개수 경계 확인. 본문은 한도를 확정하지 않고 **공식 문서 충돌**로 유지한다. | [Account settings](https://www.notion.com/help/account-settings) |
| A-33 | 계정 삭제 시 혼자 속한 개인 workspace와 유일 관리자 shared workspace가 삭제될 수 있다. 다른 workspace에서는 탈퇴 처리된다. 영향 대상 확인과 이메일 재입력이 있다. | 시험 계정에 단독/복수관리자 workspace 준비 → 삭제 확인 화면까지 → 대상 비교 후 취소. 실제 삭제 미실행. | [Delete account](https://www.notion.com/help/delete-your-account) |
| A-34 | workspace 설정 검색은 이름·설명·위치의 정확 단어를 이용하며 권한 있는 설정만 보여준다. 결과 선택 시 설정으로 이동해 강조한다. 일부 설정은 아직 색인되지 않을 수 있다. | O/E가 export/domain 검색 → 결과·이동 비교. locale 변경과 접근 회수 전파 미확인. | [Workspace settings](https://www.notion.com/help/workspace-settings) |
| A-35 | Free 단독 owner는 블록 무제한, 2명 이상 owner는 workspace1000블록 제한이다. 삭제/Trash 비우기로 누적 사용량이 감소하지 않는다. 유료는 무제한으로 설명된다. | 시험 Free에서 생성/삭제 전후 사용량 비교 → 한도 직전/이후 생성 시도. 계산에 포함되는 DB 행·복제·import를 별도 실측. | [Block usage](https://www.notion.com/help/understanding-block-usage) |
| A-36 | 다운그레이드는 기존 기능을 삭제·중단·읽기전용 등 서로 다르게 제한할 수 있다. 예: Free/Plus의 기존 Custom Agent는 삭제 대신 꺼지고 설정 편집이 제한된다. | 다운그레이드 미리보기→효력일 기록, 실제 시험 공간에서 기능별 읽기/쓰기 확인. 전체 기능 영향표 미완료. | [Plan downgrade](https://www.notion.com/help/plan-downgrade) |
| A-37 | 좌석/라이선스 단위 과금으로 사용자 교체와 좌석 수 증가를 구분한다. 게스트는 페이지 접근이며 멤버 전환은 과금 행위다. | 유료 시험계약의 빈 좌석·추가좌석 초대 미리보기 비교. 실제 결제 없음. 좌석 감소의 정산일은 미확인. | [Members and billing](https://www.notion.com/help/members-and-billing) |
| A-38 | 청구서 조회와 미납 제한이 있다. 플랜과 Notion credits는 별도 invoice이며 credit 미납은 이미 지불한 credit과 일반 플랜 접근을 같이 차단하지 않는다. | 시험 청구서의 플랜/credit 항목·상태 확인 → 미납 시뮬레이션은 공급자 시험환경 없으면 보류. | [Invoices](https://www.notion.com/help/invoices) |
| A-39 | 웹 카드/Apple Pay/Stripe Link와 모바일 구매 관리 경로가 다르다. Android 앱 내 결제 미지원 문구와 Google Play 관리 안내가 공존한다. | 플랫폼별 checkout 진입까지 확인 → 결제 미실행. 구독 결제처에 따른 해지/환불 경로 기록. | [Payment methods](https://www.notion.com/help/payment-methods) |
| A-40 | Business trial은 전문 도메인 팀·웹/데스크톱 조건과30일 기간이 있다. 기존 플랜에 따라 취소 복귀 시점이 다르다. | 적격/비적격 도메인 가입 미리보기 → trial 관리/종료일/취소 안내 확인. 실제 trial 생성은 별도 시험 범위. | [Paid trials](https://www.notion.com/help/paid-plan-trials) |
| A-41 | Education은 개인1멤버와 승인된 학생조직 무제한 멤버 유형이 다르다. 학교 이메일 검증·workspace별 자격과 일반 유료 전환의 자격 상실 조건이 있다. | 적격성 UI·신청 요구 확인 → 실제 신청 미실행. 기관별 승인과 예외는 미확인. | [Education](https://www.notion.com/help/notion-for-education) |
| A-42 | 환불은 workspace owner/billing 이메일과 결제처별 요청 경로를 구분한다. 구독·잘못 추가한 멤버·미사용 credit 조건이 각각 다르다. | 도움말/지원 UI의 요청 경로만 확인. 실제 환불 요청 미실행, 개별 승인 여부 미확인. | [Refunds](https://www.notion.com/help/refunds) |
| A-43 | 세금 적용은 청구 주소·관할·TRN 검증 등에 영향을 받는다. 세금 정보 입력과 면세 요청은 별도 경로다. | 합성 지역 checkout의 필드·유효성 안내만 확인. 실제 세무정보 입력/법률판단 미수행. | [Sales tax](https://www.notion.com/help/sales-tax) |

### 문서 사이의 충돌·실측 필요 항목

- A-21의 ‘보조 이메일5개’와 A-32의 ‘한 계정 전체5개’는 불일치하므로 정확한 최대 개수 미확인으로 수정한다.
- 다단의 태블릿 지원 본문/FAQ, Android 결제 미지원/스토어 관리 안내는 플랫폼·레거시 계약 차이가 가능한 가설이다. 실제 원인은 미확인이다.
- 공식 문서 메뉴 명칭도 Appearance & layout / Customize page, People / Members처럼 플랫폼/요금제에 따라 다르다. 경로 문자열만으로 재현 성공을 판정하지 않는다.
- 초기 미완료 목록 중 template 탐색/판매/현지화, Confluence/Asana/Monday, 앱 배포/Intune, 일부 결제 설정은 위 표로 DOC 분석이 추가되었다. 전체 세부 분기의 미완료 상태는 남아 있다.

## 추가 기능 조사: 모바일·계정 수명·조직 경계

모든 행은 DOC 요약이며 실제 조작은 아직 수행하지 않았다. 법규 관련 행은 제품에 표시되는 계약·설정 상태만 기술하며 법적 적합성 판정이 아니다.

| ID | 확인한 동작·데이터 경계 | 미실행 절차 → 기대 / 미확인 | 공식 근거 |
|---|---|---|---|
| W-27 | 모바일 하단 탐색은 Home/검색/Inbox/새 페이지를 제공한다. workspace 전환과 teamspace·하위페이지 확장이 있으며 키보드 위 도구막대에서 블록·멘션·들여쓰기를 조작한다. | 동일 P를 iOS/Android에서 열어 새 블록·멘션·뒤로가기 → 페이지 계층 유지. OS/앱 버전별 차이는 미확인. | [Mobile workspace](https://www.notion.com/help/workspaces-on-mobile) |
| W-28 | Notion Faces는 로그인 없이 초상 구성·무작위 생성·장식 포함/제외 다운로드가 가능하며 결과를 프로필 이미지로 올릴 수 있다. 별도 생성물과 계정 프로필을 구분한다. | 합성 얼굴 구성 → 두 다운로드 비교 → 시험계정 사진 업로드. 저장 해상도·계정간 재편집은 미확인. | [Faces](https://www.notion.com/help/notion-faces) |
| W-29 | 공급자 백업과 사용자 export는 별개다. export는 접근 불가 페이지를 제외하며 링크는7일 유효하다. 공식 본문의 workspace PDF 안내에는 **2026-08-31까지 제거**한다는 공지가 있다. 개별 페이지 PDF는 유지한다고 명시한다. | O/V가 같은 workspace export → 파일·첨부·sitemap·누락 비교 → 링크 만료 확인. 현재 전체 PDF 메뉴의 실제 제거 여부 미확인. export ZIP을 완전 복구 백업으로 보장하지 않는다. | [Back up data](https://www.notion.com/help/back-up-your-data) |
| W-30 | 서비스 제공자 프로필은 listing/lead 수신 상태를 제어한다. 최대30명 중 owner1명·admin·member가 다른 편집 권한을 가진다. 문의 수락→예약 링크 메일, SOW/청구서 기반 프로젝트 기록 흐름이다. | 시험 프로필 역할별 수정 버튼 비교 → lead 수신 설정 저장. 실제 고객 연락·프로젝트 등록은 수행하지 않는다. | [Offer services](https://www.notion.com/help/offering-services-on-marketplace) |
| W-31 | Marketplace featured 선정에는 품질·활용도·인기도·가격 등 편집 판단이 있다. 템플릿 작성자의 콘텐츠 소유권과 Notion 서비스 기능 소유권은 분리된다고 약관이 설명한다. | listing의 추천 배지·노출 위치를 비교. 자동 추천 공식·심사 SLA·판매자 appeal UI는 미확인. | [Featured](https://www.notion.com/help/getting-featured-in-the-template-gallery), [Marketplace terms](https://www.notion.com/help/template-gallery-guidelines-and-terms) |
| A-44 | restricted member는 private 페이지·권한 범위 AI·SSO·그룹 사용이 가능하지만 기본 teamspace를 포함해 명시적 초대가 필요하다. 일반 member처럼 과금된다. role과 page ACL은 별개다. | 동일 P에 일반/restricted/guest 초대 → default teamspace와 private 생성 비교. temporary member 만료의 모든 세부 분기는 미확인. | [Workspace roles](https://www.notion.com/help/whos-who-in-a-workspace) |
| A-45 | workspace 전환기는 로그인 이메일별 workspace를 보여주며 생성/가입과 허용 도메인 기반 가입 후보를 제공한다. 계정과 workspace는 다대다 경계다. | 테스트 이메일2개로 로그인 → workspace 생성·전환 → domain 후보 확인. 중복 이름·초대 만료 분기는 미확인. | [Create and switch](https://www.notion.com/help/create-delete-and-switch-workspaces) |
| A-46 | Free 계정5년 비활성은 휴면 삭제 대상일 수 있으며30일 이메일 통지/재활성화 기간이 있다. 관리 계정·유료 관련 계정 등 예외가 있고 workspace는 모든 owner의 휴면에 좌우된다. | 정책 상태·통지 예시 확인, 실제5년 경과 시험은 불가. 로그인/보기/편집 등 활동별 갱신 내부 시각은 미확인. | [Dormant account](https://www.notion.com/help/dormant-account-policy) |
| A-47 | 조직이 부여한 계정의 데이터와 Enterprise workspace 데이터는 owner 접근/통제 대상일 수 있다. Private 표시는 조직 관리자에게도 절대 비공개라는 뜻으로 사용하면 안 된다. | 시험 Enterprise owner의 콘텐츠 검색과 멤버 private P 결과 비교. 계약·역할·이동 제한별 구체 범위는 A-10과 함께 실측한다. | [Owner data access](https://www.notion.com/help/data-accessible-by-your-workspace-owner) |
| A-48 | 기업 네트워크에서 Notion 도메인/IP를 허용하는 설정과 Notion 쪽 IP 제한은 반대 방향이다. 자체 호스팅 연결에 대한 Notion발 요청 범위도 별도다. | 시험 프록시에서 앱→Notion과 Notion→시험 연결을 구분해 로그 확인. IP 값은 공식 목록을 실행 시 재조회하며 영구 상수로 확정하지 않는다. | [Allowlist IP](https://www.notion.com/help/allowlist-ip) |
| A-49 | GDPR 도움말은 export/import·workspace 삭제 도구를 연결하며 삭제 직후 접근 차단과30일 후 서버 삭제를 설명한다. Privacy는 Customer Data와 계정/분석 정보를 구분한다. | 삭제 확인 화면의 범위와 보존 안내를 비교 후 취소. 실제 백업 파기·규정 적합성은 이 조사로 검증할 수 없다. | [GDPR](https://www.notion.com/help/gdpr-at-notion), [Privacy](https://www.notion.com/help/privacy) |
| A-50 | Enterprise HIPAA 설정은 BAA 검토/수락 후 활성 상태와 이메일 확인을 제공하고 비활성 경로도 있다. Beta 기능은 BAA 범위 밖이라고 명시한다. | 계약 승인 없이 Activate 화면까지만 확인 → 취소. 합성 데이터로 상태 UI를 조사하며 PHI는 사용하지 않는다. | [HIPAA configuration](https://www.notion.com/help/hipaa) |
| A-51 | 공개 웹페이지 방문자는 Report page에서 유형/설명을 제출할 수 있고 DMCA 유형은 별도 안내로 이동한다. 제출은 검토 큐를 만들며 즉시 삭제와 같지 않다. | 합성 공개 페이지의 신고 대화상자·분기 확인 → 제출 없이 취소. 처리 시간·이의제기·반복 신고 제한 미확인. | [Report content](https://www.notion.com/help/report-inappropriate-content) |
| A-52 | 보안 책임 문서는 공급자의 시스템 운영과 고객의 계정/workspace/데이터 통제를 구분한다. 관리 콘솔 설정만으로 모든 운영 책임이 자동 이행된다고 해석하지 않는다. | A-06~A-15의 설정 소유자와 외부 IdP/보관 설정 주체를 대조. 실제 공급자 내부 운영은 미관찰. | [Shared responsibilities](https://www.notion.com/help/shared-responsibilities-model) |
| A-53 | Enterprise의 복수 IdP는 각각 SAML configuration·ACS URL·Config ID를 가진다. SCIM IdP 연결은 사용자 생성/제거·속성·그룹 membership을 동기화한다. 인증과 provisioning은 다른 상태다. | 전용 IdP 두 개의 도메인 매핑 → 로그인 → IdP 사용자 비활성 → 세션/그룹 변화 비교. 공급자별 지연·충돌 정책 미확인. | [SAML IdP](https://www.notion.com/help/set-up-identity-provider-for-saml-sso), [SCIM IdP](https://www.notion.com/help/set-up-identity-provider-for-scim) |
| A-54 | Enterprise org owner는 DNS 증명으로 이메일 도메인을 claim한다. Pending/Verified 상태와 수동 재검증이 있고 확인된 도메인을 하나 이상의 SAML 설정에 연결한다. | 별도 시험 도메인의 코드 생성 → DNS 적용 → Verify → 잘못된 코드 상태 비교. 실제 소유 도메인 변경 없이 절차만 정의. | [Domain management](https://www.notion.com/help/domain-management) |
| A-55 | 플랜은 workspace 단위이며 한 계정의 workspace마다 다를 수 있다. Plus 등 제공 여부가 workspace에 따라 다를 수 있다고 명시한다. Startup은 자격별 Business1/3/6개월 신청/승인 경로다. | 두 workspace의 plan selector 비교 → 할인/체험 종료일 표시 확인. 결제·프로모션 신청은 미실행, 현재 금액과 전체 지역 차이는 미확인. | [Change plan](https://www.notion.com/help/upgrade-or-downgrade-your-plan), [Startups](https://www.notion.com/help/notion-for-startups) |

## 최종 범위 집계와 남은 증거

이 파일은 **C-01~C-15 15개, W-01~W-31 31개, A-01~A-55 55개, 관리 API 보완 전 소계101개 조사 단위**를 가진다. C-14는 접근성 탐색 시험 영역이며 적합성의 DOC 확인을 뜻하지 않는다. 모든 단위의 OBS/런타임 실행 수는0이다. 초기45개와 이후 추가분을 합친 수이며 노션 전체 원자 기능 수 또는 완성도 백분율이 아니다. 위 초기 출처 장부 이후 읽은 출처는 각 표의 직접 링크로 추적한다.

- 아직 필요한 것은 역할×플랜×웹/데스크톱/모바일×온라인/오프라인의 실제 상태 전이 증거다. 메뉴 존재와 요금제 문서만으로 충돌 해결·데이터 보존·성능을 확인했다고 쓰지 않는다.
- importer는 대표별 동작을 조사했지만 모든 개별 포맷·중첩 구조·첨부·날짜/사용자 매핑·재수입 손실 행렬은 미완료다. 스크린리더/IME/접근성 적합성, restore 충돌, 퇴사자/검증 소유권 이전, 네트워크 장애 재시도도 미확인이다.
- 공급자별 SAML/SCIM 설정 화면 전체, 계약별 role/정책 예외, 실제 금액·세금·환불·정산, 파트너 인증/자격 심사와 강제 조치의 운영 절차는 세부 분석 미완료다. 교육 자격 오류 등 중복 troubleshooting 가이드는 기능의 별도 구현 요구로 중복 계수하지 않았다.
- DB property 접근·Verification schema·automations·AI/agent 보안·Calendar/Mail은 다른 도메인 보고서와 교차 확인해야 한다. 본 파일에서 그 하위 기능을 완료했다고 대신 주장하지 않는다.
- 종료된 workspace PDF 안내, 보조 이메일 한도, 태블릿 다단, Android 결제 안내처럼 공식 자료의 충돌/전환 상태는 실측 전까지 해결된 것으로 처리하지 않는다.

## 관리 API와 감사 이벤트의 기능 경계

### A-56 조직 Admin API 인증·버전·scope

- **DOC:** Enterprise org owner가 조직 bot/token을 만들며 일반 workspace content token과 구분된다. base URL은 `https://api.notion.com/admin`, JSON/HTTPS이며 `Notion-Version: 2026-06-01`이 필수다. read/write/write-high-impact/export는 독립 capability다. user/permission-group scope는 일부 적격 Enterprise 조직에만 제공된다. admin token에는 사용자 로그인 IP 제한을 적용할 수 없다고 도움말이 명시한다.
- **실행:** 전용 read-only 토큰으로 목록→write 시도→권한 오류→토큰 폐기 후 재조회. **기대:** scope 분리와 폐기 효력, audit actor가 조직 bot. 실제 토큰 생성/호출은0건이며 rate-limit·회전 유예·전파 지연 미확인.
- 근거: [Admin help](https://www.notion.com/help/admin-apis-for-enterprise-organizations), [Introduction](https://developers.notion.com/reference/admin/intro), [Scopes](https://developers.notion.com/reference/admin/scopes), [Versioning](https://developers.notion.com/reference/admin/versioning).

다음 표는 대표 endpoint의 문서 본문/요청 schema를 읽은 DOC 분석이다. 나머지 family의 존재를 아는 것과 모든 필드·에러를 검증한 것을 구분한다. destructive 호출을 실제로 실행하지 않았다.

| ID | API 군의 기능·경계 | 미실행 절차 → 기대 / 미확인 | 직접 확인 근거 |
|---|---|---|---|
| A-57 | 사용자 목록은 active member/restricted member/guest bot을 포함하지만 page guest와 만료 temporary member는 제외한다. 검색·개별 조회 parameter는 지원하지 않으며 avatar는현재null이다. 관리 사용자 session revoke는 별도 scope다. | page size1로 전체 순회 → UI 역할별 대조 → 테스트 managed-user session revoke. 누락이 곧 계정 삭제라고 해석하지 않는다. 모든 응답 필드/이메일 누락 조건 미확인. | [List users](https://developers.notion.com/reference/admin/list-users), [Revoke sessions](https://developers.notion.com/reference/admin/revoke-user-session) |
| A-58 | permission group CRUD와 직접 membership/owner 역할 관리가 있다. 생성 이름은 대소문자 구분 동일값 충돌409, restricted member는owner불가, guest membership불가. SCIM-managed membership 수정은 IdP로 해야 하며409다. | 같은 이름/대소문자 다른 이름 생성→restricted owner 변경→SCIM그룹 직접 추가. 각각 충돌/제약 기대. 모든 delete·nested group·권한전파 schema 미확인. | [Create group](https://developers.notion.com/reference/admin/create-permission-group), [Add member](https://developers.notion.com/reference/admin/add-permission-group-member), [Update member](https://developers.notion.com/reference/admin/update-permission-group-member) |
| A-59 | agent inventory는 생성자/시간/상태/연결/모델/공유 대상을 필터하고 기본25·최대100건이다. 공유 필터는 autofill agent를 제외한다. 관리 API는 사용량·한도·공유·생성정책·삭제·활성 제어 family를 가진다. disable은 다른 pause원인을 덮어쓰지 않으며 재활성 요청 성공 뒤에도 credit 한도로 paused일 수 있다. | active/admin-disabled/credit-paused 합성agent에 상태 전환→admin_status/run_status 비교. workspace정책 우선과validation_error확인. 모든 usage집계·permission patch semantics 미확인. | [Inventory](https://developers.notion.com/reference/admin/get-workflows-metadata-for-space), [Status](https://developers.notion.com/reference/admin/update-agent-status), [Permissions](https://developers.notion.com/reference/admin/update-agent-permissions), [Delete](https://developers.notion.com/reference/admin/delete-agent) |
| A-60 | PAT목록은 active/expired/revoked 메타데이터이며 비밀값을 반환하지 않는다. revoke는 목록id를bot_id로 받고 API/Workers 인증을 영구 차단한다. 반복 revoke는빈 응답으로 유지된다. | 합성PAT 목록→revoke→같은PAT read→재revoke. 토큰 본문은 증거에 저장하지 않는다. 조직 밖/불일치 대상은 같은not-found 기대. | [PAT list](https://developers.notion.com/reference/admin/list-personal-access-tokens), [PAT revoke](https://developers.notion.com/reference/admin/revoke-personal-access-token) |
| A-61 | MCP목록은 멤버OAuth연결이며 internal connection은 제외한다. 사용자×client가 여러workspace로 묶이고 enterprise-managed/issuer차이는분리된다. revoke는현재token만 제거하며 정책상 재연결 가능하다. enterprise-managed deny는사용자×workspace에향후연결차단을 적용하며 일반사용자OAuth에는적용되지않는다. | 시험client연결→revoke→재연결→enterprise-managed deny/allow. 식별에는name대신client.key 사용. 다른조직ID는목록빈결과/변경not-found 기대. | [MCP list](https://developers.notion.com/reference/admin/list-mcp-client-connections), [Revoke](https://developers.notion.com/reference/admin/revoke-mcp-client-connection), [Managed access](https://developers.notion.com/reference/admin/update-mcp-client-connection-enterprise-managed-access) |
| A-62 | workspace export는export_job_id를받는비동기작업이다. 형식은html/markdown, 대행사용자email필수이며 댓글·파일포함·teamspace·현재/all view·locale/timezone옵션이있다. PDFenum은없다. | 합성workspace export→status조회→산출물대조. 사용자접근범위/실패재시도/서명URL만료는실측전미확인. | [Enqueue export](https://developers.notion.com/reference/admin/enqueue-space-export), [Export status](https://developers.notion.com/reference/admin/get-space-export-status) |
| A-63 | legal hold생성은이름/시작시각/사용자IDs/생성·편집·열람interaction목록을받는다. active/released상태와포함사용자/workspace관계가있다. 목록·조회·수정·사용자추가제거·페이지/workspace목록·export·release family가존재한다. | 전용합성hold에사용자추가→P편집→포함페이지조회→export→release. 생성schema만상세확인했으며family의모든필드·보존충돌·export원본동등성은미확인이다. | [Create legal hold](https://developers.notion.com/reference/admin/create-legal-hold), [공식 API 목록](https://developers.notion.com/llms.txt) |
| A-64 | analytics report는user_activity/content_pages/ai_usage구분, CSV/JSONL, 날짜범위·timezone·version과queued/running/completed/failed/expired상태를갖는다. 목록scope는AI/user/content중허용된옵션이다. | 전용report목록→세유형별조회→기간경계·expired상태비교. 각보고서download/집계정의·PII마스킹필드는미분석이다. | [Reports](https://developers.notion.com/reference/admin/list-analytics-reports) |
| A-65 | Enterprise SIEM은외부webhook이고audit는관리대시보드기록이다. SIEM이벤트는audit이벤트에대응하지만역방향전체동등성은보장하지않는다. page/data source/workspace/account/teamspace/form군을갖고audit는organization군도표시한다. 일부DB동작은역사적으로page이벤트다. 콘텐츠·댓글수정은분당합쳐질수있고team_ids는없을수있다. | 합성P편집여러회/이동/공유/삭제→UIaudit와SIEM수신대조. 재전송·순서·중복·서명검증·전체이벤트payload는미검증이다. | [Compliance](https://developers.notion.com/compliance/overview), [SIEM events](https://developers.notion.com/compliance/siem-events), [Audit events](https://developers.notion.com/compliance/audit-log-events) |

관리API는 이 파일이 담당한다. A-56~A-65 추가 후 **최종 조사 단위는111개(C15+W31+A65)**다. API family의 존재·대표동작을 분석했지만 모든endpoint계약을검증한것은아니다. 전체endpoint의필수필드/오류/멱등성/재시도/페이지네이션행렬은후속검증대상이다. 런타임실행0건이라는상태는변하지않는다.
