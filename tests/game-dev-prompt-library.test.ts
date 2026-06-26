import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildGuidedQuestionPromptBundle,
  buildGameDevPromptBundle,
  buildProfileGuidedQuestions,
  buildProfileGameplayPlan,
  gameDevPromptProfiles,
  mapGameDevPromptProfile
} from "../src/services/gameDevPromptLibrary";
import { createGameProductionBrief } from "../src/services/productionPromptPacks";
import { createGenerationApiHandler } from "../src/services/generationApi";

const bannedProviderTerms = ["Phaser", "Three.js", "developerPrompt", "gameHooks", "scene lifecycle", "WASD", "win condition"];

describe("game dev prompt library", () => {
  it("installs a reusable game-dev-prompt-library skill with prompt-layer guardrails", () => {
    const skillPath = join(process.cwd(), ".agents", "skills", "game-dev-prompt-library", "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);
    const content = readFileSync(skillPath, "utf8");
    expect(content).toContain("name: game-dev-prompt-library");
    expect(content).toContain("Production Brief");
    expect(content).toContain("Gameplay Director");
    expect(content).toContain("Visual Prompt Pack");
    expect(content).toContain("UI Prompt Pack");
    expect(content).toContain("Audio Prompt Pack");
    expect(content).toContain("Validation Checklist");
    expect(content).toContain("2D");
    expect(content).toContain("3D");
  });

  it("maps the 20 source prompt categories into supported WOW Game 2D and 3D targets", () => {
    expect(gameDevPromptProfiles).toHaveLength(20);
    for (const profile of gameDevPromptProfiles) {
      expect(profile.sourcePromptPattern).toBeTruthy();
      expect(profile.productionBeats).toHaveLength(5);
      expect(profile.validationChecklist).toEqual(
        expect.arrayContaining(["60fps", "mobile_input", "win_loss_restart", "hud_readability", "audio_cues"])
      );
      const mapped = mapGameDevPromptProfile(profile.id);
      expect(["platformer", "top_down", "grid_logic", "tower_defense", "ui_heavy"]).toContain(mapped.templateFamily);
      expect(["flight_shooter", "runner", "third_person_collect", "exploration", "dodge_collect", "futuristic_tower_defense"]).toContain(mapped.threeGenre);
    }
  });

  it("builds layered prompt bundles with mature gameplay gates", () => {
    const bundle = buildGameDevPromptBundle({
      idea: "未来科幻塔防，建造激光塔防守基地",
      profileId: "strategy_tower_defense",
      engineType: "phaser2d"
    });

    expect(bundle.profileId).toBe("strategy_tower_defense");
    expect(bundle.productionBriefPrompt).toContain("player fantasy");
    expect(bundle.directorPrompt).toContain("JSON only");
    expect(bundle.directorPrompt).toContain("three-stage pacing");
    expect(bundle.visualPromptRules).toContain("background, player, hazard, collectible, cover poster");
    expect(bundle.uiAudioPromptRules).toContain("Context / Subject / Items / Style / Technical");
    expect(bundle.validationChecklist).toEqual(
      expect.arrayContaining(["three_stage_pacing", "two_pressure_types", "reward_path", "failure_feedback", "restart_motivation"])
    );
  });

  it("keeps provider-facing prompt rules isolated from runtime and code language", () => {
    const bundle = buildGameDevPromptBundle({
      idea: "3D 太空射击，升级武器打 Boss",
      profileId: "three_d_space_shooter",
      engineType: "threejs3d"
    });
    const providerText = [bundle.visualPromptRules, bundle.uiAudioPromptRules, bundle.modelPromptRules].join("\n");
    for (const term of bannedProviderTerms) {
      expect(providerText.toLowerCase()).not.toContain(term.toLowerCase());
    }
    expect(bundle.modelPromptRules).toContain("low-poly GLB");
    expect(bundle.modelPromptRules).toContain("model budget");
  });

  it("uses the prompt library profile to enrich production briefs", () => {
    const brief = createGameProductionBrief({
      idea: "未来科幻塔防，建造激光塔防守基地",
      engineType: "phaser2d",
      templateFamily: "tower_defense"
    });

    expect(brief.coreLoop).toEqual(expect.arrayContaining(["build first tower", "first wave", "upgrade choice"]));
    expect(brief.pressureTypes).toEqual(expect.arrayContaining(["route pressure", "economy pressure"]));
    expect(brief.rewardPath).toEqual(expect.arrayContaining(["gold", "tower upgrade", "perfect wave bonus"]));
    expect(brief.firstMinuteExperience).toContain("mixed enemy wave");
  });

  it("exposes prompt bundles through the generation API", async () => {
    const handler = createGenerationApiHandler({ env: {} });
    const response = await handler({
      method: "POST",
      path: "/api/generate-game-dev-prompt-bundle",
      body: {
        idea: "3D 太空射击，升级武器打 Boss",
        profileId: "three_d_space_shooter",
        engineType: "threejs3d"
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.gameDevPromptBundle.profileId).toBe("three_d_space_shooter");
    expect(response.body.gameDevPromptBundle.threeGenre).toBe("flight_shooter");
    expect(response.body.gameDevPromptBundle.directorPrompt).toContain("JSON only");
  });

  it("creates profile-specific guided questions without leaking internal developer prompts", () => {
    const towerDefense = buildProfileGuidedQuestions("strategy_tower_defense", "未来科幻塔防");
    const flightShooter = buildProfileGuidedQuestions("vertical_flight_shooter", "纵向飞行射击打 Boss");
    const platformer = buildProfileGuidedQuestions("platform_jumper", "忍者平台跳跃");
    const matchThree = buildProfileGuidedQuestions("match_three", "三消闯关");
    const rpg = buildProfileGuidedQuestions("light_rpg", "轻 RPG 打怪升级");

    expect(towerDefense).toHaveLength(5);
    expect(flightShooter).toHaveLength(5);
    expect(platformer).toHaveLength(5);
    expect(matchThree).toHaveLength(5);
    expect(rpg).toHaveLength(5);

    const towerText = visibleQuestionText(towerDefense);
    const flightText = visibleQuestionText(flightShooter);
    const platformText = visibleQuestionText(platformer);
    const matchText = visibleQuestionText(matchThree);
    const rpgText = visibleQuestionText(rpg);

    expect(towerText).toMatch(/路线|炮塔|波次|金币|基地生命|升级/);
    expect(flightText).toMatch(/武器|敌机编队|弹幕|护盾|Boss/);
    expect(platformText).toMatch(/跳跃|机关|检查点|隐藏奖励|移动平台/);
    expect(matchText).toMatch(/连锁|特殊道具|步数|目标|消除/);
    expect(rpgText).toMatch(/技能|怪物|任务|背包|成长/);

    expect(new Set([towerText, flightText, platformText, matchText, rpgText]).size).toBe(5);
    for (const text of [towerText, flightText, platformText, matchText, rpgText]) {
      expect(text).not.toContain("请生成一款 2D Phaser 游戏");
      expect(text).not.toContain("原始创意");
      expect(text).not.toContain("开发提示词");
      expect(text).not.toContain("developerPrompt");
    }
  });

  it("builds guided question prompt bundles with decision slots and director impact", () => {
    const bundle = buildGuidedQuestionPromptBundle({
      idea: "未来科幻塔防",
      profileId: "strategy_tower_defense",
      engineType: "phaser2d"
    });

    expect(bundle.profileId).toBe("strategy_tower_defense");
    expect(bundle.questions.every((question) => question.profileId === "strategy_tower_defense")).toBe(true);
    expect(bundle.questions.map((question) => question.decisionSlot)).toEqual([
      "route_layout",
      "player_ability",
      "hazard_pressure",
      "progression_reward",
      "feedback_outcome"
    ]);
    expect(bundle.questions.every((question) => question.affectsDirector.length > 0)).toBe(true);
  });

  it("creates different profile gameplay plans for playable directors", () => {
    const towerPlan = buildProfileGameplayPlan("strategy_tower_defense");
    const flightPlan = buildProfileGameplayPlan("vertical_flight_shooter");
    const platformPlan = buildProfileGameplayPlan("platform_jumper");

    expect(towerPlan.genreMechanics).toEqual(expect.arrayContaining(["path_defense", "tower_building", "wave_economy"]));
    expect(flightPlan.genreMechanics).toEqual(expect.arrayContaining(["enemy_formations", "projectile_pressure", "weapon_upgrades"]));
    expect(platformPlan.genreMechanics).toEqual(expect.arrayContaining(["jump_timing", "moving_platforms", "checkpoint_route"]));
    expect(new Set([
      towerPlan.genreMechanics.join(","),
      flightPlan.genreMechanics.join(","),
      platformPlan.genreMechanics.join(",")
    ]).size).toBe(3);
    expect(towerPlan.spawnTimeline).toHaveLength(3);
    expect(flightPlan.progressionRules).toContain("power-up changes the attack pattern before the finale");
  });
});

function visibleQuestionText(questions: ReturnType<typeof buildProfileGuidedQuestions>): string {
  return questions
    .flatMap((question) => [
      question.label,
      question.prompt,
      question.defaultAnswer,
      ...(question.options ?? [])
    ])
    .join(" ");
}
