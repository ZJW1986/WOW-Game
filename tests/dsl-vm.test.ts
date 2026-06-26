import { describe, expect, it } from "vitest";
import { createDslVm } from "../src/runtime/dsl/DslVm";
import type { GameplayDslV2 } from "../src/core/types";

describe("DslVm", () => {
  it("emits open door after collecting three keys", () => {
    const dsl: GameplayDslV2 = {
      version: "2",
      rules: [
        {
          id: "open-boss-door",
          when: { type: "collected", assetKey: "item.key", count: 3 },
          do: [{ type: "open_door", assetKey: "door.boss" }]
        }
      ]
    };
    const vm = createDslVm(dsl);

    expect(vm.tick({ timeMs: 1000, score: 0, collected: { "item.key": 2 }, enemiesAlive: 0, hpPercent: 100, stageId: "main", zonesEntered: [], combo: 0 })).toEqual([]);
    expect(vm.tick({ timeMs: 1200, score: 0, collected: { "item.key": 3 }, enemiesAlive: 0, hpPercent: 100, stageId: "main", zonesEntered: [], combo: 0 })).toEqual([
      { type: "open_door", ruleId: "open-boss-door", assetKey: "door.boss" }
    ]);
    expect(vm.tick({ timeMs: 1300, score: 0, collected: { "item.key": 4 }, enemiesAlive: 0, hpPercent: 100, stageId: "main", zonesEntered: [], combo: 0 })).toEqual([]);
  });

  it("emits spawn, counter, grant, win, and fail effects from structured rules", () => {
    const dsl: GameplayDslV2 = {
      version: "2",
      rules: [
        { id: "wave", when: { type: "score", op: ">=", value: 5 }, do: [{ type: "spawn_zone", zoneId: "arena", enemyType: "charger", count: 3 }] },
        { id: "timer", when: { type: "time", op: ">=", value: 2000 }, do: [{ type: "set_counter", name: "pressure", value: 1 }] },
        { id: "combo", when: { type: "combo", op: ">=", value: 4 }, do: [{ type: "grant_item", assetKey: "item.bonus" }] },
        { id: "stage-win", when: { type: "stage", id: "exit" }, do: [{ type: "win", message: "Escaped" }] },
        { id: "low-hp", when: { type: "hpBelow", percent: 20 }, do: [{ type: "fail", message: "Base lost" }] }
      ]
    };
    const vm = createDslVm(dsl);

    expect(vm.tick({ timeMs: 2500, score: 5, collected: {}, enemiesAlive: 2, hpPercent: 100, stageId: "main", zonesEntered: [], combo: 4 })).toEqual([
      { type: "spawn_zone", ruleId: "wave", zoneId: "arena", enemyType: "charger", count: 3 },
      { type: "set_counter", ruleId: "timer", name: "pressure", value: 1 },
      { type: "grant_item", ruleId: "combo", assetKey: "item.bonus" }
    ]);
    expect(vm.tick({ timeMs: 3000, score: 5, collected: {}, enemiesAlive: 0, hpPercent: 100, stageId: "exit", zonesEntered: [], combo: 0 })).toEqual([
      { type: "win", ruleId: "stage-win", message: "Escaped" }
    ]);
    expect(vm.tick({ timeMs: 3500, score: 5, collected: {}, enemiesAlive: 0, hpPercent: 10, stageId: "main", zonesEntered: [], combo: 0 })).toEqual([
      { type: "fail", ruleId: "low-hp", message: "Base lost" }
    ]);
  });
});
