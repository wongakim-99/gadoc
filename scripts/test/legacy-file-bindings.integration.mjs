import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import mongoose from "mongoose";
import { LegacyFileBindingsService } from "../../packages/server/dist/modules/file/legacy-file-bindings.service.js";
import { FileAccessService } from "../../packages/server/dist/modules/file/file-access.service.js";
import { DocumentEntity } from "../../packages/server/dist/modules/document/domain/document.entity.js";

test("legacy file bindings survive restarts, copied links and source deletion", async (t) => {
  const uri = process.env.MONGODB_URI ?? "";
  assert.match(
    uri,
    /^mongodb:\/\/127\.0\.0\.1:(?:27127\/gadoc_verify|27017\/slacord_ci)$/,
    "Use disposable local or CI storage, never the application database.",
  );
  const dbName = `gadoc_file_bindings_test_${randomUUID().replaceAll("-", "")}`;
  const connection = await mongoose
    .createConnection(uri, { dbName })
    .asPromise();
  t.after(async () => {
    try {
      await connection.dropDatabase();
    } finally {
      await connection.close();
    }
  });
  const documents = connection.db.collection("documents");
  const versions = connection.db.collection("document_versions");
  const teamId = "migration-team";
  const key = "slacord/docs/migration-team/inline/2026-10-27/original.png";
  const historicalKey = key.replace("original.png", "history.png");
  const orphanKey = key.replace("original.png", "orphan.png");
  const foreignKey = key.replace("migration-team", "another-team");
  const original = new mongoose.Types.ObjectId();
  const historical = new mongoose.Types.ObjectId();
  await documents.insertMany([
    {
      _id: original,
      teamId,
      content: `<img src="https://bucket.kscold.com/slacord/${key}"><img src="${foreignKey}">`,
      visibility: "restricted",
      createdBy: "owner",
      allowedViewerIds: ["allowed"],
    },
    {
      _id: historical,
      teamId,
      content: "Attachment is only in the archived document's history.",
      visibility: "team",
      archivedAt: new Date(),
      createdBy: "owner",
      allowedViewerIds: [],
    },
  ]);
  await versions.insertOne({
    documentId: String(historical),
    teamId,
    content: JSON.stringify({
      url: `/api/files?key=${encodeURIComponent(historicalKey)}`,
    }),
  });

  const bindings = new LegacyFileBindingsService(connection);
  await bindings.onApplicationBootstrap();
  assert.deepEqual(await bindings.documentIds(key, teamId), [String(original)]);
  assert.deepEqual(await bindings.documentIds(historicalKey, teamId), [
    String(historical),
  ]);
  assert.deepEqual(await bindings.documentIds(foreignKey, teamId), []);
  assert.deepEqual(await bindings.documentIds(orphanKey, teamId), []);
  assert.equal(
    await connection.db.collection("application_migrations").countDocuments(),
    1,
  );

  const access = new FileAccessService(
    { requireMember: async () => ({ role: "member" }) },
    {},
    {
      findById: async (id) => {
        const doc = await documents.findOne({
          _id: new mongoose.Types.ObjectId(id),
        });
        return (
          doc && Object.assign(Object.create(DocumentEntity.prototype), doc)
        );
      },
    },
    bindings,
  );
  assert.equal(await access.authorize(key, "allowed"), key);
  assert.equal(await access.authorize(historicalKey, "member"), historicalKey);
  await assert.rejects(access.authorize(key, "denied"), { status: 403 });

  await documents.insertOne({
    teamId,
    content: `${key} ${orphanKey}`,
    visibility: "team",
    createdBy: "denied",
    allowedViewerIds: [],
  });
  await documents.updateOne(
    { _id: original },
    { $set: { content: "Original link removed." } },
  );
  const restarted = new LegacyFileBindingsService(connection);
  await restarted.onApplicationBootstrap();
  assert.deepEqual(await restarted.documentIds(key, teamId), [
    String(original),
  ]);
  await assert.rejects(access.authorize(key, "denied"), { status: 403 });
  await assert.rejects(access.authorize(orphanKey, "denied"), { status: 403 });

  await documents.updateOne(
    { _id: original },
    { $set: { allowedViewerIds: [] } },
  );
  await assert.rejects(access.authorize(key, "allowed"), { status: 403 });
  await documents.deleteOne({ _id: original });
  await assert.rejects(access.authorize(key, "owner"), { status: 403 });
});
