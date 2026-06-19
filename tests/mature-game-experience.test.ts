import { describe, expect, it } from "vitest";
import { getReferenceGamePattern } from "../src/services/referenceGamePatterns";
import { createGenerationService } from "../src/services/generationService";
import { createPromptForTask } from "../src/services/promptPack";
import { runMockPipeline } from "../src/core/pipeline";
import { runDynamicVerification } from "../src/services/verificationBench";

describe("mature game experience generation", () => {
  it("exposes reference game patterns without copying specific games", () => {
    const platformer = getReferenceGamePattern("platformer");
    const topDown = getReferenceGamePattern("top_down");

    expect(platformer.templateFamily).toBe("platformer");
    expect(platformer.beats).toEqual(
      expect.arrayContaining(["start safe", "tutorial collectible", "jump arc", "hazard timing", "finish gate"])
    );
    expect(platformer.avoidCopying).toBe(true);
    expect(topDown.beats).toEqual(expect.arrayContaining(["safe zone", "enemy pressure", "near miss escape"]));
  });

  it("asks DeepSeek for a mature game brief before GDD and hooks", () => {
    const prompt = createPromptForTask("llm.mature_game_brief", {
      idea: "make a forest platformer",
      referencePattern: getReferenceGamePattern("platformer")
    });

    expect(prompt).toContain("Task: llm.mature_game_brief");
    expect(prompt).toContain('"firstThirtySeconds"');
    expect(prompt).toContain('"gameFeelMoments"');
    expect(prompt).toContain("Do not copy commercial games");
  });

  it("generates mature brief artifacts and expanded hooks for platformers", async () => {
    const service = createGenerationService();

    const result = await service.generatePlayableVersion({
      idea: "横版平台跳跃，森林背景，主角收集金币到终点",
      answers: [],
      templateFamily: "platformer",
      projectId: "project-mature-platformer",
      baseUrl: "https://wow-game.example",
      model: "mock-designer"
    });

    const matureBrief = result.project.artifacts.find((artifact) => artifact.fileName === "mature-game-brief.json");

    expect(matureBrief?.content).toMatchObject({
      referencePatternId: "pattern-platformer-first-run"
    });
    expect(JSON.stringify(matureBrief?.content)).toContain("金币路径");
    expect(result.project.gameHooks.levelFlow?.finishZone).toEqual(expect.objectContaining({ x: expect.any(Number) }));
    expect(result.project.gameHooks.feedbackRules?.floatingScore).toBe(true);
    expect(result.project.gameHooks.visualLayerRules?.backgroundTreatment).toContain("parallax");
    expect(result.modelTasks.map((task) => task.taskType)).toContain("llm.mature_game_brief");
  });

  it("keeps platformer and top_down mature hooks visibly different", () => {
    const platformer = runMockPipeline("做一个横版平台跳跃收集金币到终点的森林游戏");
    const topDown = runMockPipeline("做一个俯视角飞船躲避陨石并收集星星的小游戏");

    expect(platformer.gameHooks.levelFlow?.finishZone).toBeDefined();
    expect(platformer.gameHooks.levelFlow?.safeZones[0]).toMatchObject({ x: 96 });
    expect(topDown.gameHooks.levelFlow?.safeZones[0]).toMatchObject({ x: 480 });
    expect(platformer.gameHooks.difficultyRules?.hazardRamp).not.toBe(topDown.gameHooks.difficultyRules?.hazardRamp);
  });

  it("adds maturity evidence to dynamic verification", () => {
    const project = runMockPipeline("做一个横版平台跳跃收集金币到终点的森林游戏");
    const report = runDynamicVerification(project);

    expect(report.scores.firstThirtySeconds).toBeGreaterThanOrEqual(80);
    expect(report.scores.visualDepth).toBeGreaterThanOrEqual(80);
    expect(report.scores.gameFeel).toBeGreaterThanOrEqual(80);
    expect(report.checks).toEqual(expect.arrayContaining(["first 30 seconds include goal, reward, risk, and outcome"]));
  });
});
