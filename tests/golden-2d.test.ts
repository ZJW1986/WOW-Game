import { describe, expect, it } from "vitest";
import { runMockPipeline } from "../src/core/pipeline";
import type { TemplateFamily } from "../src/core/types";
import { runHeadlessPhaserTemplate } from "./utils/headlessPhaser";

describe("golden 2D Phaser template smoke suite", () => {
  const cases: Array<{ templateFamily: TemplateFamily; idea: string }> = [
    { templateFamily: "top_down", idea: "make a top down spaceship dodge and collect game" },
    { templateFamily: "platformer", idea: "make a platform jump game with coins and spikes" },
    { templateFamily: "tower_defense", idea: "make a tower defense game with waves and buildable turrets" },
    { templateFamily: "grid_logic", idea: "make a grid puzzle game with limited moves" }
  ];

  for (const item of cases) {
    it(`runs ${item.templateFamily} to a visible state change and terminal state`, () => {
      const project = runMockPipeline(item.idea);
      const result = runHeadlessPhaserTemplate({
        templateFamily: item.templateFamily,
        config: project.gameConfig,
        hooks: project.gameHooks,
        maxMs: 60_000
      });

      expect(project.gameConfig.templateFamily).toBe(item.templateFamily);
      expect(result.errors).toEqual([]);
      expect(result.stateChanged).toBe(true);
      expect(["won", "lost"]).toContain(result.phase);
    });
  }
});

const PLATFORMER_SEEDS = [
  "做一个跳跃收集金币到终点的森林游戏",
  "做一个霓虹城市的横版跑酷收集发光道具",
  "make a forest platformer with hidden coins and spike traps",
  "做一个机器人在地下迷宫跳跃收集能量核心",
  "做一个樱花村落里跳跃收集樱花瓣的小游戏",
  "make a steampunk platformer with moving gears and steam jets",
  "做一个海岛探险跳跃收集宝箱的关卡",
  "make a candy world platformer with bouncy platforms",
  "做一个冒险者在云端神庙跳跃躲避陷阱的小游戏",
  "make a pixel art ninja platformer with hidden scrolls",
  "做一个夜晚墓地里跳跃收集萤火虫的小游戏",
  "make a desert ruins platformer with falling pillars",
  "做一个机械城跳跃收集齿轮到终点门",
  "make a snowy mountain platformer with icy ledges and bonfires",
  "做一个海底废墟跳跃收集珍珠的探险关卡",
  "make a magma cave platformer with timed lava bursts",
  "做一个春日花园跳跃收集种子到温室的小游戏",
  "make a haunted mansion platformer with ghost spikes and candles",
  "做一个未来霓虹平台跳跃收集芯片冲向出口",
  "make a clockwork tower platformer with rotating gears and bells"
];

describe("platformer 20-seed blueprint matrix", () => {
  it.each(PLATFORMER_SEEDS)("seed produces a 3-stage platformer blueprint with score tiers: %s", (idea) => {
    const project = runMockPipeline(idea);
    expect(project.gameConfig.templateFamily).toBe("platformer");

    const hooks = project.gameHooks;
    expect(hooks.stageGoals?.length).toBe(3);
    expect(hooks.stageGoals?.[0].objective).toBe("learn_controls");
    expect(hooks.stageGoals?.[2].objective).toBe("finale");
    const speeds = hooks.stageGoals!.map((stage) => stage.speedMultiplier ?? 1);
    expect(speeds[2]).toBeGreaterThan(speeds[0]);
    const intensities = hooks.stageGoals!.map((stage) => stage.bgmIntensity ?? 0);
    expect(intensities[2]).toBeGreaterThan(intensities[0]);

    const tiers = hooks.scoreTiers;
    expect(tiers).toBeDefined();
    expect(tiers!.targetDurationMs).toBeGreaterThanOrEqual(60_000);
    expect(tiers!.targetDurationMs).toBeLessThanOrEqual(90_000);
    expect(tiers!.gold.maxDurationMs).toBeLessThanOrEqual(tiers!.targetDurationMs);
    expect(tiers!.gold.minScore).toBeGreaterThanOrEqual(tiers!.silver.minScore);
    expect(tiers!.silver.minScore).toBeGreaterThanOrEqual(tiers!.bronze.minScore);
    expect(tiers!.gold.maxDeathCount).toBeLessThanOrEqual(tiers!.silver.maxDeathCount);

    expect(hooks.levelLayout.platforms.length).toBeGreaterThanOrEqual(4);
    expect(hooks.levelFlow?.finishZone).toBeDefined();
    expect(hooks.levelFlow?.safeZones.length).toBeGreaterThanOrEqual(1);

    const result = runHeadlessPhaserTemplate({
      templateFamily: "platformer",
      config: project.gameConfig,
      hooks,
      maxMs: 90_000
    });
    expect(result.errors).toEqual([]);
    expect(result.stateChanged).toBe(true);
    expect(["won", "lost"]).toContain(result.phase);
  });
});
