# 모바일이 사용하는 서버 계약

기준은 2026-10-28 이 브랜치의 실제 NestJS 컨트롤러·유스케이스입니다. API 경로의 단·복수형, HTTP 응답 envelope, Socket.IO ACK를 서로 다르게 처리합니다. Swagger나 웹 UI만 추측해 계약을 만들지 않습니다.

REST 기본값은 `https://gadoc.kr/api`입니다. [main.ts](../../packages/server/src/main.ts)의 `api` prefix와 [ResponseInterceptor](../../packages/server/src/shared/interceptors/response.interceptor.ts)가 적용됩니다. 성공 조회는 `{ success: true, data: T }`, 데이터 없는 성공은 `{ success: true }`입니다. HTTP 오류 응답 본문은 UI·로그에 전달하지 않고 상태 코드만 분류합니다.

| 작업                | 실제 계약                                                                                                                                      | 서버 근거                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 로그인              | `POST /auth/login`, `{email,password,rememberMe:true}` → `{success:true,data:{accessToken,user}}`, 잘못된 자격 증명은 **400**                  | [AuthController](../../packages/server/src/modules/auth/infrastructure/http/auth.controller.ts), [LoginUseCase](../../packages/server/src/modules/auth/application/use-cases/login.use-case.ts)                           |
| 복원                | `GET /auth/me` → 공개 사용자 `{id,email,username,avatarUrl,...}`                                                                               | [GetMeUseCase](../../packages/server/src/modules/auth/application/use-cases/get-me.use-case.ts)                                                                                                                           |
| 로그아웃            | `POST /auth/logout` → 데이터 없는 성공. 쿠키만 삭제하며 JWT 폐기 API가 아님                                                                    | AuthController                                                                                                                                                                                                            |
| 팀 목록             | `GET /team` → 팀 배열. 페이지 wrapper 없음                                                                                                     | [TeamController](../../packages/server/src/modules/team/infrastructure/http/team.controller.ts)                                                                                                                           |
| 팀원                | `GET /team/:teamId/member` → `{userId,role,user,...}[]`; guest는 읽기 전용                                                                     | TeamController, [팀 접근 수준](../../packages/server/src/shared/decorators/team-role.decorator.ts)                                                                                                                        |
| 채널                | `GET /team/:teamId/channel` → 권한 필터된 채널 배열과 `unreadCount` 등                                                                         | [ChannelController](../../packages/server/src/modules/channel/infrastructure/http/channel.controller.ts)                                                                                                                  |
| 채팅 이력           | `GET /channel/:channelId/message?limit=50&before=<ISO8601>` → **오래된 순** 메시지 배열. `before`는 ID가 아니라 가장 오래된 조회 메시지의 날짜 | [MessageController](../../packages/server/src/modules/message/infrastructure/http/message.controller.ts), [MessageRepository](../../packages/server/src/modules/message/infrastructure/persistence/message.repository.ts) |
| 문서 목록           | `GET /team/:teamId/document` → **본문 없는** 트리 노드 배열. 권한으로 필터됨                                                                   | [DocumentController](../../packages/server/src/modules/document/infrastructure/http/document.controller.ts)                                                                                                               |
| 문서 상세           | `GET /team/:teamId/document/:documentId` → 본문과 `canEdit`, `canDelete`. team 일치와 canView 검사                                             | DocumentController                                                                                                                                                                                                        |
| 이슈 목록·상세 읽기 | `GET /team/:teamId/issue` → 이슈 배열. 상세 화면도 목록을 새로 조회해 ID를 선택함. **단일 이슈 GET은 없음**                                    | [IssueController](../../packages/server/src/modules/issue/infrastructure/http/issue.controller.ts)                                                                                                                        |

모바일은 사용하는 필드만 Zod로 검증·추출합니다. 팀 설정·웹훅 설정·첨부 원본 URL 등 사용하지 않는 필드는 상태에 보관하지 않습니다. refresh-token·이슈 단건 GET·메시지 REST POST·페이지 번호 API를 새로 가정하지 않습니다.

메시지는 서버에서 최신 `limit`개를 내림차순으로 찾은 뒤 역순으로 반환합니다. 다음 페이지에는 결과 첫 메시지의 `createdAt`을 `before`로 전달합니다. 50개 미만이면 마지막 페이지로 판단하며 ID 기준으로 중복을 제거합니다. 서버가 `$lt` 날짜 커서만 제공하므로 페이지 경계에서 **완전히 같은 시각**에 저장된 메시지의 누락 가능성은 클라이언트만으로 해결할 수 없습니다. 서버 계약 변경은 이번 모바일 소유 범위에 포함하지 않습니다.

## Socket.IO

[MessageGateway](../../packages/server/src/modules/message/infrastructure/websocket/message.gateway.ts)와 [socket-auth](../../packages/server/src/shared/lib/socket-auth.ts)를 읽어 구현했습니다. namespace는 `/chat`, 기본 Engine.IO 경로는 `/socket.io`이며 인증은 연결 옵션의 `auth: {token}`입니다. query 문자열에 토큰을 넣지 않습니다. 웹 쿠키나 웹의 Origin 값에 의존하지 않는 네이티브 WebSocket 연결을 사용합니다.

| 방향      | 이벤트                                       | payload / 처리                                                                                         |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 앱 → 서버 | `join_channel`                               | `{channelId}`. 서버 `ensureChannelMember` 검사 후 입장                                                 |
| 서버 → 앱 | `joined_channel`                             | `{channelId}`. 일치 확인 후 최신 REST 이력 동기화                                                      |
| 앱 → 서버 | `leave_channel`                              | `{channelId}`. 화면 이탈·백그라운드에서 해제                                                           |
| 앱 → 서버 | `send_message`                               | `{teamId,channelId,content}`. 서버가 인증된 author와 실제 channel의 teamId를 결정하고 writer 권한 검사 |
| 서버 → 앱 | 전송 ACK                                     | **REST envelope와 별개**인 `{success:true,data:message}`                                               |
| 서버 → 앱 | `new_message`                                | 메시지 단건. channel/team 일치 확인 후 ID로 합침                                                       |
| 서버 → 앱 | `message_deleted`                            | `{messageId}`. 이력 조회 중 도착해도 이전 응답이 되살리지 못하도록 처리                                |
| 서버 → 앱 | `reaction_updated`, `pinned_message_updated` | 단건 메시지 내용을 갱신. 이번 앱에는 반응·핀 편집 UI가 없음                                            |
| 서버 → 앱 | `error`, `connect_error`, `disconnect`       | 고정 오류 문구·재연결/재조회. **소켓 오류 문자열만으로 토큰 삭제하지 않음**                            |

`join_channel`은 callback ACK가 아니라 `joined_channel` 이벤트를 기다려야 합니다. 전송 실패 시 서버는 일반 `error`를 보내고 성공 ACK를 보내지 않으므로 연결 성공과 전송 성공을 동일시하지 않습니다. 12초 join/전송 확인 시간을 사용하며 Socket.IO의 `retries` 옵션을 켜지 않습니다. 한 번에 하나의 전송을 확인합니다. 서버에 client message ID와 멱등 키가 없으므로 전송 후 응답 유실은 불확실 상태입니다.

재연결 후 room을 다시 입장하고 최신 50개 window를 새로 조회합니다. 오래된 window는 재연결 때 버리고 `이전 대화 보기`로 다시 조회해, 끊긴 동안 생긴 누락 구간이 마치 연속된 이력처럼 보이지 않도록 합니다. 실패 초안은 현재 세션 메모리에 유지합니다.

## 인증·권한

인증된 HTTP 요청의 401만 현재 요청 토큰과 세션 토큰이 같을 때 만료 처리를 합니다. 로그인 자체의 400/401, 소켓 오류 원문, 403, 5xx, 네트워크 실패·시간 초과는 세션 삭제 신호로 사용하지 않습니다. 로그아웃·새 로그인과 이전 요청의 경쟁을 epoch와 순서 있는 보안 저장소 작업으로 처리합니다.

[MessageAccessService](../../packages/server/src/modules/message/application/services/message-access.service.ts)는 워크스페이스 멤버, private/DM/group 채널 멤버, guest·보관 채널 writer 권한을 검사합니다. 모바일은 재진입·복귀 때 채널/팀원을 재조회하고 guest·보관 상태에서 입력 UI를 숨깁니다. 문서와 이슈는 서버의 `@TeamRole('member')` 범위(guest 포함)를 따르며 읽기 API만 호출합니다. 문서 트리에서 숨겨진 부모 ID의 이름을 별도 조회하지 않습니다.

계약 검증에는 합성 fetch 응답, React Native 화면, 실제 로컬 Socket.IO 서버를 사용합니다. 이 문서는 운영 DB나 운영 계정으로 통합 검증했다고 주장하지 않습니다.
