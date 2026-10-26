# 노션 전체 기능 분석

**현재 상태: 분석 진행 중. 공개 문서의 기능·동작·제약을 정리하고 있으며, 로그인 후 REA 관찰·경계 검증은 미수행이다.**

분석 기준일은 2026-10-20이다. 이 묶음은 노션 자체를 분석한다. Slacord에 무엇을 어떻게 통합할지는 이 분석 이후에 별도로 판단한다.

## 읽는 순서

| 문서 | 내용 |
|---|---|
| [콘텐츠·협업·관리](01-content-collaboration-admin.md) | 페이지/블록/서식/표/임베드, 탐색·검색·wiki, 댓글·이력·오프라인, 권한·계정·조직·보안·게시·가져오기/내보내기 |
| [데이터베이스·속성·수식](02-databases-properties-formulas.md) | source·스키마·행, 속성 종류와 값, 뷰·폼·레이아웃, 필터·정렬·그룹, 관계·롤업·수식, 프로젝트/스프린트 |
| [AI·자동화·API·앱 생태계](03-ai-automation-api-calendar-mail.md) | Agent·Skills·Connectors·Meeting Notes, 자동화·버튼, REST/MCP/Workers/CLI, Calendar/Mail/클라이언트·Marketplace |
| [실제 동작 조사 절차](04-runtime-research-protocol.md) | 증거 수준, 합성 데이터, 역할/plan/클라이언트 기록, 교차 기능 시나리오 48개 |
| [상충·출시 상태·한계](05-evidence-conflicts-and-availability.md) | 문서 차이, beta/예정/캐시·종료 정보, 현재 확정할 수 없는 사항 |
| [조사 범위 추적표](06-coverage.md) | 카탈로그·분석 식별자·보고서 인용의 실제 수와 의미 |

## 이번 분석의 범위

단순히 에디터나 위키만 대상으로 하지 않는다.

1. **작성:** 블록·서식·중첩·이동/복제·다단·표·코드·수식·파일·미디어·동기화 블록·프레젠테이션.
2. **정보 구조:** 페이지·workspace·teamspace·탐색·검색·home·library·wiki·검증·참조.
3. **구조화 데이터:** database·source·행 페이지·모든 공개 속성 유형·뷰·레이아웃·집계·필터·수식·관계.
4. **업무 흐름:** forms·templates·반복·하위 항목·의존성·projects/tasks/sprints·buttons·automations.
5. **협업:** 멘션·reminder·댓글·알림·읽기·권한·history·trash/archive·offline·동시 수정.
6. **배포·이동:** 공개 Sites·도메인·검색색인·templates/Marketplace·import/export·클라이언트별 차이.
7. **AI:** 개인/공유/외부 에이전트·검색·autofill·회의·이미지·skills·connectors·모델·실행 승인·credits.
8. **개발 플랫폼:** API 객체·인증·capabilities·query·pagination·files·webhooks·MCP·Workers·CLI·agent APIs.
9. **조직 운영:** 회원·guest·group·도메인·SSO·SCIM·MFA·정책·감사·보존·거주지·plan/billing.
10. **관련 제품:** Calendar, Mail의 현재/과거 상태, 데스크톱·모바일·브라우저 확장.

별도 앱·beta·과거 기능은 구분해서 포함한다. 공개된 기능 목록의 범위를 넘어 비공개 기능 플래그까지 조사했다고 주장하지 않는다.

## 무엇을 실제로 확인했는가

- 공식 도움말 **26개 분류**, 일반 도움말 **275개**, 보충 가이드 **144개**, 개발자 문서 **254개**의 링크 목록을 확보했다.
- 분야별 보고서에 기능별 동작·제약·조건·출처·미확인 질문을 기록했다. 개별 보고서의 DOC/DISC/CATALOG/UNKNOWN을 함께 읽어야 한다.
- 기존 REA 로그인 캡처 1건을 재사용했다. **인증 후 기능 실행·API 호출·동시 편집 실험은 0건**이다.
- 새로운 원격 디버깅 Chrome 실행은 정책으로 거부되어 번들 분석까지 진행되지 않았다.

**673개 링크를 확보했다는 것은 673개 문서를 전부 분석했거나 673개 기능을 검증했다는 뜻이 아니다.** 보충 가이드·중복/legacy API·개별 endpoint는 같은 기능을 여러 관점에서 설명한다. 반대로 한 도움말 문서에 여러 기능이 있을 수 있다.

## 보고서의 증거 해석

- **DOC:** 공식 문서 본문의 설명. 특정 계정의 실제 동작 보증이 아니다.
- **DOC-CACHED:** 공식 출처의 검색 snapshot만 확인된 설명. 현재 지원을 단정하지 않는다.
- **DISC / CATALOG / INDEXED:** URL 또는 기능 표면을 발견했지만 세부 검토가 부족하다.
- **OBS / VERIFIED:** 실제 실행 증거/반복 검증. 현재 로그인 후 기능에는 이 상태가 없다.
- **UNKNOWN:** 자료 상충·누락 또는 실험이 필요한 항목.

문서에서 제공하지 않은 서버 구조·알고리즘을 사실로 채우지 않는다. UI와 공개 API의 기능 차이, 소유자와 실행자의 권한 차이, 원본과 연결된 view의 설정 차이를 구분한다.

## 아직 끝내지 못한 분석

- 로그인된 테스트 workspace에서 페이지·속성·뷰·수식·권한·자동화의 실제 결과.
- schema 타입 전환·빈 값·오류·동시 수정·오프라인·restore·연쇄 실행의 경계.
- 요금제별 기능 가용성과 Enterprise/초대형 beta 기능.
- 문서 상충과 직접 본문이 사라진 기능의 현재 상태.
- source ledger의 미검토 항목 및 보고서가 명시한 부분 분석 영역.

이를 해소하기 전에는 전체 REA 분석 완료, 노션 완전 명세, 재구현 준비 완료로 표시하지 않는다.

## 재현 자료와 이력

- [원본 출처 카탈로그](source-catalog.json)
- [출처·분석 ID 추적 JSON](coverage-ledger.json)
- [카탈로그 수집 스크립트](research-tools/collect_catalog.py)
- [추적표 생성 스크립트](research-tools/build_coverage.py)
- [출처 접속 검사](source-access-check.json): HTTP 응답·redirect·본문 제목·hash. 주장 자체나 제품 동작의 검증은 아니다.
- [출처 검사 스크립트](research-tools/verify_sources.py)
- 로컬 기존 증거: `.rea/notion-login-evidence.json` (gitignored)
- Obsidian: `D:/develop_brain/10_Projects/slacord/01_Tasks/TASK-20261020-003__notion-full-feature-analysis.md`

이전 `docs/document-platform/`와 `packages/document-core/`는 초기 실험 기록이다. 이번 분석의 완료 근거로 사용하지 않으며 추가 구현을 보류했다.
