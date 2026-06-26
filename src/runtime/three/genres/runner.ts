import type { ThreeArcadeRuntime } from "./types";
import { createThreeCameraRig } from "../cameraRigs";
import { clamp, resetRunnerGate } from "./utils";

export function runRunnerRuntime(director = { movementMode: "auto_runner" } as Parameters<typeof createThreeCameraRig>[0]): ThreeArcadeRuntime {
  const lanes = [-2.4, 0, 2.4];
  const cameraRig = createThreeCameraRig(director);
  return {
    pointerXSign: cameraRig.pointerXSign,
    cameraRig,
    reset({ player }) {
      player.userData.laneIndex = 1;
      player.userData.jumpVelocity = 0;
    },
    updatePlayer({ player, keys, move, delta }) {
      const laneIndex = Number(player.userData.laneIndex ?? 1);
      let nextLane = laneIndex;
      if ((keys.has("arrowleft") || keys.has("a")) && !player.userData.leftLatch) nextLane -= 1;
      if ((keys.has("arrowright") || keys.has("d")) && !player.userData.rightLatch) nextLane += 1;
      player.userData.leftLatch = keys.has("arrowleft") || keys.has("a");
      player.userData.rightLatch = keys.has("arrowright") || keys.has("d");
      player.userData.laneIndex = clamp(nextLane, 0, lanes.length - 1);
      if ((keys.has("arrowup") || keys.has("w") || keys.has(" ")) && player.position.y <= 0.52) {
        player.userData.jumpVelocity = 5.2;
      }
      player.userData.jumpVelocity = Number(player.userData.jumpVelocity ?? 0) - 12 * delta;
      player.position.y = Math.max(0.5, player.position.y + Number(player.userData.jumpVelocity ?? 0) * delta);
      if (player.position.y <= 0.5) player.userData.jumpVelocity = 0;
      player.position.x += (lanes[Number(player.userData.laneIndex)] - player.position.x) * 0.22;
      player.position.z += move * 0.9;
      player.rotation.y = (lanes[Number(player.userData.laneIndex)] - player.position.x) * 0.08;
    },
    updateHazard({ hazard, index, player, delta, director }) {
      hazard.rotation.y += delta * 0.8;
      hazard.position.z -= delta * (2.2 + index * 0.08);
      if (hazard.position.z < player.position.z - 8) resetRunnerGate(hazard, index, director, player.position.z);
    },
    resetHazard({ hazard, index, director }) {
      resetRunnerGate(hazard, index, director, 0);
    },
    updateCollectible({ item, delta }) {
      item.rotation.y += delta * 5;
    },
    updateCamera: cameraRig.updateCamera
  };
}
