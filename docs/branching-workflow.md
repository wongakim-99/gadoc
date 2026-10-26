# 브랜치 운영

- `main`: 기존 기준 브랜치. 검증된 개발 결과를 통합한다.
- `dev`: 기능 통합과 개발 검증 브랜치.
- `feature/<기능명>`: 최신 `origin/dev`에서 분기하는 개별 기능 브랜치.

## 최초 초안 반영

2026-10-26 원격 `main`의 `30b05ef`를 기준으로 `dev`를 생성하고,
문서 플랫폼 초안의 6개 커밋(`7d62ee6`부터 `aea480a`까지)을 이력을 유지한 채 반영했다.
자동 저장, 하위 페이지, 공통 탐색 및 디자인 개선은 초기 구현이며 노션 전체 기능 구현 완료를 의미하지 않는다.

## 이후 기능 작업

```sh
git fetch origin
git switch --no-track -c feature/<기능명> origin/dev
# 구현과 검증 후 커밋
git push -u origin feature/<기능명>
gh pr create --base dev
```

기능별 PR을 검토하고 `dev`에 병합한다. 최초 초안 이후 기능 작업은 `dev`에 직접 push하지 않는다.
`dev` push와 PR에서 CI를 실행한다. `main` 반영과 릴리스는 별도로 진행한다.
이 문서는 운영 규칙이며 GitHub 브랜치 보호 설정을 자동으로 강제하지 않는다.
