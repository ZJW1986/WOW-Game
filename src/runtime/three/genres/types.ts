import type { Object3D, PerspectiveCamera } from "three";
import type { ThreeSceneDirector } from "../../../core/types";
import type { ThreeCameraRig } from "../cameraRigs";

export type ThreeArcadeRuntime = {
  pointerXSign: number;
  cameraRig: ThreeCameraRig;
  reset?: (options: {
    THREE: typeof import("three");
    player: Object3D;
    collectibles: Object3D[];
    hazards: Object3D[];
    director: ThreeSceneDirector;
  }) => void;
  updatePlayer: (options: {
    player: Object3D;
    keys: Set<string>;
    move: number;
    delta: number;
    director: ThreeSceneDirector;
  }) => void;
  updateHazard: (options: {
    hazard: Object3D;
    index: number;
    player: Object3D;
    delta: number;
    now: number;
    director: ThreeSceneDirector;
  }) => void;
  resetHazard: (options: { hazard: Object3D; index: number; director: ThreeSceneDirector }) => void;
  updateCollectible?: (options: { item: Object3D; delta: number; now: number }) => void;
  updateCamera: (camera: PerspectiveCamera, player: Object3D, director: ThreeSceneDirector) => void;
};
