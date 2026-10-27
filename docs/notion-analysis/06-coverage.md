# 조사 범위 추적표

이 표는 출처 인용과 분석 식별자를 연결한다. 읽은 문서 수나 기능 검증 완료율을 계산하지 않는다.

| 지표 | 수 | 의미 |
|---|---:|---|
| 공식 도움말 분류 | 26 | 디렉터리 수집 |
| 도움말 문서 | 275 | 링크 목록 |
| 보충 가이드 | 144 | 링크 목록, 전체 본문 검토 아님 |
| 개발자 문서 | 254 | API/Workers/CLI/가이드/legacy 포함 |
| 보고서의 공식 출처 | 280 | DOC·발견·캐시·상충 인용 포함 |
| 분석 식별자 | 314 | 단위 크기가 다른 분석 항목 |
| 로그인 후 실행 검증 | 0 | 미실행 |

## 분야별 문서

| 보고서 | 분석 ID | 공식 URL 참조 |
|---|---:|---:|
| [01-content-collaboration-admin.md](01-content-collaboration-admin.md) | 111 | 144 |
| [02-databases-properties-formulas.md](02-databases-properties-formulas.md) | 92 | 42 |
| [03-ai-automation-api-calendar-mail.md](03-ai-automation-api-calendar-mail.md) | 111 | 102 |
| [04-runtime-research-protocol.md](04-runtime-research-protocol.md) | 0 | 0 |
| [05-evidence-conflicts-and-availability.md](05-evidence-conflicts-and-availability.md) | 0 | 4 |

## 상세 추적

- [coverage-ledger.json](coverage-ledger.json): 모든 카탈로그 URL의 인용 여부, 보고서 위치, 분석 ID.
- [source-catalog.json](source-catalog.json): 원본 디렉터리별 발견 경로와 수집 해시.
- 인용이 없는 문서를 자동으로 분석 완료 또는 불필요로 분류하지 않는다.
- 실제 확인 수준은 각 보고서의 DOC/DOC-CACHED/UNKNOWN과 미확인 항목을 읽어 판정한다.
- 기능 확인을 끝내려면 [런타임 조사 절차](04-runtime-research-protocol.md)의 실제 실행 기록이 필요하다.
