# 가독 모바일

Colding / kscold 소유의 iOS·Android React Native 앱입니다. `private: true`, `UNLICENSED`이며 [저장소 LICENSE](../../LICENSE)를 따릅니다. 제3자 라이브러리의 라이선스는 각각 유지합니다.

Expo SDK 58 / React Native 0.88 / React 19.3 기반입니다. 기본 서버는 `https://gadoc.kr/api`이며, 앱 ID는 양 플랫폼 모두 `com.kscold.gadoc.mobile`입니다.

모바일 전용 worktree에서 지원되는 Node LTS와 pnpm 10.34.9를 선택한 뒤 저장소 루트에서 실행합니다.

```sh
node packages/mobile/scripts/install.cjs
pnpm --filter @gadoc/mobile start
```

설치 스크립트는 SSD 여유 15GiB를 확인하고 모바일 의존성만 isolated 모드로 설치합니다. 루트의 데스크톱용 hoisted 정책은 변경하지 않습니다. Xcode·Android SDK·브라우저를 설치하지 않습니다.

[개발·빌드·검증 안내](../../docs/mobile/README.md)와 [실제 서버 API 계약](../../docs/mobile/api-contract.md)을 먼저 확인하세요. 네이티브 화면 및 모델 테스트와 JS 번들 생성은 실제 디바이스·서명·스토어 승인 검증과 별개입니다.
