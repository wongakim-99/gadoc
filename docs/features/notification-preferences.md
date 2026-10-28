# 워크스페이스·채팅방별 내 데스크톱 알림

워크스페이스 설정의 **알림** 탭에서 기본 수신 방식과 종류별 수신 여부를 저장합니다. 채팅방별 예외는 같은 탭의 채팅방 선택 또는 채널 헤더의 **이 채팅방 알림 설정**에서 변경합니다. 설정은 서버 MongoDB에 사용자별로 저장되며 재로그인과 다른 기기에서도 복원됩니다.

## 적용 방식과 보관

수신 방식은 `all`(모든 활동), `mentions`(멘션·DM·내 관련 활동), `off`(데스크톱 알림 끄기)입니다. `mentions`는 실제 직접 멘션, DM·소그룹, 내 메시지에 대한 답글, 문서 코멘트의 멘션·답글 및 내 이슈·문서 할당을 포함합니다. 일반 채널의 무관한 대화와 `issue_updated`는 포함하지 않습니다.

방별 방식이 워크스페이스 방식을 우선합니다. 각 종류 역시 방별로 명시한 값이 우선하며, 지정하지 않으면 워크스페이스 값을 따릅니다. 최종 전달은 **적용된 방식이 허용하고 해당 종류도 켜져 있을 때**만 허용됩니다. 예를 들어 워크스페이스가 멘션을 끄고 방에서 멘션을 켜도, 그 방의 적용 방식이 `off`이면 표시하지 않습니다.

| 종류       | 적용 대상                                              |
| ---------- | ------------------------------------------------------ |
| `mention`  | 메시지 또는 문서의 직접 멘션                           |
| `thread`   | 직접 멘션으로 분류되지 않은 메시지·문서 답글           |
| `issue`    | `issue_assigned`                                       |
| `document` | `document_assigned`                                    |
| `chat`     | 직접 멘션이나 답글이 아닌 일반 메시지·DM·소그룹 메시지 |
| `update`   | 기존 `issue_updated` 유형                              |

같은 메시지는 서버에 저장된 실제 멘션과 부모 메시지를 기준으로 **멘션 → 답글 → 일반 채팅** 순서로 한 종류에 분류합니다. 채팅 소켓과 알림센터 소켓에서 같은 메시지가 도착해도 같은 정책을 적용합니다. 문서·이슈 알림에 실제 채널 연결이 없다면 워크스페이스 정책을 따릅니다. 업데이트 설정은 기존 `issue_updated` 유형에 대응하며, 이 변경은 새로운 이슈 변경 알림 생성 트리거나 제품 업데이트 공지 시스템을 추가하지 않습니다. 앱 업데이트 설치·재시작 안내는 이 범위에 포함되지 않습니다.

데스크톱 수신을 꺼도 알림센터 기록, 미읽음, 메시지·문서·이슈 원본을 삭제하거나 읽음 처리하지 않습니다. 알림센터의 읽음·삭제 동작은 별개입니다. 접근 권한을 잃은 자료의 알림은 목록·미읽음 집계·실시간 이벤트에서 숨기지만 저장된 기록은 보존합니다.

**이 기기의 알림 권한** 영역은 브라우저·운영체제 권한과 명시적으로 누르는 시스템 알림 테스트를 다룹니다. 서버에 저장하는 워크스페이스·방별 설정과 별개입니다. 수신 이벤트가 기기 권한을 요청하지 않습니다.

## API와 저장

인증된 본인의 `GET/PATCH /api/team/:teamId/notification/preferences`를 사용합니다. GET의 기본 응답은 다음과 같으며, 조회만으로 DB 레코드를 만들지 않습니다.

```json
{
  "mode": "all",
  "channelModes": {},
  "kinds": {
    "mention": true,
    "thread": true,
    "issue": true,
    "document": true,
    "chat": true,
    "update": true
  },
  "channelKinds": {},
  "revision": 0
}
```

PATCH에는 읽은 `revision`을 반드시 보냅니다. 생략한 종류와 다른 방 설정은 유지합니다.

```json
{ "revision": 0, "mode": "mentions", "kinds": { "chat": false } }
```

```json
{
  "revision": 1,
  "channelId": "0123456789abcdef01234567",
  "mode": "all",
  "kinds": { "mention": true, "thread": "inherit" }
}
```

방에서 `mode: "inherit"`는 방식만, 종류별 `"inherit"`는 해당 종류만 기본값으로 되돌립니다. 다음 요청은 선택한 방의 방식과 종류별 예외를 모두 초기화합니다. 다른 방과 워크스페이스 기본값은 유지합니다.

```json
{ "revision": 2, "channelId": "0123456789abcdef01234567", "reset": true }
```

`notification_preferences`의 `_id`는 팀·사용자 ID 조합의 SHA-256이며, 문서 안의 `channelModes`와 `channelKinds`가 채널 범위를 구분합니다. 사용자는 인증 정보에서만 가져옵니다. 기존 WIP의 `mode/channelModes/revision`을 유지하고, 새 종류 필드가 없는 레코드는 모든 종류 켜짐으로 읽습니다. 마이그레이션·설정 삭제 없이 확장합니다.

MongoDB의 `{ _id, revision }` 조건부 업데이트와 원자적 revision 증가를 사용합니다. 최초 동시 생성의 중복 키도 `409`로 처리합니다. 충돌 시 서버 설정을 덮어쓰지 않으며 UI는 선택을 보존하고 최신 설정 재조회 후 다시 선택하도록 안내합니다. 저장 중 중복 클릭을 막고, 다른 방·워크스페이스로 이동한 뒤 도착한 이전 응답은 현재 편집기를 바꾸지 않습니다. 방별 예외는 계정·워크스페이스당 최대 500개입니다.

## 권한과 OS 전달

워크스페이스 멤버십을 확인하고, 비공개·DM·소그룹은 해당 방 멤버십까지 검사합니다. 다른 팀, 삭제·보관된 방, 접근할 수 없는 방은 저장을 거절합니다. 조회 응답은 접근 가능한 방의 예외만 포함하므로 접근이 철회된 비공개 채널의 ID를 노출하지 않습니다. 숨긴 예외는 DB에 보존하며 다른 설정 저장 시에도 지우지 않습니다.

`NotificationResourceService`는 실제 메시지·채널·문서·이슈를 조회해 팀 범위와 자료 접근 권한을 검사합니다. 클라이언트가 전달한 종류·채널 힌트로 허용하지 않습니다. 문서는 기존 도메인의 상속된 열람 권한도 확인합니다. 같은 검사를 알림 목록, 미읽음 집계, 실시간 전파와 OS 전달에 적용합니다.

브라우저와 Electron 브리지는 공통 웹 전달 함수를 사용하며, 알림 ID와 팀 범위가 없거나 서버 검사에 실패하면 표시하지 않습니다. `force`도 이 정책을 우회하지 않습니다. 서버 `delivery-claim`은 정책을 먼저 검사하므로 차단된 알림의 전달 슬롯을 소비하지 않습니다. 메시지를 가리키는 `notification:<id>` 요청은 `message:<id>`로 정규화해 채팅/알림센터/다중 탭의 원자적 중복 방지를 공유합니다. 기기 권한 화면에서 사용자가 직접 누르는 테스트 알림은 별도 동작입니다.

## 검증

기존 staged·untracked WIP를 외부 폴더에 원본·패치·SHA-256으로 보존한 후 확장했습니다. 기존 `document-collaboration.e2e.spec.ts`의 실제 메시지 생성 diff는 유효한 전달 검증 수정이므로 유지했습니다. 원본 Desktop dirty 저장소와 autostash `b697e23`은 재적용·삭제하지 않습니다.

의존성 설치 lockfile과 `pnpm-lock.yaml`이 일치하는 것을 먼저 확인했으며 새 의존성·root lockfile·버전·infra/CI 변경은 없습니다.

로컬 검증은 ignored `config/profiles/isolated-test.local.env`에서 다음 값만 덮어써 사용합니다. 공유 MongoDB·MinIO의 기존 데이터는 삭제하지 않습니다.

```dotenv
SLACORD_SERVER_PORT=18096
SLACORD_WEB_PORT=3204
SLACORD_MOCK_SERVER_PORT=18097
MONGODB_URI=mongodb://127.0.0.1:27127/gadoc_notification_verify
MINIO_PREPROVISIONED=1
```

```sh
node scripts/slacord-profile.mjs print --profile isolated-test --json
node scripts/slacord-profile.mjs run server:dev --profile isolated-test
node scripts/slacord-profile.mjs run web:dev --profile isolated-test
```

```sh
pnpm --filter @slacord/server test --runInBand
pnpm --filter @slacord/web test
pnpm --filter @slacord/server typecheck
pnpm --filter @slacord/web exec tsc --noEmit --incremental false
SLACORD_E2E_BASE_URL=http://127.0.0.1:3204 \
SLACORD_E2E_API_URL=http://127.0.0.1:18096/api \
SLACORD_E2E_SOCKET_URL=http://127.0.0.1:18096 \
SLACORD_NOTIFICATION_VERIFY_MONGO_URI=mongodb://127.0.0.1:27127/gadoc_notification_verify \
pnpm exec playwright test tests/e2e/notification-preferences.e2e.spec.ts tests/e2e/document-collaboration.e2e.spec.ts
```

새 테스트는 6종 분류, 기본값/예외/상속/초기화, 최초·후속 동시 쓰기, 사용자·팀·방 격리, 재로그인, 401/403/404/400, 비공개 권한 철회 후 metadata 비노출과 보관 유지, 실제 설정 UI, 오류/충돌 복구, 모바일에서 늦게 도착한 응답 격리, 브라우저·데스크톱 브리지의 수신 차단을 검증합니다. DB fixture를 직접 쓰는 검증은 loopback API 18096과 정확히 `gadoc_notification_verify`만 허용합니다. 브라우저/브리지 호출 검증은 실제 OS 토스트 수동 확인과 구분합니다.

전달 경로 E2E는 채널 헤더가 보이는 시점과 소켓 구독 완료를 구분합니다. 채팅의 `joined_channel`과 알림센터의 `joined_team_notifications` 응답을 모두 받은 뒤 메시지를 보내 실제 두 경로를 검증합니다.

기능 PR의 대상은 `dev`입니다. 채팅 PR의 알림 삭제·멘션·참여자 변경을 보존해 통합하며, main 병합과 실제 운영 배포는 별도로 조율합니다.
