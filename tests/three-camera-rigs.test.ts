import { Object3D, PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";
import type { ThreeSceneDirector } from "../src/core/types";
import { createThreeCameraRig } from "../src/runtime/three/cameraRigs";

function director(overrides: Partial<ThreeSceneDirector>): ThreeSceneDirector {
  return {
    version: "1",
    genre: "flight_shooter",
    title: "3D test",
    camera: "follow_chase",
    controls: ["keyboard"],
    movementMode: "forward_flight",
    layoutMode: "flight_corridor",
    spawnPattern: "forward_waves",
    player: { speed: 4, radius: 0.7, start: { x: 0, y: 0.8, z: 0 } },
    world: { width: 12, depth: 30, skyColor: "#000000", groundColor: "#111111" },
    objectives: { collectTarget: 3, avoidDamage: true, timeLimitMs: 60000 },
    enemies: [],
    feedback: { collectPulse: true, hitShake: true, proceduralAudio: true },
    ...overrides
  } as ThreeSceneDirector;
}

describe("Three camera rigs", () => {
  it("creates distinct camera/control rigs for flight, runner, and tower defense", () => {
    const flight = createThreeCameraRig(director({ movementMode: "forward_flight" }));
    const runner = createThreeCameraRig(director({ movementMode: "auto_runner", camera: "follow_chase" }));
    const tower = createThreeCameraRig(director({ movementMode: "tower_defense", camera: "orbit_showcase" }));

    expect(flight).toMatchObject({
      id: "flight_follow",
      controlMode: "free_flight_2d",
      pointerXSign: 1
    });
    expect(runner).toMatchObject({
      id: "runner_lane",
      controlMode: "lane_snap_jump",
      pointerXSign: 1
    });
    expect(tower).toMatchObject({
      id: "tower_defense_orbit",
      controlMode: "orbit_build_select",
      pointerXSign: 0
    });
  });

  it("frames each genre from a different readable camera position", () => {
    const player = new Object3D();
    player.position.set(2, 0.8, 10);

    const flightCamera = new PerspectiveCamera();
    const runnerCamera = new PerspectiveCamera();
    const towerCamera = new PerspectiveCamera();

    const flightRig = createThreeCameraRig(director({ movementMode: "forward_flight" }));
    const runnerRig = createThreeCameraRig(director({ movementMode: "auto_runner", camera: "follow_chase" }));
    const towerRig = createThreeCameraRig(director({ movementMode: "tower_defense", camera: "orbit_showcase" }));
    for (let frame = 0; frame < 60; frame += 1) {
      flightRig.updateCamera(flightCamera, player, director({ movementMode: "forward_flight" }));
      runnerRig.updateCamera(runnerCamera, player, director({ movementMode: "auto_runner", camera: "follow_chase" }));
      towerRig.updateCamera(towerCamera, player, director({ movementMode: "tower_defense", camera: "orbit_showcase" }));
    }

    expect(flightCamera.position.z).toBeGreaterThan(player.position.z);
    expect(runnerCamera.position.z).toBeLessThan(player.position.z);
    expect(towerCamera.position.y).toBeGreaterThan(10);
    expect(new Set([flightCamera.position.y, runnerCamera.position.y, towerCamera.position.y]).size).toBe(3);
  });
});
