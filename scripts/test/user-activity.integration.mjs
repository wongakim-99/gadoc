import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(
  new URL("../../packages/server/package.json", import.meta.url),
);

test(
  "사용자 활동을 실제 DB에 보관하고 워크스페이스 관리자만 조회한다",
  { timeout: 30_000 },
  async (t) => {
    const uri =
      process.env.ACTIVITY_TEST_MONGODB_URI ?? process.env.MONGODB_URI ?? "";
    assert.match(
      uri,
      /^mongodb:\/\/127\.0\.0\.1:(?:27128\/gadoc_activity_test|27017\/slacord_ci)$/,
      "활동 로그 테스트 전용 로컬/CI DB만 사용할 수 있습니다.",
    );
    assert.equal(
      existsSync(".env"),
      false,
      "운영 환경 파일이 없는 테스트 작업 폴더에서 실행하세요.",
    );

    // 실제 AppModule도 임의 이름의 전용 DB와 테스트 자격증명만 사용한다.
    const dbName = `gadoc_activity_test_${randomUUID().replaceAll("-", "")}`;
    process.env.MONGODB_URI = `${uri.slice(0, uri.lastIndexOf("/"))}/${dbName}`;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "activity-integration-test-only-0123456789abcdef";
    process.env.MINIO_ENDPOINT = "http://127.0.0.1:1";
    process.env.MINIO_ACCESS_KEY = "activity-test";
    process.env.MINIO_SECRET_KEY = "activity-test-only";
    process.env.MINIO_BUCKET = "activity-test";
    process.env.DISCORD_BOT_TOKEN = "";
    process.env.DISCORD_SIGNUP_CHANNEL_ID = "";
    process.env.DISCORD_ERROR_CHANNEL_ID = "";

    const { NestFactory } = require("@nestjs/core");
    const { ValidationPipe } = require("@nestjs/common");
    const { getConnectionToken, getModelToken } = require("@nestjs/mongoose");
    const request = require("supertest");
    const { AppModule } = require("../../packages/server/dist/app.module.js");
    const {
      ActivityMiddleware,
    } = require("../../packages/server/dist/modules/activity/activity.middleware.js");
    const {
      ActivityService,
    } = require("../../packages/server/dist/modules/activity/activity.service.js");
    const {
      DiscordErrorFilter,
    } = require("../../packages/server/dist/shared/filters/discord-error.filter.js");
    const app = await NestFactory.create(AppModule, {
      logger: false,
      abortOnError: false,
    });
    const connection = app.get(getConnectionToken());
    t.after(async () => {
      await app.get(ActivityService).onModuleDestroy();
      try {
        assert.equal(connection.name, dbName);
        await connection.dropDatabase();
      } finally {
        await app.close();
      }
    });
    const middleware = app.get(ActivityMiddleware);
    app.use(middleware.use.bind(middleware));
    app.use(require("cookie-parser")());
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(
      new DiscordErrorFilter({ notifyError: async () => {} }),
    );
    await app.init();
    const events = app.get(getModelToken("UserActivityEvent"));
    await events.init();
    const http = request(app.getHttpServer());
    const password = "private-integration-password-123!";
    const identities = [];
    for (const name of ["owner", "member", "outsider"]) {
      const email = `${name}@activity.example.test`;
      const registered = await http
        .post("/api/auth/register")
        .send({ email, username: name, password })
        .expect(201);
      const login = await http
        .post("/api/auth/login")
        .send({ email, password })
        .expect(201);
      identities.push({
        id: registered.body.data.id,
        token: login.body.data.accessToken,
        email,
      });
      assert.ok(login.headers["x-request-id"]);
    }
    const [owner, member, outsider] = identities;
    const created = await http
      .post("/api/team")
      .auth(owner.token, { type: "bearer" })
      .send({ name: "Activity test", slug: "activity-test" })
      .expect(201);
    const teamId = created.body.data.id;
    const invite = await http
      .post(`/api/team/${teamId}/invite-links`)
      .auth(owner.token, { type: "bearer" })
      .send({ label: "test", defaultRole: "member" })
      .expect(201);
    const code = invite.body.data.code;
    assert.equal(typeof code, "string");
    const unauthenticated = await http
      .post(`/api/team/invite/${code}/join`)
      .expect(401);
    await http.get(`/api/team/invite/${code}`).expect(200);
    await http
      .post(`/api/team/invite/${code}/join`)
      .auth(member.token, { type: "bearer" })
      .expect(201);
    await http
      .get(`/api/team/${teamId}`)
      .auth(outsider.token, { type: "bearer" })
      .expect(400);
    await http
      .post("/api/auth/login")
      .send({ email: member.email, password: "private-wrong-password" })
      .expect(400);
    await http
      .post("/api/auth/logout")
      .auth(member.token, { type: "bearer" })
      .expect(201);
    await app.get(ActivityService).onModuleDestroy();

    const saved = await events.find().lean();
    const signup = saved.find(
      (event) =>
        event.action === "auth.register" && event.actorId === member.id,
    );
    const join = saved.find(
      (event) =>
        event.action === "workspace.invite.join" && event.actorId === member.id,
    );
    assert.equal(signup.outcome, "success");
    assert.equal(signup.teamId, null);
    assert.equal(join.teamId, teamId);
    assert.equal(join.outcome, "success");
    assert.ok(
      saved.some(
        (event) =>
          event.requestId === unauthenticated.headers["x-request-id"] &&
          event.teamId === teamId &&
          event.statusCode === 401,
      ),
    );
    assert.ok(
      saved.some(
        (event) =>
          event.action === "auth.login" &&
          event.statusCode === 400 &&
          event.subjectFingerprint === signup.subjectFingerprint,
      ),
    );
    assert.ok(
      saved.some(
        (event) =>
          event.action === "auth.logout" && event.actorId === member.id,
      ),
    );
    const serialized = JSON.stringify(saved);
    for (const secret of [
      password,
      "private-wrong-password",
      code,
      ...identities.flatMap((user) => [user.email, user.token]),
    ]) {
      assert.equal(
        serialized.includes(secret),
        false,
        "민감한 원문을 활동 로그에 기록하면 안 됩니다.",
      );
    }
    const indexes = await events.collection.indexes();
    assert.ok(
      indexes.some(
        (index) =>
          index.key.createdAt === 1 && index.expireAfterSeconds === 30 * 86400,
      ),
    );
    const page = await http
      .get(`/api/team/${teamId}/access-events?limit=2`)
      .auth(owner.token, { type: "bearer" })
      .expect(200);
    assert.equal(page.body.data.items.length, 2);
    assert.ok(page.body.data.nextCursor);
    for (const event of page.body.data.items) {
      assert.equal(event.teamId, teamId);
      assert.equal("subjectFingerprint" in event, false);
    }
    const nextPage = await http
      .get(
        `/api/team/${teamId}/access-events?limit=2&before=${page.body.data.nextCursor}`,
      )
      .auth(owner.token, { type: "bearer" })
      .expect(200);
    assert.ok(nextPage.body.data.items.length > 0);
    assert.ok(
      nextPage.body.data.items.every(
        (event) =>
          !page.body.data.items.some((previous) => previous._id === event._id),
      ),
    );
    await http
      .get(`/api/team/${teamId}/access-events`)
      .auth(member.token, { type: "bearer" })
      .expect(403);
    await http
      .get(`/api/team/${teamId}/access-events`)
      .auth(outsider.token, { type: "bearer" })
      .expect(403);
    await http.get(`/api/team/${teamId}/access-events`).expect(401);
  },
);
