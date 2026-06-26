import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PhaserPreview grid logic integration", () => {
  it("uses the grid logic runtime for grid_logic previews", () => {
    const source = readFileSync("src/ui/PhaserPreview.tsx", "utf8");

    expect(source).toContain("createGridLogicRuntime");
    expect(source).toContain("moveGridCursor");
    expect(source).toContain("stepGridLogicRuntime");
    expect(source).toContain('config.templateFamily === "grid_logic"');
    expect(source).toContain("createGridLogicWorld");
    expect(source).toContain("updateGridLogicWorld");
  });
});
