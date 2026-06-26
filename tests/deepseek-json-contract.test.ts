import { describe, expect, it } from "vitest";
import { createDeepSeekExecutor } from "../src/services/deepSeekExecutor";
import { createPromptForTask } from "../src/services/promptPack";
import { containsMojibake } from "./mojibake";

describe("DeepSeek JSON contract", () => {
  it("uses readable strict JSON prompts for core LLM artifacts", () => {
    const classificationPrompt = createPromptForTask("llm.classification", {
      idea: "make a spaceship collect energy cores",
      preferredTemplate: "top_down"
    });
    const gddPrompt = createPromptForTask("llm.gdd", {
      idea: "make a platform coin collector",
      classification: { templateFamily: "platformer" }
    });
    const configPrompt = createPromptForTask("llm.game_config", {
      idea: "make a platform coin collector",
      assetPack: { assets: [{ assetKey: "player.hero" }] }
    });
    const hooksPrompt = createPromptForTask("llm.game_hooks", {
      idea: "make a platform coin collector",
      gameConfig: { templateFamily: "platformer" }
    });

    expect(classificationPrompt).toContain("Return strict JSON only");
    expect(classificationPrompt).toContain('"templateFamily"');
    expect(classificationPrompt).toContain('"unsupportedRequests"');
    expect(gddPrompt).toContain('"concept"');
    expect(gddPrompt).toContain('"implementationRoute"');
    expect(configPrompt).toContain('"referencedAssetKeys"');
    expect(configPrompt).toContain("asset-pack");
    expect(hooksPrompt).toContain('"enemyRules"');
    expect(hooksPrompt).toContain("Do not output JavaScript or TypeScript");
    expect(containsMojibake(`${classificationPrompt}\n${gddPrompt}\n${configPrompt}\n${hooksPrompt}`)).toBe(false);
  });

  it("requires guided questions to cover the full professional design decision set", () => {
    const prompt = createPromptForTask("llm.guided_questions", {
      idea: "做一个太空猫躲避陨石收集鱼干的小游戏",
      templateFamily: "top_down",
      designBrief: {
        coreGameplay: "俯视角躲避和收集",
        playerGoal: "收集鱼干并避开陨石",
        developerPrompt: "生成第一版可玩 Phaser 小游戏"
      }
    });

    expect(prompt).toContain("Generate exactly 5");
    expect(prompt).toContain("profile-aware");
    expect(prompt).toContain("Tower defense asks route/towers/waves/economy/base health");
    expect(prompt).toContain("Flight shooter asks weapon/enemy formations/bullets/shield/Boss");
    expect(prompt).toContain("Platformer asks jump rhythm/traps/checkpoints/hidden rewards");
    expect(prompt).toContain("profileId, decisionSlot, and affectsDirector");
    expect(containsMojibake(prompt)).toBe(false);
  });

  it("asks gameplay DSL generation to use v2 structured rules instead of Phaser code", () => {
    const prompt = createPromptForTask("llm.gameplay_dsl", {
      idea: "collect three keys and open a portal",
      designBrief: { developerPrompt: "Top-down key collection with a locked portal." },
      assetPack: { assets: [{ assetKey: "item.key" }, { assetKey: "door.portal" }] }
    });

    expect(prompt).toContain('"version":"2"');
    expect(prompt).toContain("Allowed triggers: time, score, collected, enemiesAlive, stage, hpBelow, zoneEntered, combo");
    expect(prompt).toContain("Allowed actions: spawn_zone, open_door, grant_item, set_counter, change_player_speed, fail, win");
    expect(prompt).toContain("Complexity budget: rules <= 80, zones <= 16, counters <= 16, items <= 16");
    expect(prompt).toContain("three-keys-open-door");
    expect(prompt).toContain("Do not output JavaScript or TypeScript");
    expect(prompt).toContain("Do not generate Phaser lifecycle code");
  });

  it("accepts fenced JSON content returned by the chat model", async () => {
    const executor = createDeepSeekExecutor({
      apiKey: "test-key",
      fetcher: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '```json\n{"templateFamily":"top_down","reasons":["free movement"],"risks":[],"unsupportedRequests":[]}\n```'
              }
            }
          ]
        })
    });

    const result = await executor.runJsonTask({
      taskType: "llm.classification",
      prompt: "Return JSON",
      model: "deepseek-v4-flash"
    });

    expect(result.status).toBe("success");
    expect(result.rawJson).toBe(
      '{"templateFamily":"top_down","reasons":["free movement"],"risks":[],"unsupportedRequests":[]}'
    );
  });

  it("requires hooks prompts to define 3-stage curve and score tiers", () => {
    const prompt = createPromptForTask("llm.game_hooks", {
      idea: "做一个森林平台跳跃，收集金币到达终点门",
      gameConfig: { templateFamily: "platformer" }
    });

    expect(prompt).toContain("60000 and 90000");
    expect(prompt).toContain("stageGoals must contain exactly 3 entries");
    expect(prompt).toContain("learn_controls (0-20000 ms)");
    expect(prompt).toContain("finale (50000-90000 ms)");
    expect(prompt).toContain('"scoreTiers"');
    expect(prompt).toContain('"targetDurationMs"');
    expect(prompt).toContain("gold rewards a perfect run");
    expect(prompt).toContain("bgmIntensity");
    expect(prompt).toContain("speedMultiplier");
    expect(prompt).toContain("enemySpawnDelta");
    expect(containsMojibake(prompt)).toBe(false);
  });

  it("requires mature brief prompts to ask for a 3-stage 60-90s curve", () => {
    const prompt = createPromptForTask("llm.mature_game_brief", {
      idea: "make a platform jumper that lasts about 80 seconds",
      referencePattern: { id: "pattern-platformer-first-run" }
    });

    expect(prompt).toContain("60-90 seconds");
    expect(prompt).toContain("3-stage difficulty curve");
    expect(prompt).toContain("safe (0-20s)");
    expect(prompt).toContain("pressure (20-50s)");
    expect(prompt).toContain("climax (50-90s)");
    expect(prompt).toContain("difficultyCurve must contain exactly three entries");
    expect(containsMojibake(prompt)).toBe(false);
  });
});
