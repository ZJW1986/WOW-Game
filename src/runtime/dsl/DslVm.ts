import type { GameplayDslV2, GameplayDslV2Action, GameplayDslV2When } from "../../core/types";

export interface DslWorldState {
  timeMs: number;
  score: number;
  collected: Record<string, number>;
  enemiesAlive: number;
  hpPercent: number;
  stageId: string;
  zonesEntered: string[];
  combo: number;
}

export type DslEffect =
  | { type: "spawn_zone"; ruleId: string; zoneId: string; enemyType?: "chaser" | "patroller" | "charger" | "shooter" | "orbiter" | "mine"; count?: number }
  | { type: "open_door"; ruleId: string; assetKey: string }
  | { type: "grant_item"; ruleId: string; assetKey: string }
  | { type: "set_counter"; ruleId: string; name: string; value: number }
  | { type: "change_player_speed"; ruleId: string; multiplier: number }
  | { type: "fail"; ruleId: string; message?: string }
  | { type: "win"; ruleId: string; message?: string };

export interface DslVm {
  tick(state: DslWorldState): DslEffect[];
}

export function createDslVm(program: GameplayDslV2): DslVm {
  const triggered = new Set<string>();
  return {
    tick(state) {
      const effects: DslEffect[] = [];
      for (const rule of program.rules) {
        if (triggered.has(rule.id) || !matchesWhen(rule.when, state)) continue;
        triggered.add(rule.id);
        effects.push(...rule.do.map((action) => toEffect(rule.id, action)));
      }
      return effects;
    }
  };
}

function matchesWhen(when: GameplayDslV2When, state: DslWorldState): boolean {
  if (when.type === "time") return compare(state.timeMs, when.op, when.value);
  if (when.type === "score") return compare(state.score, when.op, when.value);
  if (when.type === "collected") return (state.collected[when.assetKey] ?? 0) >= when.count;
  if (when.type === "enemiesAlive") return compare(state.enemiesAlive, when.op, when.value);
  if (when.type === "stage") return state.stageId === when.id;
  if (when.type === "hpBelow") return state.hpPercent < when.percent;
  if (when.type === "zoneEntered") return state.zonesEntered.includes(when.zoneId);
  if (when.type === "combo") return compare(state.combo, when.op, when.value);
  return false;
}

function compare(left: number, op: "<" | "<=" | "=" | ">=" | ">", right: number): boolean {
  if (op === "<") return left < right;
  if (op === "<=") return left <= right;
  if (op === "=") return left === right;
  if (op === ">=") return left >= right;
  return left > right;
}

function toEffect(ruleId: string, action: GameplayDslV2Action): DslEffect {
  if (action.type === "spawn_zone") {
    return { type: "spawn_zone", ruleId, zoneId: action.zoneId, enemyType: action.enemyType, count: action.count };
  }
  if (action.type === "open_door") return { type: "open_door", ruleId, assetKey: action.assetKey };
  if (action.type === "grant_item") return { type: "grant_item", ruleId, assetKey: action.assetKey };
  if (action.type === "set_counter") return { type: "set_counter", ruleId, name: action.name, value: action.value };
  if (action.type === "change_player_speed") {
    return { type: "change_player_speed", ruleId, multiplier: action.multiplier ?? action.mul ?? 1 };
  }
  if (action.type === "fail") return { type: "fail", ruleId, message: action.message };
  return { type: "win", ruleId, message: action.message };
}
