import { describe, expect, it } from "vitest";
import {
  classifyIdea,
  runMockPipeline,
  validateAssetReferences
} from "../src/core/pipeline";

describe("physics-first classification", () => {
  it("classifies jumping and gravity ideas as platformer", () => {
    const result = classifyIdea("做一个小机器人跳跃躲避尖刺并收集能量的游戏");

    expect(result.templateFamily).toBe("platformer");
    expect(result.reasons.join(" ")).toContain("gravity");
  });

  it("classifies free movement combat ideas as top_down", () => {
    const result = classifyIdea("玩家在俯视角迷宫里移动，躲避敌人并收集钥匙");

    expect(result.templateFamily).toBe("top_down");
    expect(result.risks.length).toBeGreaterThan(0);
  });
});

describe("standard artifact pipeline", () => {
  it("runs one idea through all required artifact stages", () => {
    const project = runMockPipeline("做一个太空船躲避陨石并收集星星的小游戏");

    expect(project.artifacts.map((artifact) => artifact.fileName)).toEqual([
      "idea-intake.json",
      "idea-intake.md",
      "classification.json",
      "mature-game-brief.json",
      "mature-game-brief.md",
      "gdd.json",
      "gdd.md",
      "asset-style-guide.json",
      "asset-style-guide.md",
      "asset-requirements.json",
      "asset-requirements.md",
      "asset-pack.json",
      "game-config.json",
      "game-hooks.json",
      "qa-report.json",
      "qa-report.md",
      "publish-record.json",
      "iteration-report.json",
      "iteration-report.md"
    ]);
    expect(project.version.status).toBe("published");
    expect(project.qaReport.scores.buildHealth).toBeGreaterThanOrEqual(80);
  });

  it("keeps game config references inside asset-pack", () => {
    const project = runMockPipeline("做一个横版跳跃收集金币的森林游戏");

    expect(validateAssetReferences(project.gameConfig, project.assetPack)).toEqual([]);
  });

  it("reports missing asset keys before game build", () => {
    const project = runMockPipeline("做一个横版跳跃收集金币的森林游戏");
    const invalidConfig = {
      ...project.gameConfig,
      referencedAssetKeys: [...project.gameConfig.referencedAssetKeys, "missing.enemy"]
    };

    expect(validateAssetReferences(invalidConfig, project.assetPack)).toEqual(["missing.enemy"]);
  });

  it("includes built-in demo audio and effect assets for playable feedback", () => {
    const project = runMockPipeline("做一个飞船躲避陨石并收集星星的小游戏");
    const keys = project.assetPack.assets.map((asset) => asset.assetKey);

    expect(keys).toEqual(
      expect.arrayContaining([
        "bgm.loop",
        "sfx.collect",
        "sfx.hit",
        "sfx.win",
        "sfx.lose",
        "sfx.click",
        "vfx.collect",
        "vfx.hit",
        "vfx.win",
        "vfx.lose"
      ])
    );
    expect(project.assetPack.assets.every((asset) => asset.status !== "missing")).toBe(true);
  });

  it("creates different gameplay contracts for different template families", () => {
    const topDown = runMockPipeline("make a top down spaceship dodge and collect game");
    const platformer = runMockPipeline("make a platform jump game with coins and spikes");
    const towerDefense = runMockPipeline("make a tower defense game with waves and buildable turrets");

    expect(topDown.gameConfig.gameplay.primaryAction).toBe("dodge_collect");
    expect(platformer.gameConfig.gameplay.primaryAction).toBe("jump_reach_goal");
    expect(towerDefense.gameConfig.gameplay.primaryAction).toBe("defend_route");
    expect(new Set([
      topDown.gameConfig.gameplay.enemyBehavior,
      platformer.gameConfig.gameplay.enemyBehavior,
      towerDefense.gameConfig.gameplay.enemyBehavior
    ]).size).toBe(3);
  });
});
