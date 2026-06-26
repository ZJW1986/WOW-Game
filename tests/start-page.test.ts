import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildOptimizedGamePrompt,
  createStartGameDraft,
  createStartTemplateTiles,
  createStartThreeGameTypeTiles,
  getGenerationPrompt,
  modelOptions,
  templateOptions
} from "../src/core/start";
import { getOfficialTemplates } from "../src/core/templateCatalog";
import { getRegisteredPhaserTemplates } from "../src/runtime/phaser/registry";

describe("start page draft", () => {
  it("uses DeepSeek v4 flash and top_down template by default", () => {
    const draft = createStartGameDraft({
      idea: "做一个飞船躲避陨石的小游戏"
    });

    expect(draft.model).toBe("deepseek-v4-flash");
    expect(draft.engineType).toBe("phaser2d");
    expect(draft.viewportMode).toBe("web_16_9");
    expect(draft.templateFamily).toBe("top_down");
    expect(draft.idea).toContain("飞船");
  });

  it("supports explicit 3D game type and mobile canvas defaults", () => {
    const draft = createStartGameDraft({
      idea: "做一个手机竖屏 3D 飞船躲避陨石游戏",
      engineType: "threejs3d",
      threeGameGenre: "flight_shooter"
    });
    const threeTypes = createStartThreeGameTypeTiles();

    expect(draft.engineType).toBe("threejs3d");
    expect(draft.viewportMode).toBe("app_9_16");
    expect(draft.threeGameGenre).toBe("flight_shooter");
    expect(threeTypes.map((tile) => tile.genre)).toEqual([
      "flight_shooter",
      "runner",
      "third_person_collect",
      "exploration",
      "futuristic_tower_defense"
    ]);
    expect(threeTypes.find((tile) => tile.genre === "futuristic_tower_defense")).toMatchObject({
      icon: "TD",
      visualClass: "type-defense"
    });
  });

  it("keeps selectable models and templates explicit for the create dialog", () => {
    expect(modelOptions.map((model) => model.id)).toContain("deepseek-v4-flash");
    expect(modelOptions.map((model) => model.id)).toContain("gemini-flash");
    expect(modelOptions.map((model) => model.id)).toContain("mock-designer");
    expect(templateOptions.map((template) => template.id)).toEqual([
      "top_down",
      "platformer",
      "grid_logic",
      "tower_defense",
      "ui_heavy"
    ]);
  });

  it("captures uploaded file names without storing file content in the draft", () => {
    const draft = createStartGameDraft({
      idea: "做一个跳跃收集金币的游戏",
      templateFamily: "platformer",
      uploadedFileNames: ["character.png", "music.mp3"]
    });

    expect(draft.templateFamily).toBe("platformer");
    expect(draft.uploadedFileNames).toEqual(["character.png", "music.mp3"]);
  });

  it("keeps official templates behind a library entry and uses compact game type icons", () => {
    const tiles = createStartTemplateTiles();

    expect(tiles).toHaveLength(5);
    expect(tiles.map((tile) => tile.templateFamily)).toEqual([
      "top_down",
      "platformer",
      "grid_logic",
      "tower_defense",
      "ui_heavy"
    ]);
    expect(tiles.every((tile) => tile.icon.length <= 2)).toBe(true);
    expect(tiles.every((tile) => tile.shortLabel.length <= 6)).toBe(true);
    expect(tiles.every((tile) => tile.visualClass.startsWith("type-"))).toBe(true);
    expect(tiles.filter((tile) => tile.runtimeStatus === "available").map((tile) => tile.templateFamily)).toEqual([
      "top_down",
      "platformer",
      "grid_logic",
      "tower_defense"
    ]);
    expect(tiles.find((tile) => tile.templateFamily === "ui_heavy")).toMatchObject({
      runtimeStatus: "coming_soon",
      disabledReason: "暂未上线"
    });
    expect(createStartThreeGameTypeTiles().every((tile) => tile.visualClass.startsWith("type-"))).toBe(true);
    expect(getOfficialTemplates().length).toBeGreaterThan(0);
  });

  it("builds editable optimized prompts and uses them for generation", () => {
    const twoD = createStartGameDraft({
      idea: "太空猫驾驶飞船躲避陨石并收集鱼干",
      templateFamily: "top_down"
    });
    const threeD = createStartGameDraft({
      idea: "太空猫驾驶飞船躲避陨石并收集鱼干",
      engineType: "threejs3d",
      threeGameGenre: "flight_shooter",
      viewportMode: "app_9_16",
      model: "gemini-flash"
    });

    const twoDPrompt = buildOptimizedGamePrompt(twoD);
    const threeDPrompt = buildOptimizedGamePrompt(threeD);

    expect(twoDPrompt).toContain("2D Phaser");
    expect(twoDPrompt).toContain("top_down");
    expect(threeDPrompt).toContain("3D Three.js");
    expect(threeDPrompt).toContain("APP 9:16");
    expect(threeDPrompt).not.toBe(twoDPrompt);
    expect(getGenerationPrompt({ ...twoD, optimizedPrompt: "优化后的正式提示词" })).toBe("优化后的正式提示词");
    expect(getGenerationPrompt(twoD)).toBe(twoD.idea);
  });

  it("disables 2D template tiles that do not have a registered runtime", () => {
    const source = readFileSync("src/ui/App.tsx", "utf8");

    expect(source).toContain('disabled={template.runtimeStatus !== "available"}');
    expect(source).toContain("template.disabledReason");
  });

  it("derives tile availability from the Phaser runtime registry", () => {
    const registeredIds = getRegisteredPhaserTemplates().map((template) => template.id);
    const tiles = createStartTemplateTiles({ registeredTemplateIds: registeredIds });

    expect(tiles.filter((tile) => tile.runtimeStatus === "available").map((tile) => tile.templateFamily)).toEqual([
      "top_down",
      "platformer",
      "grid_logic",
      "tower_defense"
    ]);
    expect(new Set(registeredIds)).toEqual(new Set(["top_down", "platformer", "grid_logic", "tower_defense"]));
    expect(tiles.find((tile) => tile.templateFamily === "ui_heavy")).toMatchObject({
      runtimeStatus: "coming_soon",
      disabledReason: "暂未上线"
    });
  });

  it("greys out a catalog tile when its runtime adapter is absent", () => {
    const tiles = createStartTemplateTiles({ registeredTemplateIds: ["top_down", "platformer"] });

    expect(tiles.find((tile) => tile.templateFamily === "tower_defense")).toMatchObject({
      runtimeStatus: "coming_soon",
      disabledReason: "暂未上线"
    });
  });
  it("keeps only the five most recent generation failures for the start page", async () => {
    const { recordRecentFailure } = await import("../src/ui/App");
    const failures = ["one", "two", "three", "four", "five", "six"].reduce(
      (current, detail, index) => recordRecentFailure(current, `stage-${index}`, detail),
      [] as Array<{ stage: string; detail: string }>
    );

    expect(failures).toHaveLength(5);
    expect(failures.map((failure) => failure.detail)).toEqual(["six", "five", "four", "three", "two"]);
  });

  it("renders a recent failure panel on the start page", () => {
    const source = readFileSync("src/ui/App.tsx", "utf8");

    expect(source).toContain("recent-failure-panel");
    expect(source).toContain("最近失败");
  });
});
