import assert from "node:assert/strict";
import test from "node:test";
import { resolveProfileCommand } from "../lib/profile-commands.mjs";

for (const target of ["web:dev", "web:start"]) {
  test(`${target} defaults to loopback instead of exposing a local login server`, () => {
    const { args } = resolveProfileCommand(target, {});
    assert.equal(args[args.indexOf("--hostname") + 1], "127.0.0.1");
  });
  test(`${target} honors the explicitly configured host and port`, () => {
    const { args } = resolveProfileCommand(target, {
      SLACORD_WEB_HOST: "::1",
      SLACORD_WEB_PORT: "3302",
    });
    assert.equal(args[args.indexOf("--hostname") + 1], "::1");
    assert.equal(args[args.indexOf("--port") + 1], "3302");
  });
}
