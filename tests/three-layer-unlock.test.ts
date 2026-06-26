import { describe, expect, it } from "vitest";
import { gameplayDslSchema, phaserPluginDirectorSchema, sandboxPluginSchema, validateArtifact } from "../src/core/schemas";
import type { AssetPack, GameHooks, PhaserPluginDirector, SandboxPlugin } from "../src/core/types";
import { compileGameplayDsl, validateGameplayDsl } from "../src/services/gameplayDsl";
import { compilePhaserPluginDirectorToHooks, validatePhaserPluginDirector } from "../src/services/phaserPluginDirector";
import { validateSandboxPlugin } from "../src/services/sandboxPlugin";

const assetPack: AssetPack = {
  versionId: "v-test",
  assets: [
    {
      assetKey: "player.hero",
      type: "image",
      purpose: "player",
      style: "test",
      generationMode: "mock",
      copyrightStatus: "placeholder",
      spec: "64x64",
      status: "mock",
      prompt: "player",
      acceptedFileTypes: ["image/*"],
      previewUrl: "data:image/svg+xml,player",
      source: "mock",
      fileUrl: "data:image/svg+xml,player",
      provider: "mock",
      model: "mock",
      generationParams: {}
    }
  ]
};

describe("three-layer generation unlock contracts", () => {
  it("accepts commercial-grade layer-1 hooks", () => {
    const hooks: GameHooks = {
      enemyRules: { movement: "wave", speed: 150, waveIntervalMs: 420 },
      collectibleRules: { placement: "arc", value: 1, respawn: false },
      winCondition: { mode: "collect_score", target: 6 },
      failCondition: { mode: "hit_hazard", lives: 2 },
      numberTuning: { playerSpeed: 280, jumpVelocity: 460, hazardSpeed: 150 },
      levelLayout: {
        platforms: [{ x: 480, y: 510, width: 920, height: 28 }],
        lanes: [{ y: 260, speed: 150, count: 2 }],
        grid: { columns: 0, rows: 0 }
      },
      enemyArchetypes: [
        { id: "chaser_1", type: "chaser", count: 2, speed: 135, spawnAfterMs: 0, laneY: 260 },
        { id: "mine_1", type: "mine", count: 2, speed: 0, spawnAfterMs: 5000, warningMs: 500 }
      ],
      attackRules: {
        contactDamage: 1,
        dashDamage: 0,
        projectileSpeed: 190,
        projectileCooldownMs: 1400,
        explosionRadius: 80,
        explosionDelayMs: 650,
        warningMs: 420
      },
      stageGoals: [
        {
          id: "teach",
          label: "Learn movement",
          startsAtMs: 0,
          durationMs: 5000,
          objective: "learn_controls",
          target: 1,
          enemyMix: ["chaser_1"],
          rewardPacing: "slow"
        }
      ],
      impactRules: {
        hitStopMs: 80,
        screenShakeIntensity: 0.02,
        explosionParticles: 24,
        knockbackForce: 180,
        invulnerabilityMs: 650,
        comboWindowMs: 1800
      },
      encounterTimeline: [
        { atMs: 5000, trigger: "time", event: "spawn_mine", intensity: 2, message: "Mines armed" }
      ]
    };

    expect(validateArtifact("game-hooks", hooks).success).toBe(true);
  });

  it("compiles whitelisted gameplay DSL into hook fragments", () => {
    const compiled = compileGameplayDsl({
      version: "1",
      rules: [
        { id: "score-wave", when: "score >= 3", do: "spawn_wave", enemyType: "charger", count: 3 },
        { id: "time-shot", when: "timeMs >= 8000", do: "projectile_burst", count: 2, assetKey: "player.hero" },
        { id: "time-reward", when: "timeMs >= 10000", do: "reward_burst", count: 2, message: "Reward route opened" },
        { id: "finale", when: "timeMs >= 16000", do: "stage_change", stageId: "finale", message: "Final pressure" },
        { id: "impact", when: "score >= 1", do: "effect", effect: "screen_shake" }
      ]
    }, assetPack);

    expect(compiled.success).toBe(true);
    if (!compiled.success) return;
    expect(compiled.hooks.enemyArchetypes?.map((enemy) => enemy.type)).toEqual(["charger", "charger"]);
    expect(compiled.hooks.encounterTimeline?.map((event) => event.event)).toEqual([
      "spawn_wave",
      "projectile_burst",
      "reward_burst",
      "finale"
    ]);
    expect(compiled.hooks.stageGoals?.map((stage) => stage.id)).toContain("finale");
    expect(compiled.hooks.impactRules).toBeDefined();
    if (!compiled.hooks.impactRules) return;
    expect(compiled.hooks.impactRules.screenShakeIntensity).toBeGreaterThan(0.02);
  });

  it("rejects illegal DSL triggers, actions, and unknown asset keys", () => {
    expect(gameplayDslSchema.safeParse({
      version: "1",
      rules: [{ id: "bad", when: "player.health < 0", do: "spawn_wave" }]
    }).success).toBe(false);

    const validation = validateGameplayDsl({
      version: "1",
      rules: [{ id: "bad-asset", when: "score >= 1", do: "reward_burst", assetKey: "missing.asset" }]
    }, assetPack);

    expect(validation.success).toBe(false);
    if (validation.success) return;
    expect(validation.errors).toContain("Unknown assetKey: missing.asset");
  });

  it("validates sandbox plugin metadata without executing code", () => {
    const plugin: SandboxPlugin = {
      version: "1",
      name: "safe-pressure-module",
      code: "api.spawnEnemy('charger'); api.shakeCamera(0.02);",
      allowedApis: ["spawnEnemy", "shakeCamera"],
      referencedAssetKeys: ["player.hero"],
      fallbackLayer: "gameplay-dsl"
    };

    expect(sandboxPluginSchema.safeParse(plugin).success).toBe(true);
    expect(validateSandboxPlugin(plugin, assetPack).accepted).toBe(true);
  });

  it("rejects sandbox plugins that use forbidden APIs or missing assets", () => {
    const result = validateSandboxPlugin({
      version: "1",
      name: "unsafe-module",
      code: "fetch('/api/secret'); document.body.innerHTML = '';",
      allowedApis: ["spawnEnemy", "readFile"],
      referencedAssetKeys: ["missing.asset"],
      fallbackLayer: "game-hooks"
    }, assetPack);

    expect(result.accepted).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "Disallowed sandbox API: readFile",
      "Unknown sandbox assetKey: missing.asset"
    ]));
    expect(result.errors.some((error) => error.includes("fetch"))).toBe(true);
    expect(result.errors.some((error) => error.includes("document"))).toBe(true);
  });

  it("accepts and compiles a whitelisted Phaser plugin director DSL", () => {
    const plugin: PhaserPluginDirector = {
      version: "1",
      profileId: "vertical_flight_shooter",
      actions: [
        { id: "enemy-wave", type: "spawn_enemy", atMs: 6000, enemyType: "shooter", count: 3 },
        { id: "boss-burst", type: "spawn_projectile", atMs: 18000, count: 4 },
        { id: "power-reward", type: "spawn_item", atMs: 10000, assetKey: "player.hero", count: 1 },
        { id: "hit-flash", type: "hit_flash", atMs: 0 },
        { id: "shake", type: "camera_shake", atMs: 18000, intensity: 0.024 },
        { id: "shoot", type: "player_ability", ability: "shoot" }
      ]
    };

    expect(phaserPluginDirectorSchema.safeParse(plugin).success).toBe(true);
    expect(validatePhaserPluginDirector(plugin, assetPack).accepted).toBe(true);

    const compiled = compilePhaserPluginDirectorToHooks(plugin, assetPack);
    expect(compiled.success).toBe(true);
    if (!compiled.success) return;
    expect(compiled.hooks.enemyArchetypes?.map((enemy) => enemy.type)).toContain("shooter");
    expect(compiled.hooks.encounterTimeline?.map((event) => event.event)).toEqual(
      expect.arrayContaining(["spawn_wave", "projectile_burst", "reward_burst"])
    );
    expect(compiled.hooks.impactRules?.screenShakeIntensity).toBeGreaterThan(0.02);
  });

  it("rejects Phaser plugin directors containing lifecycle or arbitrary JavaScript", () => {
    const result = validatePhaserPluginDirector({
      version: "1",
      profileId: "platform_jumper",
      actions: [
        { id: "bad-code", type: "custom_code", code: "new Phaser.Game({}); fetch('/x'); document.body.innerHTML='';" },
        { id: "bad-scene", type: "scene_lifecycle", lifecycle: "create" },
        { id: "bad-asset", type: "spawn_item", atMs: 1000, assetKey: "missing.asset", count: 1 }
      ]
    }, assetPack);

    expect(result.accepted).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "Forbidden Phaser lifecycle action: scene_lifecycle",
      "Forbidden custom code action: custom_code",
      "Unknown plugin assetKey: missing.asset"
    ]));
    expect(result.errors.some((error) => error.includes("new Phaser.Game"))).toBe(true);
    expect(result.errors.some((error) => error.includes("fetch"))).toBe(true);
    expect(result.errors.some((error) => error.includes("document"))).toBe(true);
  });
});
