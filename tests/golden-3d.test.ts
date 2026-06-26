import { describe, expect, it } from "vitest";
import { generateThreeGameMvp } from "../src/services/threeGameService";
import { runHeadlessThreeSmoke } from "./utils/headlessThree";

describe("3D golden suite", () => {
  it.each([
    {
      genre: "flight_shooter" as const,
      idea: "3D 飞机躲避陨石收集能量",
      expectedMovementMode: "forward_flight"
    },
    {
      genre: "runner" as const,
      idea: "3D 跑酷三车道收集金币",
      expectedMovementMode: "auto_runner"
    },
    {
      genre: "futuristic_tower_defense" as const,
      idea: "未来科幻塔防，建造激光塔和导弹塔防守基地",
      expectedMovementMode: "tower_defense"
    }
  ])("runs a headless 3D smoke for $genre", ({ genre, idea, expectedMovementMode }) => {
    const result = generateThreeGameMvp({
      idea,
      projectId: `golden-3d-${genre}`,
      baseUrl: "https://wow.example",
      viewportMode: "app_9_16",
      gameType3d: genre
    });

    const smoke = runHeadlessThreeSmoke(result.threeSceneDirector, { maxFrames: 180 });

    expect(result.threeSceneDirector.movementMode).toBe(expectedMovementMode);
    expect(result.threeVerificationReport.deliveryReady).toBe(true);
    expect(smoke.errors).toEqual([]);
    expect(smoke.stateChanged).toBe(true);
    expect(smoke.runtimeMode).toBe(expectedMovementMode);
    expect(smoke.objectiveReachable).toBe(true);
  });
});
