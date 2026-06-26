import { describe, expect, it } from "vitest";
import {
  createTowerDefenseRuntime,
  placeTower,
  stepTowerDefenseRuntime
} from "../src/runtime/phaser/towerDefense";

describe("tower defense Phaser runtime core", () => {
  it("runs waves, towers, economy, base damage, and win state", () => {
    let runtime = createTowerDefenseRuntime({
      path: [
        { x: 0, y: 0 },
        { x: 120, y: 0 }
      ],
      waves: [{ startsAtMs: 0, count: 3, intervalMs: 500, enemyHp: 4, enemySpeed: 30, reward: 3 }],
      baseHp: 5,
      startingGold: 40,
      towers: [{ id: "basic", cost: 10, range: 80, damage: 2, fireRateMs: 400 }]
    });

    runtime = placeTower(runtime, "basic", 50, 10);
    for (let timeMs = 0; timeMs <= 8000 && runtime.phase === "playing"; timeMs += 100) {
      runtime = stepTowerDefenseRuntime(runtime, 100);
    }

    expect(runtime.phase).toBe("won");
    expect(runtime.kills).toBe(3);
    expect(runtime.baseHp).toBeGreaterThan(0);
    expect(runtime.gold).toBeGreaterThan(30);
  });

  it("loses when enemies reach the base without enough tower damage", () => {
    let runtime = createTowerDefenseRuntime({
      path: [
        { x: 0, y: 0 },
        { x: 60, y: 0 }
      ],
      waves: [{ startsAtMs: 0, count: 3, intervalMs: 100, enemyHp: 20, enemySpeed: 60, reward: 1 }],
      baseHp: 2,
      startingGold: 0,
      towers: []
    });

    for (let timeMs = 0; timeMs <= 4000 && runtime.phase === "playing"; timeMs += 100) {
      runtime = stepTowerDefenseRuntime(runtime, 100);
    }

    expect(runtime.phase).toBe("lost");
    expect(runtime.baseHp).toBe(0);
  });
});
