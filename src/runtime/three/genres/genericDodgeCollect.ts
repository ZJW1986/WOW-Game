import type { ThreeArcadeRuntime } from "./types";
import { createThreeCameraRig } from "../cameraRigs";

export function runGenericDodgeCollectRuntime(
  director = { movementMode: "arena_dodge" } as unknown as Parameters<typeof createThreeCameraRig>[0]
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
    updateHazard({ hazard, index, player, delta, now, director }) {
      hazard.rotation.x += delta * 1.4;
      hazard.rotation.y += delta * 0.9;
      const behavior = director.enemies[index % director.enemies.length]?.behavior ?? "falling";
      if (behavior === "chase") hazard.position.x += Math.sign(player.position.x - hazard.position.x) * delta * 0.8;
      if (behavior === "patrol" || behavior === "orbit") hazard.position.x += Math.sin(now / 700 + index) * delta * 1.4;
      hazard.position.z += delta * (1.2 + index * 0.08);
      if (hazard.position.z > director.world.depth / 2) hazard.position.z = -director.world.depth / 2;
    },
    resetHazard({ hazard, director }) {
      hazard.position.z = -director.world.depth / 2;
    },
    updateCollectible({ item, delta }) {
      item.rotation.y += delta * 2.5;
    },
    updateCamera: cameraRig.updateCamera
  };
}
