# Slacord 문서 플랫폼 교체

> 2026-10-26: 사용자가 구현 진행과 노션에 익숙한 동작·디자인·레이아웃을 요청했다. [실제 화면·구현 범위·실행 방법](implementation-review.md)에서 이번 웹 변경을 확인할 수 있다. 아래 초기 코어 설명은 그대로 실험 상태이며 전체 기능 구현을 의미하지 않는다.

> 2026-10-20 범위 변경: 사용자 요청에 따라 통합 설계·구현은 보류한다. 먼저 [노션 전체 기능 조사](../notion-analysis/README.md)를 수행한다. 아래 문서와 코드는 선행 실험 기록이며 확정 통합안이 아니다.

상태: **M0 분석 및 M1의 속성 코어 착수**. 기존 문서 UI/API 교체, 전체 기능 동등성, 데이터 이관은 아직 완료하지 않았다.

## 산출물

- [전체 기능 지도와 인수 기준](notion-capability-matrix.md): 31개 기능군, M0–M5.
- [현재 구현과 목표 구조](architecture.md): 코드 근거, 설계 선택, 권한·저장·이관 경계.
- [REA 관찰 기록](rea-investigation.md): 실제 캡처와 로그인 후 미확인 사항.
- [속성 코어](../../packages/document-core/src/index.ts): 자체 모델 및 순수 검증 함수.
- [코어 테스트](../../packages/document-core/test/schema.test.cjs): 17개 회귀·경계 시나리오.

## 실행 및 검증

기존 Yarn workspace 의존성이 설치되어 있으면:

```sh
yarn test:document-core
```

전체 모노레포 설치 없이 코어만 검증하려면:

```sh
npx -y -p typescript@5.7.3 tsc -p packages/document-core/tsconfig.json
node --test packages/document-core/test/schema.test.cjs
```

`verify:full`에도 코어 테스트를 추가했다. 이번 작업에서는 코어 빌드·테스트만 실행했으며 MongoDB/MinIO/웹/데스크톱을 포함한 전체 검증은 실행하지 않았다.

## 이번 구현의 정확한 경계

`@slacord/document-core`는 아직 기존 서버·웹에 연결하지 않은 독립 패키지다. 기존 에디터를 대체했다고 해석하면 안 된다.

- 구현: source 스키마/컨테이너/행 페이지 계약, 고정 속성 ID, 스키마 revision 검사, 값 검증, 계산·시스템 속성의 사용자 쓰기 차단.
- 부분 구현: 텍스트 run은 plain text만, 날짜는 date-only/offset-aware timestamp 범위만 지원. mention/annotation/timezone ID는 아직 지원하지 않으며 조용히 버리지 않고 거부한다.
- 정의만 있음: formula/rollup 설정과 read-only 규칙. 계산 엔진·자동 재계산은 없다.
- 미구현: source/row/view 저장과 HTTP API, query engine, 속성 권한, 공동 편집, 나머지 속성·뷰·확장점. `place`, `button`, `verification` 등은 전체 기능 지도에서 계속 추적한다.
- 검증 함수는 인증·인가·참조 존재 검사를 대신하지 않는다. `validateSchema`의 입력은 내부 typed schema이며 API의 untrusted JSON decoder도 다음 단계에 필요하다.

## 다음 구현 순서

1. 테스트 노션 워크스페이스에서 source/속성/뷰/권한 동작을 REA로 관찰하고 fixture 확정.
2. typed schema의 JSON decoder, schema CRUD와 row CRUD, revision CAS·team/source/row 인가 및 자원 참조 검사.
3. 새 API를 사용하는 테이블 편집 화면으로 수직 통합. 생성→속성 추가→행 편집→재접속→권한 차단 E2E.
4. query/view, relation/rollup/formula, 공동 편집, 고급 뷰·자동화·확장 및 운영 이관.

전체 제품 범위를 줄이지 않는다. 단계 완료와 제품 전체 완료를 구분한다.
