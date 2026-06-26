import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("game-ui-asset-kit skill", () => {
  it("installs a reusable 2D UI image prompt skill", () => {
    const skill = readFileSync(".agents/skills/game-ui-asset-kit/SKILL.md", "utf8");

    expect(skill).toContain("name: game-ui-asset-kit");
    expect(skill).toContain("Context");
    expect(skill).toContain("Subject");
    expect(skill).toContain("Items");
    expect(skill).toContain("Style");
    expect(skill).toContain("Technical");
    expect(skill).toContain("finalImagePrompt");
    expect(skill).toContain("designBrief.developerPrompt");
    expect(skill).toContain("ui.skill");
    expect(skill).toContain("Phaser");
    expect(skill).toContain("Three.js");
  });
});
