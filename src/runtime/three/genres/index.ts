import type { ThreeSceneDirector } from "../../../core/types";
import { runExplorationRuntime } from "./exploration";
import { runFlightShooterRuntime } from "./flight";
import { runGenericDodgeCollectRuntime } from "./genericDodgeCollect";
import { runRunnerRuntime } from "./runner";
import { runThirdPersonCollectRuntime } from "./thirdPersonCollect";
import type { ThreeArcadeRuntime } from "./types";

export type { ThreeArcadeRuntime } from "./types";

export function createThreeGenreRuntime(director: ThreeSceneDirector): ThreeArcadeRuntime {
  if (director.movementMode === "forward_flight") return runFlightShooterRuntime(director);
  if (director.movementMode === "auto_runner") return runRunnerRuntime(director);
  if (director.movementMode === "free_move") return runThirdPersonCollectRuntime(director);
  if (director.movementMode === "explore_scan") return runExplorationRuntime(director);
  return runGenericDodgeCollectRuntime(director);
}

export {
  runExplorationRuntime,
  runFlightShooterRuntime,
  runGenericDodgeCollectRuntime,
  runRunnerRuntime,
  runThirdPersonCollectRuntime
};
