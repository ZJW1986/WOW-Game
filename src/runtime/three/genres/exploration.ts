import type { ThreeArcadeRuntime } from "./types";
import { createThreeCameraRig } from "../cameraRigs";

export function runExplorationRuntime(
  director = { movementMode: "explore_scan", camera: "orbit_showcase" } as Parameters<typeof createThreeCameraRig>[0]
): ThreeArcadeRuntime {
  const cameraRig = createThreeCameraRig(director);
  return {
    pointerXSign: cameraRig.pointerXSign,
    cameraRig,
    updatePlayer({ player, keys, move }) {
      const exploreMove = move * 0.72;
      if (keys.has("arrowleft") || keys.has("a")) player.position.x -= exploreMove;
      if (keys.has("arrowright") || keys.has("d")) player.position.x += exploreMove;
      if (keys.has("arrowup") || keys.has("w")) player.position.z -= exploreMove;
      if (keys.has("arrowdown") || keys.has("s")) player.position.z += exploreMove;
      if (keys.has(" ") || keys.has("enter")) player.userData.scanPulse = 1;
    },
    updateHazard({ hazard, index, delta, now }) {
      hazard.rotation.z += delta * 0.8;
      hazard.position.y = 0.55 + Math.sin(now / 700 + index) * 0.18;
    },
    resetHazard() {
      // Exploration hazards are soft landmarks; do not respawn them aggressively.
    },
    updateCollectible({ item, delta, now }) {
      item.rotation.y += delta * 1.8;
      item.position.y = 0.5 + Math.sin(now / 500) * 0.12;
    },
    updateCamera: cameraRig.updateCamera
  };
}
