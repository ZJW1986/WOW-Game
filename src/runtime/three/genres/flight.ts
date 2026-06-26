import type { ThreeArcadeRuntime } from "./types";
import { createThreeCameraRig } from "../cameraRigs";
import { clamp, resetForwardHazard } from "./utils";

export function runFlightShooterRuntime(director = { movementMode: "forward_flight" } as Parameters<typeof createThreeCameraRig>[0]): ThreeArcadeRuntime {
  const cameraRig = createThreeCameraRig(director);
  return {
    pointerXSign: cameraRig.pointerXSign,
    cameraRig,
    updatePlayer({ player, keys, move }) {
      player.position.z -= move * 0.35;
      if (keys.has("arrowleft") || keys.has("a")) player.position.x -= move;
      if (keys.has("arrowright") || keys.has("d")) player.position.x += move;
      if (keys.has("arrowup") || keys.has("w")) player.position.y = clamp(player.position.y + move * 0.18, 0.55, 1.8);
      if (keys.has("arrowdown") || keys.has("s")) player.position.y = clamp(player.position.y - move * 0.18, 0.45, 1.8);
      player.rotation.z = -player.position.x * 0.08;
    },
    updateHazard({ hazard, index, player, delta, director }) {
      hazard.rotation.x += delta * 1.8;
      hazard.rotation.y += delta * 1.1;
      hazard.position.z += delta * (3.1 + index * 0.1);
      hazard.position.x += Math.sin(performance.now() / 650 + index) * delta * 0.5;
      if (hazard.position.z > player.position.z + 7) resetForwardHazard(hazard, index, director);
    },
    resetHazard({ hazard, index, director }) {
      resetForwardHazard(hazard, index, director);
    },
    updateCollectible({ item, delta }) {
      item.rotation.y += delta * 3.4;
      item.position.y = 0.65 + Math.sin(performance.now() / 240) * 0.08;
    },
    updateCamera: cameraRig.updateCamera
  };
}
