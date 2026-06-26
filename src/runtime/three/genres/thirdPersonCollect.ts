import type { ThreeArcadeRuntime } from "./types";
import { createThreeCameraRig } from "../cameraRigs";
import { distance2D } from "./utils";

export function runThirdPersonCollectRuntime(
  director = { movementMode: "free_move" } as Parameters<typeof createThreeCameraRig>[0]
): ThreeArcadeRuntime {
  const cameraRig = createThreeCameraRig(director);
  return {
    pointerXSign: cameraRig.pointerXSign,
    cameraRig,
    updatePlayer({ player, keys, move }) {
      if (keys.has("arrowleft") || keys.has("a")) player.position.x -= move;
      if (keys.has("arrowright") || keys.has("d")) player.position.x += move;
      if (keys.has("arrowup") || keys.has("w")) player.position.z -= move;
      if (keys.has("arrowdown") || keys.has("s")) player.position.z += move;
    },
    updateHazard({ hazard, index, player, delta, now }) {
      const patrolRadius = 2.2 + (index % 3) * 0.6;
      const originX = Number(hazard.userData.originX ?? hazard.position.x);
      const originZ = Number(hazard.userData.originZ ?? hazard.position.z);
      hazard.userData.originX = originX;
      hazard.userData.originZ = originZ;
      const distanceToPlayer = distance2D(player.position, hazard.position);
      if (distanceToPlayer < 4.5) {
        hazard.position.x += Math.sign(player.position.x - hazard.position.x) * delta * 0.9;
        hazard.position.z += Math.sign(player.position.z - hazard.position.z) * delta * 0.9;
      } else {
        hazard.position.x = originX + Math.cos(now / 900 + index) * patrolRadius;
        hazard.position.z = originZ + Math.sin(now / 900 + index) * patrolRadius;
      }
      hazard.rotation.y += delta * 1.2;
    },
    resetHazard({ hazard }) {
      hazard.position.x = Number(hazard.userData.originX ?? hazard.position.x);
      hazard.position.z = Number(hazard.userData.originZ ?? hazard.position.z);
    },
    updateCollectible({ item, delta }) {
      item.rotation.y += delta * 2.2;
      item.rotation.x += delta * 0.6;
    },
    updateCamera: cameraRig.updateCamera
  };
}
