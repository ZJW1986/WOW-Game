/**
 * @deprecated runtime stubs.
 * The real per-frame gameplay loop lives in `src/ui/PhaserPreview.tsx`. The
 * `create`/`update` callbacks below are no-op placeholders that were never
 * wired into the active scene. The registry itself is still used by
 * `src/core/start.ts` to check which template ids exist, so do not delete the
 * file — only treat the lifecycle hooks here as reference / future-use only.
 */
import type { PhaserTemplate } from "./PhaserTemplate";
import { createGridLogicRuntime, moveGridCursor, stepGridLogicRuntime } from "./gridLogic";
import { createTowerDefenseRuntime, placeTower, stepTowerDefenseRuntime } from "./towerDefense";

export interface PhaserTemplateRegistry {
  registerTemplate(template: PhaserTemplate): void;
  getTemplate(id: PhaserTemplate["id"]): PhaserTemplate | undefined;
  listTemplates(): PhaserTemplate[];
}

export function createPhaserTemplateRegistry(initialTemplates: PhaserTemplate[] = []): PhaserTemplateRegistry {
  const templates = new Map<PhaserTemplate["id"], PhaserTemplate>();
  const registry: PhaserTemplateRegistry = {
    registerTemplate(template) {
      if (templates.has(template.id)) {
        throw new Error(`Phaser template already registered: ${template.id}`);
      }
      templates.set(template.id, template);
    },
    getTemplate(id) {
      return templates.get(id);
    },
    listTemplates() {
      return Array.from(templates.values());
    }
  };

  for (const template of initialTemplates) registry.registerTemplate(template);
  return registry;
}

const registeredTemplates = createPhaserTemplateRegistry([
  createConfiguredTemplate("top_down"),
  createConfiguredTemplate("platformer"),
  createTowerDefenseTemplate(),
  createGridLogicTemplate()
]);

export function getRegisteredPhaserTemplates(): PhaserTemplate[] {
  return registeredTemplates.listTemplates();
}

export function getRegisteredPhaserTemplate(id: PhaserTemplate["id"]): PhaserTemplate | undefined {
  return registeredTemplates.getTemplate(id);
}

function createConfiguredTemplate(id: PhaserTemplate["id"]): PhaserTemplate {
  return {
    id,
    preload: () => undefined,
    create: () => ({
      elapsedMs: 0,
      phase: "playing" as const,
      progress: 0,
      templateId: id
    }),
    update: (_scene, instance, dt) => {
      const runtime = instance as { elapsedMs: number; phase: "playing" | "won" | "lost"; progress: number };
      if (runtime.phase !== "playing") return { phase: runtime.phase };
      runtime.elapsedMs += Math.max(0, dt);
      runtime.progress += id === "platformer" ? 18 : 24;
      if (runtime.progress >= 180 || runtime.elapsedMs >= 3000) runtime.phase = "won";
      return { phase: runtime.phase };
    },
    teardown: () => undefined,
    validateHooks: () => ({ ok: true, errors: [] })
  };
}

function createTowerDefenseTemplate(): PhaserTemplate {
  return {
    id: "tower_defense",
    preload: () => undefined,
    create: (_scene, input) => {
      const runtime = createTowerDefenseRuntime({
        path: input.hooks?.levelFlow
          ? [
              input.hooks.levelFlow.spawnPoint,
              { x: 840, y: input.hooks.levelFlow.spawnPoint.y }
            ]
          : [
              { x: 80, y: 300 },
              { x: 840, y: 300 }
            ],
        waves: [
          {
            startsAtMs: 0,
            count: Math.max(3, input.hooks?.winCondition.target ?? 3),
            intervalMs: input.hooks?.enemyRules.waveIntervalMs || 700,
            enemyHp: 4,
            enemySpeed: input.hooks?.enemyRules.speed || 60,
            reward: input.hooks?.collectibleRules.value || 2
          }
        ],
        baseHp: input.hooks?.failCondition.lives || 5,
        startingGold: 40,
        towers: [{ id: "basic", cost: 10, range: 120, damage: 2, fireRateMs: 450 }]
      });
      return { runtime: placeTower(runtime, "basic", 430, input.hooks?.levelFlow?.spawnPoint.y ?? 300) };
    },
    update: (_scene, instance, dt) => {
      const holder = instance as { runtime: ReturnType<typeof createTowerDefenseRuntime> };
      holder.runtime = stepTowerDefenseRuntime(holder.runtime, dt);
      return { phase: holder.runtime.phase === "playing" ? "playing" : holder.runtime.phase };
    },
    teardown: () => undefined,
    validateHooks: (hooks) => {
      const errors: string[] = [];
      if (hooks?.winCondition.mode !== "defend_base") errors.push("tower_defense requires defend_base win condition");
      if (hooks?.failCondition.mode !== "base_destroyed") errors.push("tower_defense requires base_destroyed fail condition");
      return { ok: errors.length === 0, errors };
    }
  };
}

function createGridLogicTemplate(): PhaserTemplate {
  return {
    id: "grid_logic",
    preload: () => undefined,
    create: (_scene, input) => {
      const grid = input.hooks?.levelLayout.grid ?? { columns: 5, rows: 3 };
      return {
        runtime: createGridLogicRuntime({
        columns: grid.columns || 5,
        rows: grid.rows || 3,
        gridState: input.hooks?.levelLayout.gridState,
        maxMoves: input.hooks?.failCondition.lives || 12
        })
      };
    },
    update: (_scene, instance, dt, input) => {
      const holder = instance as { runtime: ReturnType<typeof createGridLogicRuntime> };
      let next = holder.runtime;
      if (input === "up" || input === "down" || input === "left" || input === "right") {
        next = moveGridCursor(next, input);
      }
      next = stepGridLogicRuntime(next, dt);
      holder.runtime = next;
      return { phase: next.phase };
    },
    teardown: () => undefined,
    validateHooks: (hooks) => {
      const errors: string[] = [];
      if (hooks?.winCondition.mode !== "solve_state") errors.push("grid_logic requires solve_state win condition");
      if (hooks?.failCondition.mode !== "moves_exhausted") errors.push("grid_logic requires moves_exhausted fail condition");
      return { ok: errors.length === 0, errors };
    }
  };
}
