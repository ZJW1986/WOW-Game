import type { Object3D, PerspectiveCamera } from "three";
import type { ThreeSceneDirector } from "../../core/types";

export type ThreeCameraRigId =
  | "flight_follow"
  | "runner_lane"
  | "third_person_follow"
  | "exploration_orbit"
  | "tower_defense_orbit"
  | "arena_follow";

export type ThreeControlMode =
  | "free_flight_2d"
  | "lane_snap_jump"
  | "free_move"
  | "scan_explore"
  | "orbit_build_select"
  | "arena_move";

export interface ThreeCameraRig {
  id: ThreeCameraRigId;
  controlMode: ThreeControlMode;
  pointerXSign: -1 | 0 | 1;
  updateCamera: (camera: PerspectiveCamera, player: Object3D, director: ThreeSceneDirector) => void;
}

export function createThreeCameraRig(director: ThreeSceneDirector): ThreeCameraRig {
  if (director.movementMode === "tower_defense") {
    return {
      id: "tower_defense_orbit",
      controlMode: "orbit_build_select",
      pointerXSign: 0,
      updateCamera(camera) {
        camera.position.set(0, 14, 13);
        camera.lookAt(0, 0, 0);
      }
    };
  }
  if (director.movementMode === "forward_flight") {
    return {
      id: "flight_follow",
      controlMode: "free_flight_2d",
      pointerXSign: 1,
      updateCamera(camera, player) {
        camera.position.x += (player.position.x * 0.35 - camera.position.x) * 0.06;
        camera.position.y += (4.2 - camera.position.y) * 0.05;
        camera.position.z += (player.position.z + 9 - camera.position.z) * 0.06;
        camera.lookAt(player.position.x * 0.25, player.position.y, player.position.z - 7);
      }
    };
  }
  if (director.movementMode === "auto_runner") {
    return {
      id: "runner_lane",
      controlMode: "lane_snap_jump",
      pointerXSign: 1,
      updateCamera(camera, player) {
        camera.position.x += (player.position.x * 0.35 - camera.position.x) * 0.08;
        camera.position.y += (4.8 - camera.position.y) * 0.05;
        camera.position.z += (player.position.z - 8.5 - camera.position.z) * 0.08;
        camera.lookAt(player.position.x * 0.2, 0.9, player.position.z + 6);
      }
    };
  }
  if (director.movementMode === "free_move") {
    return {
      id: "third_person_follow",
      controlMode: "free_move",
      pointerXSign: 1,
      updateCamera(camera, player) {
        camera.position.x += (player.position.x * 0.45 - camera.position.x) * 0.05;
        camera.position.y += (6.5 - camera.position.y) * 0.05;
        camera.position.z += (player.position.z + 9 - camera.position.z) * 0.05;
        camera.lookAt(player.position.x, 0.4, player.position.z);
      }
    };
  }
  if (director.movementMode === "explore_scan" || director.camera === "orbit_showcase") {
    return {
      id: "exploration_orbit",
      controlMode: "scan_explore",
      pointerXSign: 1,
      updateCamera(camera, player) {
        camera.position.x += (player.position.x * 0.35 + 6 - camera.position.x) * 0.035;
        camera.position.y += (8.5 - camera.position.y) * 0.035;
        camera.position.z += (player.position.z + 10 - camera.position.z) * 0.035;
        camera.lookAt(player.position.x * 0.3, 0, player.position.z);
      }
    };
  }
  return {
    id: "arena_follow",
    controlMode: "arena_move",
    pointerXSign: 1,
    updateCamera(camera, player) {
      camera.position.x += (player.position.x * 0.28 - camera.position.x) * 0.05;
      camera.lookAt(player.position.x * 0.25, 0, player.position.z - 3);
    }
  };
}
