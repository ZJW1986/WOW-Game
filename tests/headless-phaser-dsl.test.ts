import { describe, expect, it } from "vitest";
import { createGameConfig, createGameHooks } from "../src/core/pipeline";
import type { AssetPack, GameplayDslV2 } from "../src/core/types";
import { runHeadlessPhaserTemplate } from "./utils/headlessPhaser";

describe("headless Phaser DSL runtime bridge", () => {
  it("ticks a v2 DSL program and exposes spawn effects from the template loop", () => {
    const gameplayDsl: GameplayDslV2 = {
      version: "2",
      zones: [{ id: "arena-right", x: 640, y: 120, width: 180, height: 240 }],
      rules: [
        {
          id: "score-five-spawn-chasers",
          when: { type: "score", op: ">=", value: 5 },
          do: [{ type: "spawn_zone", zoneId: "arena-right", enemyType: "chaser", count: 3 }]
        }
      ]
    };

    const result = runHeadlessPhaserTemplate({
      templateFamily: "top_down",
      config: createGameConfig("DSL bridge smoke", "Headless DSL bridge smoke test", "top_down", createAssetPack()),
      hooks: createGameHooks(
        createGameConfig("DSL bridge smoke", "Headless DSL bridge smoke test", "top_down", createAssetPack())
      ),
      gameplayDsl,
      maxMs: 6_000
    });

    expect(result.errors).toEqual([]);
    expect(result.dslEffects).toContainEqual({
      type: "spawn_zone",
      ruleId: "score-five-spawn-chasers",
      zoneId: "arena-right",
      enemyType: "chaser",
      count: 3
    });
    expect(result.spawnedEnemies).toEqual([{ enemyType: "chaser", count: 3, zoneId: "arena-right" }]);
  });
});

function createAssetPack(): AssetPack {
  return {
    versionId: "test-assets",
    assets: []
  };
}
