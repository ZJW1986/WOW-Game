import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PhaserPreview tower defense integration", () => {
  it("uses the tower defense runtime for tower_defense previews", () => {
    const source = readFileSync("src/ui/PhaserPreview.tsx", "utf8");

    expect(source).toContain("createTowerDefenseRuntime");
    expect(source).toContain("stepTowerDefenseRuntime");
    expect(source).toContain('config.templateFamily === "tower_defense"');
    expect(source).toContain("createTowerDefenseWorld");
    expect(source).toContain("updateTowerDefenseWorld");
    expect(source).toContain("handleTowerDefensePointer");
  });
});
