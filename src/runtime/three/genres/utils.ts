import type { Object3D } from "three";
import type { ThreeSceneDirector } from "../../../core/types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distance2D(left: { x: number; z: number }, right: { x: number; z: number }): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

export function resetForwardHazard(hazard: Object3D, index: number, director: ThreeSceneDirector) {
  hazard.position.x = ((index % 5) - 2) * 1.9;
  hazard.position.z = -director.world.depth / 2 - index * 1.8;
}

export function resetRunnerGate(hazard: Object3D, index: number, director: ThreeSceneDirector, playerZ: number) {
  const lanes = [-2.4, 0, 2.4];
  hazard.position.x = lanes[index % lanes.length];
  hazard.position.z = playerZ + director.world.depth / 2 + index * 2.4;
}
