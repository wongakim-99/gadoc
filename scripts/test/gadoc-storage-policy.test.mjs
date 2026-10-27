import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("GaDoc storage credentials can only read and upload chat/document objects", () => {
  const policy = JSON.parse(
    fs.readFileSync(
      new URL("../deploy/gadoc-file-policy.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(policy, {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["s3:GetObject", "s3:PutObject"],
        Resource: [
          "arn:aws:s3:::gadoc/gadoc/chat/*",
          "arn:aws:s3:::gadoc/gadoc/docs/*",
        ],
      },
      {
        Effect: "Allow",
        Action: ["s3:GetObject"],
        Resource: ["arn:aws:s3:::gadoc/slacord/chat/*", "arn:aws:s3:::gadoc/slacord/docs/*"],
      },
    ],
  });
});
