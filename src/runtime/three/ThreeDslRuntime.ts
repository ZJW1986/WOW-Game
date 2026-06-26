import type { GameplayDslV2 } from "../../core/types";
import { createDslVm } from "../dsl/DslVm";

export interface ThreeDslRuntimeState {
  timeMs: number;
  score: number;
  lives: number;
  collectCount: number;
  enemiesAlive: number;
  stageId: string;
}

export type ThreeDslRuntimeCommand =
  | { type: "spawn_hazards"; ruleId: string; zoneId: string; enemyType?: string; count: number }
  | { type: "change_player_speed"; ruleId: string; multiplier: number }
  | { type: "win"; ruleId: string; message?: string }
  | { type: "fail"; ruleId: string; message?: string };

export function createThreeDslRuntime(program: GameplayDslV2) {
  const vm = createDslVm(program);
  return {
    tick(state: ThreeDslRuntimeState): ThreeDslRuntimeCommand[] {
      const effects = vm.tick({
        timeMs: state.timeMs,
        score: state.score,
        collected: { "three.model.collectible": state.collectCount },
        enemiesAlive: state.enemiesAlive,
        hpPercent: Math.max(0, Math.min(100, (state.lives / 3) * 100)),
        stageId: state.stageId,
        zonesEntered: [],
        combo: 0
      });

      return effects.flatMap((effect): ThreeDslRuntimeCommand[] => {
        if (effect.type === "spawn_zone") {
          return [
            {
              type: "spawn_hazards",
              ruleId: effect.ruleId,
              zoneId: effect.zoneId,
              enemyType: effect.enemyType,
              count: Math.max(1, Math.min(8, effect.count ?? 1))
            }
          ];
        }
        if (effect.type === "change_player_speed") {
          return [{ type: "change_player_speed", ruleId: effect.ruleId, multiplier: effect.multiplier }];
        }
        if (effect.type === "win") return [{ type: "win", ruleId: effect.ruleId, message: effect.message }];
        if (effect.type === "fail") return [{ type: "fail", ruleId: effect.ruleId, message: effect.message }];
        return [];
      });
    }
  };
}
