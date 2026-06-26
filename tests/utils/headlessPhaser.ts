import type { GameConfig, GameHooks, GameplayDslV2, TemplateFamily } from "../../src/core/types";
import { createDslVm, type DslEffect } from "../../src/runtime/dsl/DslVm";
import { getRegisteredPhaserTemplate } from "../../src/runtime/phaser/registry";

export interface HeadlessPhaserInput {
  templateFamily: TemplateFamily;
  config: GameConfig;
  hooks: GameHooks;
  gameplayDsl?: GameplayDslV2;
  maxMs: number;
}

export interface HeadlessPhaserResult {
  phase: "idle" | "playing" | "won" | "lost";
  stateChanged: boolean;
  errors: string[];
  dslEffects: DslEffect[];
  spawnedEnemies: Array<{ enemyType: string; count: number; zoneId: string }>;
}

export function runHeadlessPhaserTemplate(input: HeadlessPhaserInput): HeadlessPhaserResult {
  const template = getRegisteredPhaserTemplate(input.templateFamily);
  if (!template) {
    return {
      phase: "idle",
      stateChanged: false,
      errors: [`missing template: ${input.templateFamily}`],
      dslEffects: [],
      spawnedEnemies: []
    };
  }
  const validation = template.validateHooks(input.hooks);
  if (!validation.ok) {
    return { phase: "idle", stateChanged: false, errors: validation.errors, dslEffects: [], spawnedEnemies: [] };
  }

  const instance = template.create(undefined, { hooks: input.hooks });
  const vm = input.gameplayDsl ? createDslVm(input.gameplayDsl) : undefined;
  let phase: HeadlessPhaserResult["phase"] = "playing";
  let stateChanged = false;
  const dslEffects: DslEffect[] = [];
  const spawnedEnemies: HeadlessPhaserResult["spawnedEnemies"] = [];
  const directions = ["right", "right", "down", "left", "up"] as const;
  for (let timeMs = 0; timeMs <= input.maxMs && phase === "playing"; timeMs += 100) {
    const command = input.templateFamily === "grid_logic" ? directions[Math.floor(timeMs / 100) % directions.length] : undefined;
    const state = template.update(undefined, instance, 100, command);
    phase = state.phase === "idle" ? "playing" : state.phase;
    stateChanged ||= state.phase !== "idle";
    if (vm) {
      const effects = vm.tick({
        timeMs,
        score: Math.floor(timeMs / 100),
        collected: {},
        enemiesAlive: spawnedEnemies.reduce((sum, item) => sum + item.count, 0),
        hpPercent: 1,
        stageId: phase,
        zonesEntered: [],
        combo: 0
      });
      for (const effect of effects) {
        dslEffects.push(effect);
        if (effect.type === "spawn_zone") {
          spawnedEnemies.push({
            enemyType: effect.enemyType ?? "chaser",
            count: effect.count ?? 1,
            zoneId: effect.zoneId
          });
        }
        if (effect.type === "win") phase = "won";
        if (effect.type === "fail") phase = "lost";
      }
      stateChanged ||= effects.length > 0;
    }
  }

  return { phase, stateChanged, errors: [], dslEffects, spawnedEnemies };
}
