import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("desktop release runtime", () => {
  it("uses the audited, exactly pinned Electron dependency without a stale packaging override", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    );
    expect(manifest.devDependencies.electron).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.build).not.toHaveProperty("electronVersion");
  });
});
