import { describe, expect, it } from "vitest";
import type { GameplayDslV2 } from "../src/core/types";
import { createThreeDslRuntime } from "../src/runtime/three/ThreeDslRuntime";

const dsl: GameplayDslV2 = {
  version: "2",
  zones: [{ id: "runner-pressure", x: 0, y: 0, width: 3, height: 6 }],
  rules: [
    {
      id: "speed-up-after-score",
      when: { type: "score", op: ">=", value: 2 },
      do: [{ type: "change_player_speed", multiplier: 1.5 }]
    },
    {
      id: "spawn-pressure-zone",
      when: { type: "time", op: ">=", value: 3000 },
      do: [{ type: "spawn_zone", zoneId: "runner-pressure", enemyType: "charger", count: 3 }]
    },
    {
      id: "win-after-collect",
      when: { type: "collected", assetKey: "three.model.collectible", count: 4 },
      do: [{ type: "win", message: "Route cleared" }]
    }
  ]
};

describe("Three DSL runtime", () => {
  it("turns GameplayDSL v2 effects into 3D runtime commands", () => {
    const runtime = createThreeDslRuntime(dsl);

    expect(runtime.tick({ timeMs: 1000, score: 2, lives: 3, collectCount: 2, enemiesAlive: 1, stageId: "run" })).toEqual([
      { type: "change_player_speed", multiplier: 1.5, ruleId: "speed-up-after-score" }
    ]);

    expect(runtime.tick({ timeMs: 3500, score: 2, lives: 3, collectCount: 2, enemiesAlive: 1, stageId: "run" })).toEqual([
      {
        type: "spawn_hazards",
        count: 3,
        enemyType: "charger",
        ruleId: "spawn-pressure-zone",
        zoneId: "runner-pressure"
      }
    ]);

    expect(runtime.tick({ timeMs: 4000, score: 4, lives: 3, collectCount: 4, enemiesAlive: 1, stageId: "run" })).toEqual([
      { type: "win", message: "Route cleared", ruleId: "win-after-collect" }
    ]);
  });
});
