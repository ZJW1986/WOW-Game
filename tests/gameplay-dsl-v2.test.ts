import { describe, expect, it } from "vitest";
import type { AssetPack } from "../src/core/types";
import { gameplayDslSchema } from "../src/core/schemas";
import { compileGameplayDsl, createGameplayDslRuntime, validateGameplayDsl } from "../src/services/gameplayDsl";

describe("GameplayDSL v2 schema", () => {
  it("accepts structured triggers, actions, zones, counters, and items", () => {
    const result = gameplayDslSchema.safeParse({
      version: "2",
      zones: [{ id: "boss_gate", x: 640, y: 220, width: 96, height: 120 }],
      counters: [{ name: "keys", initialValue: 0 }],
      items: [{ assetKey: "item.key", grantsCounter: "keys", value: 1 }],
      rules: [
        {
          id: "collect-keys-open-gate",
          when: { type: "collected", assetKey: "item.key", count: 3 },
          do: [{ type: "open_door", assetKey: "door.boss" }]
        },
        {
          id: "boss-entered",
          when: { type: "zoneEntered", zoneId: "boss_gate" },
          do: [{ type: "spawn_zone", zoneId: "boss_gate", enemyType: "charger", count: 2 }]
        },
        {
          id: "combo-reward",
          when: { type: "combo", op: ">=", value: 4 },
          do: [{ type: "grant_item", assetKey: "item.key" }]
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("allows up to 80 rules and rejects 81 rules", () => {
    const rules = Array.from({ length: 80 }, (_, index) => ({
      id: `rule-${index}`,
      when: { type: "time", op: ">=", value: index * 100 },
      do: [{ type: "set_counter", name: "timer", value: index }]
    }));

    expect(gameplayDslSchema.safeParse({ version: "2", rules }).success).toBe(true);
    expect(gameplayDslSchema.safeParse({ version: "2", rules: [...rules, rules[0]] }).success).toBe(false);
  });

  it("enforces v2 complexity budgets for zones, counters, and items", () => {
    const rules = [
      {
        id: "score-wins",
        when: { type: "score", op: ">=", value: 1 },
        do: [{ type: "win" }]
      }
    ];
    const valid = {
      version: "2",
      rules,
      zones: Array.from({ length: 16 }, (_, index) => ({
        id: `zone-${index}`,
        x: index * 10,
        y: 0,
        width: 32,
        height: 32
      })),
      counters: Array.from({ length: 16 }, (_, index) => ({ name: `counter-${index}`, initialValue: 0 })),
      items: Array.from({ length: 16 }, (_, index) => ({ assetKey: `item.${index}`, value: 1 }))
    };

    expect(gameplayDslSchema.safeParse(valid).success).toBe(true);
    expect(gameplayDslSchema.safeParse({
      ...valid,
      zones: [...valid.zones, { id: "zone-over", x: 0, y: 0, width: 32, height: 32 }]
    }).success).toBe(false);
    expect(gameplayDslSchema.safeParse({
      ...valid,
      counters: [...valid.counters, { name: "counter-over", initialValue: 0 }]
    }).success).toBe(false);
    expect(gameplayDslSchema.safeParse({
      ...valid,
      items: [...valid.items, { assetKey: "item.over", value: 1 }]
    }).success).toBe(false);
  });

  it("rejects illegal v2 triggers with clear schema failure", () => {
    const result = gameplayDslSchema.safeParse({
      version: "2",
      rules: [{ id: "bad", when: { type: "eval", code: "window.location='x'" }, do: [{ type: "win" }] }]
    });

    expect(result.success).toBe(false);
  });

  it("validates v2 referenced assets and compiles as a phase-2 program shell", () => {
    const assetPack: AssetPack = {
      versionId: "v1",
      assets: [
        createMockAsset("item.key", "/key.png"),
        createMockAsset("door.boss", "/door.png")
      ]
    };
    const dsl = {
      version: "2",
      rules: [
        {
          id: "collect-keys-open-gate",
          when: { type: "collected", assetKey: "item.key", count: 3 },
          do: [{ type: "open_door", assetKey: "door.boss" }]
        }
      ]
    };

    expect(validateGameplayDsl(dsl, assetPack).success).toBe(true);
    const compiled = compileGameplayDsl(dsl, assetPack);
    expect(compiled.success).toBe(true);
    if (compiled.success) {
      expect(compiled.runtimeProgram?.version).toBe("2");
      expect(compiled.runtimeProgram?.rules[0]?.id).toBe("collect-keys-open-gate");
    }
    expect(validateGameplayDsl({
      version: "2",
      rules: [{ id: "missing", when: { type: "collected", assetKey: "missing.key", count: 1 }, do: [{ type: "win" }] }]
    }, assetPack).success).toBe(false);
  });

  it("creates a VM runtime for compiled v2 programs", () => {
    const dsl = {
      version: "2",
      rules: [
        {
          id: "score-wins",
          when: { type: "score", op: ">=", value: 3 },
          do: [{ type: "win", message: "score gate cleared" }]
        }
      ]
    };

    const runtime = createGameplayDslRuntime(dsl);

    expect(runtime?.tick({
      timeMs: 0,
      score: 3,
      collected: {},
      enemiesAlive: 0,
      hpPercent: 1,
      stageId: "playing",
      zonesEntered: [],
      combo: 0
    })).toEqual([{ type: "win", ruleId: "score-wins", message: "score gate cleared" }]);
  });
});

function createMockAsset(assetKey: string, fileUrl: string): AssetPack["assets"][number] {
  return {
    assetKey,
    type: "image",
    purpose: "test asset",
    style: "test",
    generationMode: "mock",
    copyrightStatus: "placeholder",
    spec: "test",
    status: "mock",
    prompt: "test",
    acceptedFileTypes: ["image/png"],
    previewUrl: fileUrl,
    source: "mock",
    fileUrl,
    provider: "mock",
    model: "mock",
    generationParams: {}
  };
}
