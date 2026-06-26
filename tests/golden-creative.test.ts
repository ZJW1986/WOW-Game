import { describe, expect, it } from "vitest";
import type { AssetPack, GameplayDsl, TemplateFamily } from "../src/core/types";
import { createGenerationService } from "../src/services/generationService";
import { generateThreeGameMvp } from "../src/services/threeGameService";
import { runHeadlessPhaserTemplate } from "./utils/headlessPhaser";

describe("creative golden suite", () => {
  const cases: Array<{
    idea: string;
    templateFamily: TemplateFamily;
    expectedDslAction: string;
  }> = [
    {
      idea: "太空飞船躲陨石",
      templateFamily: "top_down",
      expectedDslAction: "spawn_zone"
    },
    {
      idea: "猫咪平台跳跃 + 钥匙开门",
      templateFamily: "platformer",
      expectedDslAction: "open_door"
    },
    {
      idea: "未来塔防三波敌人",
      templateFamily: "tower_defense",
      expectedDslAction: "spawn_zone"
    },
    {
      idea: "8-puzzle 数字推板",
      templateFamily: "grid_logic",
      expectedDslAction: "win"
    }
  ];

  for (const item of cases) {
    it(`runs ${item.idea} from guided answers to playable with a DSL hit`, async () => {
      const service = createGenerationService({
        deepseekApiKey: "test-key",
        fetcher: async ({ init }) => {
          const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
          const prompt = body.messages.at(-1)?.content ?? "";
          return JSON.stringify({ choices: [{ message: { content: JSON.stringify(mockModelOutput(prompt, item.templateFamily)) } }] });
        }
      });
      const questionResult = await service.generateGuidedQuestions({
        idea: item.idea,
        templateFamily: item.templateFamily,
        model: "deepseek-v4-flash"
      });

      const playable = await service.generatePlayableVersion({
        idea: item.idea,
        answers: questionResult.questions.map((question) => ({
          questionId: question.id,
          value: question.defaultAnswer ?? "默认选择",
          answeredAt: "2026-06-24T00:00:00.000Z"
        })),
        templateFamily: item.templateFamily,
        projectId: `golden-${item.templateFamily}`,
        baseUrl: "https://wow.example",
        model: "deepseek-v4-flash"
      });
      const gameplayDsl = playable.project.artifacts.find((artifact) => artifact.fileName === "gameplay-dsl.json")?.content as GameplayDsl;

      expect(questionResult.questions).toHaveLength(5);
      expect(playable.fallbacksUsed).toEqual([]);
      expect(gameplayDsl.version).toBe("2");

      const headless = runHeadlessPhaserTemplate({
        templateFamily: item.templateFamily,
        config: playable.project.gameConfig,
        hooks: playable.project.gameHooks,
        gameplayDsl: gameplayDsl.version === "2" ? gameplayDsl : undefined,
        maxMs: 60_000
      });

      expect(headless.errors).toEqual([]);
      expect(headless.stateChanged).toBe(true);
      expect(["won", "lost"]).toContain(headless.phase);
      expect(headless.dslEffects.length).toBeGreaterThan(0);
      expect(headless.dslEffects.map((effect) => effect.type)).toContain(item.expectedDslAction);
    });
  }

  it("generates a 3D runner contract with runner-specific gameplay and assets", () => {
    const result = generateThreeGameMvp({
      idea: "3D 跑酷 + 三车道收金币",
      projectId: "golden-3d-runner",
      baseUrl: "https://wow.example",
      viewportMode: "app_9_16",
      gameType3d: "runner"
    });

    expect(result.threeSceneDirector.genre).toBe("runner");
    expect(result.threeSceneDirector.movementMode).toBe("auto_runner");
    expect(result.threeSceneDirector.layoutMode).toBe("lane_track");
    expect(result.threeSceneDirector.abilities).toEqual(expect.arrayContaining(["lane_change", "jump"]));
    expect(result.threeAssetPlan.assets.map((asset) => asset.prompt).join(" ")).toMatch(/runner|lane|barrier|coin/i);
    expect(result.threeVerificationReport.deliveryReady).toBe(true);
  });
});

function mockModelOutput(prompt: string, templateFamily: TemplateFamily): unknown {
  if (prompt.includes("llm.guided_questions")) {
    return {
      questions: Array.from({ length: 5 }, (_, index) => ({
        id: `q${index + 1}`,
        label: `Question ${index + 1}`,
        prompt: `${templateFamily} decision ${index + 1}`,
        inputType: "short_text",
        options: [],
        defaultAnswer: `answer ${index + 1}`,
        required: true
      }))
    };
  }
  if (prompt.includes("llm.classification")) {
    return {
      templateFamily,
      reasons: [`${templateFamily} golden creative route`],
      risks: [],
      unsupportedRequests: []
    };
  }
  if (prompt.includes("llm.mature_game_brief")) {
    return {
      referencePatternId: `pattern-${templateFamily}`,
      coreLoop: ["read goal", "act", "score", "avoid pressure"],
      firstThirtySeconds: ["teach", "reward", "pressure", "finish"],
      visualTheme: "clear arcade fantasy",
      feedbackChecklist: ["collect cue", "hit cue", "win cue"],
      difficultyCurve: ["teach", "mix", "finale"],
      gameFeelMoments: ["first reward", "pressure reveal", "clear ending"]
    };
  }
  if (prompt.includes("llm.gdd")) {
    return {
      concept: `${templateFamily} golden concept`,
      loop: ["start", "move", "interact", "resolve"],
      entities: ["player", "reward", "hazard", "goal"],
      level: { width: 960, height: 540, collectibles: 6, hazards: 4, winScore: 6 },
      numbers: { playerSpeed: 240 },
      implementationRoute: "Use locked template runtime with DSL."
    };
  }
  if (prompt.includes("llm.game_config")) return gameConfigFor(templateFamily);
  if (prompt.includes("llm.game_hooks")) return gameHooksFor(templateFamily);
  if (prompt.includes("llm.gameplay_dsl")) return gameplayDslFor(templateFamily);
  return {};
}

function gameConfigFor(templateFamily: TemplateFamily) {
  const gameplayByTemplate = {
    top_down: { primaryAction: "dodge_collect", enemyBehavior: "chase", objectiveMode: "collect_score", playerAbility: "dash", spawnPattern: "lanes" },
    platformer: { primaryAction: "jump_reach_goal", enemyBehavior: "patrol", objectiveMode: "reach_exit", playerAbility: "jump", spawnPattern: "staggered" },
    tower_defense: { primaryAction: "defend_route", enemyBehavior: "wave", objectiveMode: "defend_base", playerAbility: "build", spawnPattern: "waves" },
    grid_logic: { primaryAction: "solve_grid", enemyBehavior: "timer", objectiveMode: "solve_state", playerAbility: "push", spawnPattern: "grid" },
    ui_heavy: { primaryAction: "manage_choices", enemyBehavior: "timer", objectiveMode: "survive_timer", playerAbility: "choose", spawnPattern: "fixed" }
  } as const;
  return {
    templateFamily,
    title: `${templateFamily} golden`,
    pitch: `${templateFamily} golden playable`,
    playerGoal: "Reach the clear state.",
    controls: templateFamily === "platformer" ? ["ArrowLeft", "ArrowRight", "Space"] : ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"],
    difficulty: "normal",
    referencedAssetKeys: assetPack().assets.map((asset) => asset.assetKey),
    gameplay: gameplayByTemplate[templateFamily],
    level: { width: 960, height: 540, collectibles: 6, hazards: 4, winScore: 6 }
  };
}

function gameHooksFor(templateFamily: TemplateFamily) {
  return {
    enemyRules: { movement: templateFamily === "tower_defense" ? "wave" : "chase", speed: 120, waveIntervalMs: 700 },
    collectibleRules: { placement: templateFamily === "platformer" ? "arc" : "line", value: 1, respawn: false },
    winCondition: {
      mode: templateFamily === "tower_defense" ? "defend_base" : templateFamily === "grid_logic" ? "solve_state" : templateFamily === "platformer" ? "reach_exit" : "collect_score",
      target: templateFamily === "tower_defense" ? 3 : 6
    },
    failCondition: {
      mode: templateFamily === "tower_defense" ? "base_destroyed" : templateFamily === "grid_logic" ? "moves_exhausted" : "hit_hazard",
      lives: templateFamily === "tower_defense" ? 5 : templateFamily === "grid_logic" ? 8 : 2
    },
    numberTuning: { playerSpeed: 240, jumpVelocity: 430, hazardSpeed: 120 },
    levelLayout: {
      platforms: templateFamily === "platformer" ? [{ x: 480, y: 510, width: 920, height: 28 }] : [],
      lanes: templateFamily === "tower_defense" ? [{ y: 240, speed: 90, count: 3 }] : [],
      grid: templateFamily === "grid_logic" ? { columns: 5, rows: 3 } : { columns: 0, rows: 0 },
      gridState: templateFamily === "grid_logic"
        ? [
            [0, 0, 0, 0, 0],
            [1, 2, 0, 3, 0],
            [0, 0, 0, 0, 0]
          ]
        : undefined
    },
    levelFlow: {
      spawnPoint: { x: 80, y: 240 },
      safeZones: [],
      cameraIntent: "follow action",
      tutorialBeats: ["move", "collect", "finish"]
    }
  };
}

function gameplayDslFor(templateFamily: TemplateFamily): GameplayDsl {
  if (templateFamily === "platformer") {
    return {
      version: "2",
      rules: [
        {
          id: "cat-keys-open-door",
          when: { type: "score", op: ">=", value: 1 },
          do: [{ type: "open_door", assetKey: "item.collectible" }]
        }
      ]
    };
  }
  if (templateFamily === "grid_logic") {
    return {
      version: "2",
      rules: [{ id: "grid-clear-win", when: { type: "score", op: ">=", value: 0 }, do: [{ type: "win", message: "puzzle solved" }] }]
    };
  }
  return {
    version: "2",
    zones: [{ id: "main-lane", x: 620, y: 120, width: 180, height: 280 }],
    rules: [
      {
        id: `${templateFamily}-spawn-pressure`,
        when: { type: "score", op: ">=", value: 3 },
        do: [{ type: "spawn_zone", zoneId: "main-lane", enemyType: templateFamily === "tower_defense" ? "charger" : "chaser", count: 3 }]
      }
    ]
  };
}

function assetPack(): AssetPack {
  return {
    versionId: "golden-assets",
    assets: ["cover.main", "ui.button", "player.hero", "world.background", "hazard.enemy", "item.collectible", "item.key", "door.portal"].map((assetKey) => ({
      assetKey,
      type: "image",
      purpose: assetKey,
      style: "arcade",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: assetKey,
      status: "mock",
      prompt: assetKey,
      acceptedFileTypes: ["image/png"],
      previewUrl: `/${assetKey}.png`,
      source: "mock",
      fileUrl: `/${assetKey}.png`,
      provider: "mock",
      model: "mock",
      generationParams: {}
    }))
  };
}
