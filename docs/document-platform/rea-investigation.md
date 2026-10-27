# REA 조사 기록

조사일: 2026-10-20. 분석 도구: 공식 `rea-agents@6.7.0`.

## 실행 환경

시스템 기본 Node v22.16.0은 해당 REA의 요구 버전보다 낮았다. 기본 Node나 전역 에이전트 설정을 수정하지 않고 npm 임시 패키지 실행으로 Node 22.22.0을 사용했다.

```powershell
npx.cmd -y -p node@22.22.0 -p rea-agents@6.7.0 rea capture-browser-scenario docs/document-platform/scenarios/notion-login.json --format json
```

실행 계약은 설치된 REA의 `--schema`, `--help`, bundled `browserScenarioValues.js`로 확인했다. MCP 등록은 하지 않았으며 이번 조사는 CLI를 통해 수행했다.

## OBS-001: 인증 전 진입 경계

- 시나리오: [notion-login.json](scenarios/notion-login.json)
- 브라우저: Chrome/Chromium `155.0.8059.80`, headless, 빈 임시 프로필.
- 동작: `https://www.notion.so/login`으로 이동 후 4초 대기, 최종 URL·accessibility capture.
- 결과: `https://app.notion.com/login`으로 이동. 로그인 화면이 렌더링됨.
- Evidence ID: `ev_60d0df78ceec3031f716d0ca86b1135a86f9622bb821628de1f46e74cc0dd7a6`
- 로컬 원본: `.rea/notion-login-evidence.json` (gitignored).
- cleanup: `terminated-owned-process`.
- 판정: **실제 관찰**. 문서/데이터베이스 내부 동작을 확인한 증거는 아니다.
- 한계: 인증 후 대상 미선택. 네트워크 본문·storage·script source는 요청하지 않았다. 렌더링된 login에만 관찰 범위가 있다.

## 로그인 후 필요한 관찰

테스트 워크스페이스 사용 가능 여부를 사용자에게 질문한 상태다. 세션이 준비되면 아래 작업을 합성 데이터로 수행한다. 비밀번호·토큰을 문서에 기록하지 않는다.

| case | 준비 및 작업 | 확인할 상태 변화 | 현재 상태 |
|---|---|---|---|
| SOURCE-01 | 작업/프로젝트 source 2개, 연결 뷰 생성 | 원본 행 identity 공유와 view 설정 분리 | 미관찰 |
| SCHEMA-01 | 속성 생성→이름 변경→타입 변경→복원 | 값·필터·수식 참조와 실패 처리 | 미관찰 |
| VALUE-01 | 모든 속성의 빈 값/범위/복수 값/삭제 | 저장·재접속·표현 일치 | 미관찰 |
| CALC-01 | 양방향 relation, rollup, formula | 변경·삭제·순환·오류·권한 제한 시 계산 | 미관찰 |
| VIEW-01 | 전체 view/filter/sort/group | 동일 데이터의 편집 전파와 사용자 설정 | 미관찰 |
| ACL-01 | 관리자/편집자/뷰어/게스트 | page/source/property/read/export 경계 | 미관찰 |
| COLLAB-01 | 두 세션에서 중첩 블록 동시 수정 | merge/undo/reconnect/재접속 결과 | 미관찰 |
| AUTO-01 | 버튼과 속성 변경 trigger | 재귀·중복·실패·실행자 권한 | 미관찰 |

공식 문서 조사와 실제 관찰을 구분한다. [기능 지도](notion-capability-matrix.md)의 DOC는 실제 클릭 재현이 아니며 OBS-001은 제품 기능 동등성을 입증하지 않는다.

## 재현·데이터 관리

- 시나리오 JSON은 repo에 저장하되 sample data만 사용한다.
- 인증된 세션은 사용자가 선택한 테스트 탭의 정확한 loopback CDP target만 사용한다.
- 원시 캡처는 `.rea/`에 두고 공유 문서에는 필요한 비민감 근거만 요약한다.
- 로그인 후 편집기·속성·뷰 조사 완료 전 전체 REA 분석 완료로 표시하지 않는다.
