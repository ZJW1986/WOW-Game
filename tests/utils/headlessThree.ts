import { Object3D, PerspectiveCamera } from "three";
import type { ThreeSceneDirector } from "../../src/core/types";
import { createThreeDslRuntime } from "../../src/runtime/three/ThreeDslRuntime";
import { createThreeCameraRig } from "../../src/runtime/three/cameraRigs";
import { createThreeGenreRuntime } from "../../src/runtime/three/genres";

export interface HeadlessThreeSmokeResult {
  runtimeMode: ThreeSceneDirector["movementMode"];
  stateChanged: boolean;
  objectiveReachable: boolean;
  errors: string[];
}

export function runHeadlessThreeSmoke(
  director: ThreeSceneDirector,
  options: { maxFrames?: number } = {}
): HeadlessThreeSmokeResult {
  const errors: string[] = [];
  const maxFrames = options.maxFrames ?? 120;
  const player = new Object3D();
  player.position.set(director.player.start.x, director.player.start.y, director.player.start.z);
  const camera = new PerspectiveCamera();
  const initial = player.position.clone();

  if (director.movementMode === "tower_defense") {
    const towerDefense = director.towerDefense;
    const objectiveReachable = Boolean(
      towerDefense &&
        towerDefense.pathNodes.length >= 5 &&
        towerDefense.towers.length >= 3 &&
        towerDefense.waves.length >= 4 &&
        towerDefense.economyRules.startingEnergy >= Math.min(...towerDefense.towers.map((tower) => tower.cost))
    );
    if (!objectiveReachable) errors.push("Tower defense director is missing path, towers, waves, or economy.");
    createThreeCameraRig(director).updateCamera(camera, player, director);
    return {
      runtimeMode: director.movementMode,
      stateChanged: camera.position.y > 0,
      objectiveReachable,
      errors
    };
  }

  const runtime = createThreeGenreRuntime(director);
  const keys = new Set<string>(director.movementMode === "auto_runner" ? ["arrowright"] : ["arrowup", "arrowright"]);
  const hazards = Array.from({ length: Math.max(1, director.enemies[0]?.count ?? 1) }, () => new Object3D());
  const collectibles = Array.from({ length: Math.max(1, director.objectives.collectTarget) }, () => new Object3D());
  const dslRuntime = director.gameplayDsl ? createThreeDslRuntime(director.gameplayDsl) : undefined;
  let dslHit = !director.gameplayDsl;

  runtime.reset?.({ THREE: {} as typeof import("three"), player, collectibles, hazards, director });
  for (let frame = 0; frame < maxFrames; frame += 1) {
    const delta = 1 / 60;
    const move = director.player.speed * delta;
    runtime.updatePlayer({ player, keys, move, delta, director });
    runtime.updateCamera(camera, player, director);
    const commands =
      dslRuntime?.tick({
        timeMs: frame * 1000,
        score: frame >= 20 ? 2 : 0,
        lives: 3,
        collectCount: frame >= 40 ? director.objectives.collectTarget : 0,
        enemiesAlive: hazards.length,
        stageId: "playing"
      }) ?? [];
    if (commands.length > 0) dslHit = true;
  }

  const moved = initial.distanceTo(player.position) > 0.01;
  if (!moved) errors.push("Player position did not change during headless smoke.");
  if (!dslHit) errors.push("GameplayDSL did not emit any runtime command.");
  return {
    runtimeMode: director.movementMode,
    stateChanged: moved && camera.position.length() > 0,
    objectiveReachable: director.objectives.collectTarget >= 3 && dslHit,
    errors
  };
}
