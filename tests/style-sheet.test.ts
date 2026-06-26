import { describe, expect, it } from "vitest";
import { runMockPipeline, createStyleSheet } from "../src/core/pipeline";
import { styleSheetSchema } from "../src/core/schemas";
import { styleSheetPromptPack } from "../src/services/promptPack";

describe("global style sheet stage", () => {
  it("validates strict style sheet fields", () => {
    const valid = createStyleSheet({
      idea: "space ship dodges asteroids",
      templateFamily: "top_down",
      title: "Asteroid Run"
    });

    expect(styleSheetSchema.parse(valid).palette).toHaveLength(5);
    expect(valid.palette.every((color) => /^#[0-9a-fA-F]{6}$/.test(color))).toBe(true);
    expect(valid.negativePrompt.length).toBeLessThanOrEqual(200);

    expect(() =>
      styleSheetSchema.parse({
        ...valid,
        palette: ["blue", "#111111", "#222222", "#333333", "#444444"]
      })
    ).toThrow();
    expect(() =>
      styleSheetSchema.parse({
        ...valid,
        negativePrompt: "x".repeat(201)
      })
    ).toThrow();
  });

  it("creates different five-color palettes for different ideas", () => {
    const ideas = [
      ["space ship dodges asteroids", "top_down", "Asteroid Run"],
      ["forest ninja platform jump", "platformer", "Ninja Canopy"],
      ["tower defense with gold waves", "tower_defense", "Gold Bastion"]
    ] as const;

    const styleSheets = ideas.map(([idea, templateFamily, title]) =>
      createStyleSheet({ idea, templateFamily, title })
    );

    expect(styleSheets.every((styleSheet) => styleSheet.palette.length === 5)).toBe(true);
    expect(new Set(styleSheets.map((styleSheet) => styleSheet.palette.join("|"))).size).toBe(3);
  });

  it("inserts style-sheet artifacts immediately after the GDD", () => {
    const project = runMockPipeline("make a tower defense game with waves and turrets");
    const files = project.artifacts.map((artifact) => artifact.fileName);

    expect(files.slice(files.indexOf("gdd.md") + 1, files.indexOf("gdd.md") + 3)).toEqual([
      "style-sheet.json",
      "style-sheet.md"
    ]);
  });

  it("exposes a style sheet prompt pack for model generation", () => {
    expect(styleSheetPromptPack).toContain("palette");
    expect(styleSheetPromptPack).toContain("negativePrompt");
    expect(styleSheetPromptPack).toContain("hex");
  });
});
