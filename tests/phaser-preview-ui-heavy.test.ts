import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("PhaserPreview ui_heavy runtime", () => {
  it("uses a management choice runtime instead of the generic movement loop", () => {
    const source = readFileSync("src/ui/PhaserPreview.tsx", "utf8");

    expect(source).toContain('config.templateFamily === "ui_heavy"');
    expect(source).toContain("createUiHeavyWorld");
    expect(source).toContain("handleUiHeavyPointer");
    expect(source).toContain("Income");
    expect(source).toContain("Mood");
  });
});
