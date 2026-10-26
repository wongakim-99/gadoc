# 출처 상충·출시 상태·분석 한계

기준일: 2026-10-20. 제품의 실제 워크스페이스별 동작은 아직 검증하지 않았다.

## 주장별 확인 경계

| ID | 확인한 자료 | 분석상 처리 | 필요한 재확인 |
|---|---|---|---|
| E-001 | [2026-10-19 발표](https://www.notion.com/blog/notion-ai-more-for-less)는 Skills via MCP와 AI Command Center를 예정으로 설명한다. [Skills MCP 개발 문서](https://developers.notion.com/guides/mcp/notion-skills)는 생성·변환·다운로드 도구 사용법을 제공한다. | 문서 존재와 모든 사용자에게 기능이 출시됐다는 것을 구분한다. 두 문서가 서로 다른 rollout/접속 표면을 설명하는지 불명확하다. | 선택한 계정의 실제 tool 목록, 연결 종류, beta/cohort, 제품 UI |
| E-002 | 같은 [발표](https://www.notion.com/blog/notion-ai-more-for-less)는 새 credit 체계에 신규/기존 고객의 적용 시점 차이를 명시한다. | 현재 plan 이름만으로 credit 동작을 확정하지 않는다. 계약/cohort/시점도 기록한다. | 실제 workspace의 credits/usage 화면 |
| E-003 | 같은 발표는 개인 Agent의 구독 연결과 Enterprise BYOK private alpha를 구분한다. | 개인 Agent, Custom Agent, Enterprise BYOK를 하나의 보편 기능으로 합치지 않는다. | 실제 접근 가능 표면·관리자 설정 |
| E-004 | [Mail 시작 문서의 직접 URL](https://www.notion.com/en-gb/help/get-started-with-notion-mail)은 도움말 홈으로 redirect됐다. 일부 공식 검색 snapshot에는 종료 공지가 남는다. | redirect만으로 종료를 단정하지 않는다. 검색 snapshot은 DOC-CACHED로 분리한다. 자세한 근거는 AI/생태계 보고서에 기록한다. | 직접 열람 가능한 종료 공지 또는 사용자 계정에서 상태 확인 |
| E-005 | [API versioning](https://developers.notion.com/reference/versioning)은 호환 추가·링크·cursor·rate limit 변경이 고정된 버전에서도 발생할 수 있다고 설명한다. | API header만 같으면 모든 결과가 고정된다는 가정을 하지 않는다. UI·MCP·SDK 버전을 따로 기록한다. | API 응답·실험 시각·beta header·실제 SDK 버전 |

위 표는 자료 사이의 차이와 검증 질문이다. 어떤 문서가 틀렸다고 단정한 결론이 아니다.

## 자료의 우선순위

1. 해당 계정·버전·행동에 대한 실제 관찰은 그 환경에 한해서 동작을 입증한다.
2. 공식 API 계약은 지정 endpoint/버전의 공개 계약을 설명한다. UI의 모든 기능을 대표하지 않는다.
3. 공식 도움말은 제품 동작과 설정 경로를 설명하지만 beta·plan·rollout은 별도 확인한다.
4. 공식 release/blog는 발표 시점의 출시 범위와 변경을 설명한다. 비교 성능 수치는 회사 주장으로만 기록한다.
5. 검색 snapshot은 직접 원문이 사라진 경우의 단서다. 현재 지원 상태를 확정하는 근거로 승격하지 않는다.

## 이번 분석으로 알 수 없는 것

- 비공개 서버 소스, 정확한 저장 스키마, 동시 편집 알고리즘, 내부 queue·index 구현.
- 사용자 계정별 feature flag, 전 세계 모든 plan/region/cohort의 동일 기능 가용성.
- 동시 편집의 실제 충돌 결과, 계산 오류·재계산 시점, 권한 변경 직후의 일관성.
- Enterprise tenant가 필요한 조직 관리·감사·SCIM·IP 제한의 실동작.
- 종료/비공개 alpha/초대형 beta 기능의 현재 실제 동작.

공개 문서에서 내부 설명을 제공한 경우에도 그 설명과 자체 관찰을 구분한다. 서비스 전체를 복원했다는 결론으로 확대하지 않는다.

## 범위 통제

- 이번 조사에서 Slacord에 통합할 기술이나 데이터 모델을 선택하지 않는다.
- 기존 `docs/document-platform/` 설계와 `packages/document-core/` 코드는 초기 실험으로 보류되어 있다.
- 현재 문서 묶음의 항목 수·출처 수를 “기능 분석 완료율”로 환산하지 않는다.
- 공식 문서에 아직 없거나 접근할 수 없는 기능도 미확인 목록으로 유지한다.
