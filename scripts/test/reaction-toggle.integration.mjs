import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(
  new URL("../../packages/server/package.json", import.meta.url),
);

test(
  "reaction toggles are atomic and repair legacy duplicate emoji without losing users",
  { timeout: 30000 },
  async (t) => {
    const uri =
      process.env.REACTION_TEST_MONGODB_URI ?? process.env.MONGODB_URI ?? "";
    assert.match(
      uri,
      /^mongodb:\/\/127\.0\.0\.1:(?:27127\/gadoc_verify|27017\/slacord_ci)$/,
      "Only the explicit isolated local/CI MongoDB may be used.",
    );
    assert.equal(
      existsSync(".env"),
      false,
      "Do not run with a production environment file.",
    );
    const name = `gadoc_reaction_test_${randomUUID().replaceAll("-", "")}`;
    const mongoose = require("mongoose");
    const {
      MessageSchema,
    } = require("../../packages/server/dist/modules/message/infrastructure/persistence/message.schema.js");
    const {
      MessageRepository,
    } = require("../../packages/server/dist/modules/message/infrastructure/persistence/message.repository.js");
    const connection = await mongoose
      .createConnection(`${uri.slice(0, uri.lastIndexOf("/"))}/${name}`, {
        autoIndex: false,
        serverSelectionTimeoutMS: 5000,
      })
      .asPromise();
    t.after(async () => {
      try {
        assert.equal(connection.name, name);
        await connection.dropDatabase();
      } finally {
        await connection.close();
      }
    });
    const model = connection.model("Message", MessageSchema);
    const repo = new MessageRepository(model);
    const create = (reactions) =>
      model.create({
        teamId: new mongoose.Types.ObjectId(),
        channelId: new mongoose.Types.ObjectId(),
        authorId: "author",
        content: "preserve this body",
        type: "text",
        reactions,
      });

    await t.test(
      "twenty concurrent users add and remove one emoji, preserving other emoji",
      async () => {
        const doc = await create([{ emoji: "👀", userIds: ["observer"] }]);
        const id = String(doc._id);
        const users = Array.from(
          { length: 20 },
          (_, index) => `actor-${index}`,
        );
        await Promise.all(
          users.map((user) => repo.toggleReaction(id, "👍", user)),
        );
        const added = (await repo.findById(id)).reactions;
        assert.equal(added.length, 2);
        assert.deepEqual(
          [...added.find((reaction) => reaction.emoji === "👍").userIds].sort(),
          users.sort(),
        );
        await Promise.all(
          users.map((user) => repo.toggleReaction(id, "👍", user)),
        );
        assert.deepEqual((await repo.findById(id)).reactions, [
          { emoji: "👀", userIds: ["observer"] },
        ]);
        assert.equal((await repo.findById(id)).content, "preserve this body");
      },
    );
    await t.test(
      "legacy duplicate entries combine users and retain the original emoji position",
      async () => {
        const doc = await create([
          { emoji: "👍", userIds: ["a"] },
          { emoji: "🎉", userIds: ["b"] },
          { emoji: "👍", userIds: ["b", "a"] },
          { emoji: "👀", userIds: ["a"] },
        ]);
        const fixed = await repo.toggleReaction(String(doc._id), "👍", "c");
        assert.deepEqual(
          fixed.reactions.map((reaction) => reaction.emoji),
          ["👍", "🎉", "👀"],
        );
        assert.deepEqual([...fixed.reactions[0].userIds].sort(), [
          "a",
          "b",
          "c",
        ]);
        const removed = await repo.toggleReaction(String(doc._id), "👍", "a");
        assert.deepEqual([...removed.reactions[0].userIds].sort(), ["b", "c"]);
      },
    );
    await t.test(
      "dollar-prefixed names are literal strings and the last participant removes the entry",
      async () => {
        const doc = await create([]);
        const id = String(doc._id);
        assert.deepEqual(
          (await repo.toggleReaction(id, "$reactions", "$actor")).reactions,
          [{ emoji: "$reactions", userIds: ["$actor"] }],
        );
        assert.deepEqual(
          (await repo.toggleReaction(id, "$reactions", "$actor")).reactions,
          [],
        );
      },
    );
  },
);
