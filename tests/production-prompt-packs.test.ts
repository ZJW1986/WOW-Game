import { describe, expect, it } from "vitest";
import { createGenerationApiHandler } from "../src/services/generationApi";
import { createGenerationService } from "../src/services/generationService";
import {
  createAudioPromptPack,
  createGameProductionBrief,
  createModelPromptPack,
  createUiAssetKit,
  createVisualPromptPack
} from "../src/services/productionPromptPacks";
import { createStyleSheet } from "../src/core/pipeline";
import { generateThreeGameMvp } from "../src/services/threeGameService";
import { createRuntimeAssetReport } from "../src/ui/previewAssets";

const bannedProviderTerms = ["developerPrompt", "Phaser", "Three.js", "gameHooks", "scene lifecycle", "WASD", "win condition"];

function memoryStore() {
  const writes = new Map<string, string>();
  return {
    writeText: async (path: string, content: string) => {
      writes.set(path, content);
    },
    readText: async (path: string) => writes.get(path) ?? null,
    writeBytes: async () => undefined,
    readBytes: async () => null,
    ensureDir: async () => undefined
  };
}

function confirmedAssetsFixture() {
  return {
    assets: [
      coreAsset("background", "world.background", "data:image/png;base64,bg"),
      coreAsset("player", "player.ship", "data:image/png;base64,player"),
      coreAsset("hazard", "hazard.enemy", "data:image/png;base64,hazard"),
      coreAsset("collectible", "item.collectible", "data:image/png;base64,item")
    ]
  };
}

function coreAsset(slot: "background" | "player" | "hazard" | "collectible", assetKey: string, fileUrl: string) {
  return {
    generationMode: "model" as const,
    copyrightStatus: "generated" as const,
    spec: "test asset",
    status: "generated" as const,
    provider: "test",
    model: "test",
    generationParams: {},
    slot,
    assetKey,
    type: "image" as const,
    label: assetKey,
    prompt: `${assetKey} prompt`,
    style: "arcade",
    purpose: "runtime core asset",
    acceptedFileTypes: ["image/*"],
    previewUrl: fileUrl,
    fileUrl,
    source: "generated" as const,
    approvalStatus: "approved" as const,
    validationStatus: "passed" as const,
    validationErrors: []
  };
}

describe("production prompt packs", () => {
  it("creates type-specific 2D visual prompts for every template", () => {
    const cases = [
      { templateFamily: "tower_defense" as const, key: "world.path", background: /top-down tileable defense map|buildable zones/, player: /turret|fortress|base tower/, collectible: /gold coin|energy battery|resource box/ },
      { templateFamily: "platformer" as const, key: "player.hero", background: /side-scrolling parallax/, player: /side-view playable hero/, collectible: /coin|gem|scroll|ability pickup/ },
      { templateFamily: "top_down" as const, key: "player.ship", background: /top-down playable arena map/, player: /top-down hero|vehicle|ship|avatar/, collectible: /key|coin|energy cell|gem|quest item/ },
      { templateFamily: "grid_logic" as const, key: "world.tiles", background: /puzzle board|tile grid/, player: /cursor|movable puzzle piece/, collectible: /target block|key|energy node|goal token/ },
      { templateFamily: "ui_heavy" as const, key: "player.panel", background: /management room|shop counter|card table|decision hub/, player: /avatar portrait|shop mascot|card hero|panel emblem/, collectible: /order ticket|coin|card reward|receipt|upgrade token/ }
    ];

    for (const item of cases) {
      const productionBrief = createGameProductionBrief({
        idea: `${item.templateFamily} test game`,
        engineType: "phaser2d",
        templateFamily: item.templateFamily
      });
      const pack = createVisualPromptPack({
        idea: `${item.templateFamily} test game`,
        engineType: "phaser2d",
        productionBrief,
        packId: `${item.templateFamily}-visual-test`
      });
      const bySlot = new Map(pack.prompts.map((prompt) => [prompt.slot, prompt]));
      expect(pack.prompts.map((prompt) => prompt.assetKey)).toContain(item.key);
      expect(bySlot.get("background")?.finalImagePrompt).toMatch(item.background);
      expect(bySlot.get("background")?.finalImagePrompt).toMatch(/no foreground gameplay subjects/);
      expect(bySlot.get("player")?.finalImagePrompt).toMatch(item.player);
      expect(bySlot.get("collectible")?.finalImagePrompt).toMatch(item.collectible);
    }
  });

  it("accepts tower-defense runtime keys in the runtime asset report", () => {
    const report = createRuntimeAssetReport({
      versionId: "v1",
      assets: [
        coreAsset("background", "world.path", "data:image/png;base64,bg"),
        coreAsset("player", "player.tower", "data:image/png;base64,player"),
        coreAsset("hazard", "hazard.enemy", "data:image/png;base64,hazard"),
        coreAsset("collectible", "item.collectible", "data:image/png;base64,item")
      ]
    });

    expect(report.ready).toBe(true);
    expect(report.slots.find((slot) => slot.slot === "background")?.assetKey).toBe("world.path");
    expect(report.slots.find((slot) => slot.slot === "player")?.assetKey).toBe("player.tower");
  });

  it("creates distinct 3D model prompts for each genre", () => {
    const genres = [
      "flight_shooter",
      "runner",
      "third_person_collect",
      "exploration",
      "dodge_collect",
      "futuristic_tower_defense"
    ] as const;
    const playerPrompts = genres.map((genre) => {
      const result = generateThreeGameMvp({
        idea: `${genre} game`,
        projectId: `genre-${genre}`,
        baseUrl: "http://localhost:5176",
        gameType3d: genre
      });
      const pack = createModelPromptPack({
        idea: `${genre} game`,
        threeGameBrief: result.threeGameBrief,
        threeSceneDirector: result.threeSceneDirector,
        packId: `${genre}-model-test`
      });
      return pack.prompts.find((prompt) => prompt.assetKey === "three.model.player")?.finalModelPrompt ?? "";
    });

    expect(new Set(playerPrompts).size).toBe(genres.length);
    expect(playerPrompts[0]).toMatch(/spaceship|fighter/);
    expect(playerPrompts[1]).toMatch(/runner character|vehicle/);
    expect(playerPrompts[5]).toMatch(/base core|turret/);
  });

  it("keeps 2D runtime image prompts slot-isolated for space games", () => {
    const productionBrief = createGameProductionBrief({
      idea: "科幻飞船躲避陨石收集能量",
      engineType: "phaser2d",
      templateFamily: "top_down"
    });
    const visualPromptPack = createVisualPromptPack({
      idea: "科幻飞船躲避陨石收集能量",
      engineType: "phaser2d",
      productionBrief,
      packId: "visual-isolation-test"
    });

    const byKey = new Map(visualPromptPack.prompts.map((prompt) => [prompt.assetKey, prompt.finalImagePrompt]));
    const background = byKey.get("world.background") ?? "";
    const player = byKey.get("player.ship") ?? "";
    const hazard = byKey.get("hazard.enemy") ?? "";
    const collectible = byKey.get("item.collectible") ?? "";

    expect(background).toMatch(/top-down playable arena map|environment background/);
    expect(background.split("negative constraints:")[0]).not.toMatch(/飞船|ship|player|陨石|asteroid|meteor|collect|能量|energy/i);

    expect(player).toMatch(/飞船|ship/i);
    expect(player.split("negative constraints:")[0]).not.toMatch(/陨石|asteroid|meteor|collectible/i);

    expect(hazard).toMatch(/陨石|asteroid|meteor/i);
    expect(hazard.split("negative constraints:")[0]).not.toMatch(/飞船|ship|player|collectible/i);

    expect(collectible).toMatch(/能量|energy|star|orb/i);
    expect(collectible.split("negative constraints:")[0]).not.toMatch(/飞船|spaceship|player|陨石|asteroid|meteor/i);
  });

  it("injects the global style sheet into every visual prompt", () => {
    const productionBrief = createGameProductionBrief({
      idea: "tower defense with energy turrets",
      engineType: "phaser2d",
      templateFamily: "tower_defense"
    });
    const styleSheet = createStyleSheet({
      idea: "tower defense with energy turrets",
      templateFamily: "tower_defense",
      title: "Energy Bastion"
    });
    const visualPromptPack = createVisualPromptPack({
      idea: "tower defense with energy turrets",
      engineType: "phaser2d",
      productionBrief,
      packId: "visual-style-sheet-test",
      styleSheet
    });
    const prompts = visualPromptPack.prompts.filter((prompt) => prompt.promptType !== "cover_poster");
    const commonPrefix = longestCommonPrefix(prompts.map((prompt) => prompt.finalImagePrompt));

    expect(commonPrefix.length).toBeGreaterThanOrEqual(60);
    expect(commonPrefix).toContain(styleSheet.palette.join(","));
    expect(commonPrefix).toContain(`brushwork=${styleSheet.brushwork}`);
    expect(commonPrefix).toContain(`lighting=${styleSheet.lighting}`);
    for (const prompt of prompts) {
      expect(prompt.negativePrompt).toContain(styleSheet.negativePrompt);
    }
  });

  it("passes the style sheet prefix through generated asset candidates", async () => {
    const service = createGenerationService();
    const productionBrief = createGameProductionBrief({
      idea: "top down spaceship energy collection",
      engineType: "phaser2d",
      templateFamily: "top_down"
    });
    const styleSheet = createStyleSheet({
      idea: "top down spaceship energy collection",
      templateFamily: "top_down",
      title: "Neon Orbit"
    });
    const visualPromptPack = createVisualPromptPack({
      idea: "top down spaceship energy collection",
      engineType: "phaser2d",
      productionBrief,
      packId: "candidate-style-sheet-test",
      styleSheet
    });

    const result = await service.generateAssetCandidates({
      idea: "top down spaceship energy collection",
      answers: [],
      templateFamily: "top_down",
      model: "mock-designer",
      visualPromptPack
    });
    const firstCandidate = result.assetCandidates.candidates[0];

    expect(firstCandidate.prompt.startsWith("Style: palette=")).toBe(true);
    expect(firstCandidate.prompt).toContain(styleSheet.palette.join(","));
    expect(firstCandidate.generationParams?.finalImagePrompt).toBe(firstCandidate.prompt);
  });

  it("keeps visual, UI, audio, and model provider prompts isolated from runtime prompt language", () => {
    const productionBrief = createGameProductionBrief({
      idea: "科幻飞船躲避陨石收集能量",
      engineType: "phaser2d",
      templateFamily: "top_down"
    });
    const visualPromptPack = createVisualPromptPack({
      idea: "科幻飞船躲避陨石收集能量",
      engineType: "phaser2d",
      productionBrief,
      packId: "visual-test"
    });
    const uiAssetKit = createUiAssetKit({
      idea: "科幻飞船躲避陨石收集能量",
      productionBrief,
      packId: "ui-test"
    });
    const audioPromptPack = createAudioPromptPack({
      idea: "科幻飞船躲避陨石收集能量",
      productionBrief,
      packId: "audio-test"
    });
    const three = generateThreeGameMvp({
      idea: "3D 飞机躲避陨石收集能量",
      projectId: "prompt-pack-three",
      baseUrl: "http://localhost:5176",
      gameType3d: "flight_shooter"
    });
    const modelPromptPack = createModelPromptPack({
      idea: "3D 飞机躲避陨石收集能量",
      threeGameBrief: three.threeGameBrief,
      threeSceneDirector: three.threeSceneDirector,
      packId: "model-test"
    });

    expect(uiAssetKit.prompts[0].finalImagePrompt).toContain("Context:");
    expect(uiAssetKit.prompts[0].finalImagePrompt).toContain("Subject:");
    expect(uiAssetKit.prompts[0].finalImagePrompt).toContain("Items:");
    expect(uiAssetKit.prompts[0].finalImagePrompt).toContain("Style:");
    expect(uiAssetKit.prompts[0].finalImagePrompt).toContain("Technical:");

    const providerText = [
      ...visualPromptPack.prompts.map((prompt) => prompt.finalImagePrompt),
      ...uiAssetKit.prompts.map((prompt) => prompt.finalImagePrompt),
      ...audioPromptPack.prompts.map((prompt) => prompt.finalAudioPrompt),
      ...modelPromptPack.prompts.map((prompt) => prompt.finalModelPrompt)
    ].join("\n");
    for (const term of bannedProviderTerms) {
      expect(providerText.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it("adds production artifacts to generated 2D playables", async () => {
    const handler = createGenerationApiHandler({
      env: { PUBLIC_BASE_URL: "http://localhost:5176" },
      storeIO: memoryStore()
    });
    const response = await handler({
      method: "POST",
      path: "/api/generate-playable",
      body: {
        idea: "科幻飞船躲避陨石收集能量",
        answers: [],
        templateFamily: "top_down",
        projectId: "production-artifacts-2d",
        model: "mock-designer",
        confirmedAssets: confirmedAssetsFixture()
      }
    });

    expect(response.status).toBe(200);
    const fileNames = response.body.project.artifacts.map((artifact: { fileName: string }) => artifact.fileName);
    expect(fileNames).toEqual(expect.arrayContaining([
      "game-production-brief.json",
      "visual-prompt-pack.json",
      "ui-asset-kit.json",
      "audio-prompt-pack.json",
      "scene-map-plan.json"
    ]));
  });

  it("returns a structured CellCog missing-key report without blocking default generation", async () => {
    const handler = createGenerationApiHandler({
      env: {},
      storeIO: memoryStore()
    });
    const response = await handler({
      method: "POST",
      path: "/api/cellcog/generate-asset",
      body: {
        promptPackId: "visual-test",
        slot: "player",
        prompt: "isolated player sprite",
        requestedOutput: "png"
      }
    });

    expect(response.status).toBe(400);
    expect(response.body.cellcogGenerationReport).toMatchObject({
      provider: "cellcog",
      status: "missing_key",
      promptPackId: "visual-test",
      slot: "player",
      requestedOutput: "png"
    });
  });

  it("drives actual 2D asset candidates from the visual prompt pack", async () => {
    const service = createGenerationService({
      mediaGateway: {
        imageProvider: async ({ requirement }) => ({
          status: "generated",
          source: "generated",
          fileUrl: "data:image/png;base64,asset",
          previewUrl: "data:image/png;base64,asset",
          provider: "test-image-provider",
          model: "test",
          generationParams: {
            providerPrompt: requirement.prompt
          }
        })
      }
    });

    const result = await service.generateAssetCandidates({
      idea: "科幻飞船躲避陨石收集能量",
      templateFamily: "top_down",
      model: "mock-designer",
      answers: []
    });

    const prompts = result.assetCandidates.candidates.map((candidate) => candidate.prompt);
    expect(prompts[0]).toContain("Professional game environment background");
    expect(prompts[1]).toContain("Professional game runtime sprite/model concept");
    expect(prompts[2]).toContain("Professional game runtime sprite/model concept");
    expect(prompts[3]).toContain("Professional game runtime sprite/model concept");
    expect(result.assetCandidates.candidates.every((candidate) => candidate.generationParams?.promptSource === "visual-prompt-pack")).toBe(true);
  });

  it("supports requestedSlots for staged tower-defense asset generation", async () => {
    const service = createGenerationService({
      mediaGateway: {
        imageProvider: async ({ requirement }) => ({
          status: "generated",
          source: "generated",
          fileUrl: "data:image/png;base64,asset",
          previewUrl: "data:image/png;base64,asset",
          provider: "test-image-provider",
          model: "test",
          generationParams: {
            providerPrompt: requirement.prompt
          }
        })
      }
    });

    const result = await service.generateAssetCandidates({
      idea: "2D tower defense with turret base, enemy route, and gold income",
      templateFamily: "tower_defense",
      model: "mock-designer",
      answers: [],
      requestedSlots: ["background"]
    });

    expect(result.assetCandidates.candidates).toHaveLength(1);
    expect(result.assetCandidates.candidates[0]).toMatchObject({
      slot: "background",
      assetKey: "world.path"
    });
    expect(result.assetCandidates.candidates[0].prompt).toMatch(/top-down tileable defense map|buildable zones/);
    expect(result.assetCandidates.candidates[0].prompt).not.toMatch(/spaceship|player subject|coin stack/i);
  });

  it("upgrades shallow gameplay hooks into visible mature gameplay pressure", async () => {
    const service = createGenerationService({
      deepseekApiKey: "server-key",
      fetcher: async ({ init }) => {
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const prompt = body.messages.at(-1)?.content ?? "";
        if (prompt.includes("Task: llm.game_hooks.")) {
          return JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    enemyRules: { movement: "static", speed: 60, waveIntervalMs: 0 },
                    collectibleRules: { placement: "random", value: 1, respawn: false },
                    winCondition: { mode: "collect_score", target: 6 },
                    failCondition: { mode: "hit_hazard", lives: 1 },
                    numberTuning: { playerSpeed: 180, jumpVelocity: 300, hazardSpeed: 80 },
                    levelLayout: { platforms: [], lanes: [], grid: { columns: 0, rows: 0 } },
                    enemyArchetypes: [{ id: "only_one", type: "chaser", count: 1, speed: 80, spawnAfterMs: 0 }],
                    stageGoals: [{ id: "only_stage", label: "Only stage", startsAtMs: 0, durationMs: 5000, objective: "collect", target: 1, enemyMix: ["only_one"], rewardPacing: "slow" }],
                    encounterTimeline: [{ atMs: 1000, trigger: "time", event: "spawn_wave", intensity: 1, message: "one event" }]
                  })
                }
              }
            ]
          });
        }
        return JSON.stringify({ choices: [{ message: { content: "{}" } }] });
      }
    });

    const result = await service.generatePlayableVersion({
      idea: "科幻飞船躲避陨石收集能量，有爆炸和追击敌人",
      answers: [],
      templateFamily: "top_down",
      projectId: "mature-pressure-upgrade",
      baseUrl: "http://localhost:5176",
      model: "deepseek-v4-flash",
      confirmedAssets: confirmedAssetsFixture()
    });

    const hooks = result.project.gameHooks;
    expect(new Set(hooks.enemyArchetypes?.map((enemy) => enemy.type)).size).toBeGreaterThanOrEqual(2);
    expect(hooks.stageGoals?.map((stage) => stage.objective)).toEqual(["learn_controls", "collect", "finale"]);
    expect(hooks.encounterTimeline?.map((event) => event.event)).toEqual(
      expect.arrayContaining(["spawn_wave", "reward_burst", "projectile_burst"])
    );
    expect(hooks.feedbackRules?.audioCueKeys).toEqual(
      expect.arrayContaining(["sfx.collect", "sfx.hit", "sfx.win", "sfx.lose", "sfx.warning"])
    );
  });
});

function longestCommonPrefix(values: string[]): string {
  if (values.length === 0) return "";
  let prefix = values[0];
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix) && prefix.length > 0) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
}
