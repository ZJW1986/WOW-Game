import type { AssetPack, GameHooks, GameplayDsl, GameplayDslRule, GameplayDslV2 } from "../core/types";
import { gameplayDslSchema } from "../core/schemas";
import { createDslVm } from "../runtime/dsl/DslVm";

type CompileResult =
  | {
      success: true;
      hooks: Pick<GameHooks, "enemyArchetypes" | "encounterTimeline" | "impactRules" | "stageGoals">;
      runtimeProgram?: GameplayDslV2;
    }
  | { success: false; errors: string[] };

const ENEMY_EVENTS = new Set<GameplayDslRule["do"]>(["spawn_wave", "spawn_mine", "projectile_burst"]);

export function validateGameplayDsl(payload: unknown, assetPack?: AssetPack) {
  const parsed = gameplayDslSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false as const, errors: parsed.error.issues.map((issue) => issue.message) };
  }

  const assetKeys = new Set(assetPack?.assets.map((asset) => asset.assetKey) ?? []);
  const referencedAssetKeys = parsed.data.version === "1" ? v1AssetKeys(parsed.data.rules) : v2AssetKeys(parsed.data);
  const missingAssets = referencedAssetKeys.filter((assetKey) => !assetKeys.has(assetKey));

  if (missingAssets.length > 0) {
    return {
      success: false as const,
      errors: missingAssets.map((assetKey) => `Unknown assetKey: ${assetKey}`)
    };
  }

  return { success: true as const, dsl: parsed.data };
}

export function compileGameplayDsl(payload: unknown, assetPack?: AssetPack): CompileResult {
  const validation = validateGameplayDsl(payload, assetPack);
  if (!validation.success) return { success: false, errors: validation.errors };
  if (validation.dsl.version === "2") {
    return compileGameplayDslV2(validation.dsl);
  }

  const enemyArchetypes: NonNullable<GameHooks["enemyArchetypes"]> = [];
  const encounterTimeline: NonNullable<GameHooks["encounterTimeline"]> = [];
  const stageGoals: NonNullable<GameHooks["stageGoals"]> = [];
  let effectCount = 0;

  for (const rule of validation.dsl.rules) {
    const threshold = triggerThreshold(rule.when);
    const trigger = rule.when.trim().startsWith("score") ? "score" : "time";

    if (rule.do === "effect") {
      effectCount += 1;
      continue;
    }

    if (ENEMY_EVENTS.has(rule.do)) {
      const enemyType = rule.enemyType ?? (rule.do === "spawn_mine" ? "mine" : "charger");
      enemyArchetypes.push({
        id: `${enemyType}_${enemyArchetypes.length + 1}`,
        type: enemyType,
        count: clampCount(rule.count),
        speed: enemyType === "mine" ? 0 : 130 + enemyArchetypes.length * 10,
        spawnAfterMs: trigger === "time" ? threshold : 0,
        warningMs: 420
      });
    }

    if (rule.do === "stage_change") {
      stageGoals.push({
        id: rule.stageId ?? `stage_${stageGoals.length + 1}`,
        label: rule.message ?? readableRuleMessage(rule),
        startsAtMs: trigger === "time" ? threshold : threshold * 3000,
        durationMs: 6000,
        objective: "finale",
        target: clampCount(rule.count),
        enemyMix: enemyArchetypes.map((enemy) => enemy.id).slice(-3),
        rewardPacing: "burst"
      });
    }

    encounterTimeline.push({
      atMs: trigger === "time" ? threshold : threshold * 3000,
      trigger,
      event: rule.do === "stage_change" ? "finale" : rule.do,
      intensity: clampCount(rule.count),
      message: rule.message ?? readableRuleMessage(rule)
    });
  }

  return {
    success: true,
    hooks: {
      enemyArchetypes,
      encounterTimeline,
      stageGoals,
      impactRules: {
        hitStopMs: effectCount > 0 ? 100 : 70,
        screenShakeIntensity: effectCount > 0 ? 0.026 : 0.018,
        explosionParticles: effectCount > 0 ? 32 : 22,
        knockbackForce: 190,
        invulnerabilityMs: 650,
        comboWindowMs: 1800
      }
    }
  };
}

export function createGameplayDslRuntime(payload: unknown, assetPack?: AssetPack) {
  const compiled = compileGameplayDsl(payload, assetPack);
  if (!compiled.success || !compiled.runtimeProgram) return undefined;
  return createDslVm(compiled.runtimeProgram);
}

function compileGameplayDslV2(_dsl: GameplayDslV2): CompileResult {
  return {
    success: true,
    runtimeProgram: _dsl,
    hooks: {
      enemyArchetypes: [],
      encounterTimeline: [],
      stageGoals: [],
      impactRules: {
        hitStopMs: 80,
        screenShakeIntensity: 0.018,
        explosionParticles: 22,
        knockbackForce: 180,
        invulnerabilityMs: 650,
        comboWindowMs: 1800
      }
    }
  };
}

function v1AssetKeys(rules: GameplayDslRule[]): string[] {
  return rules.flatMap((rule) => rule.assetKey ? [rule.assetKey] : []);
}

function v2AssetKeys(dsl: GameplayDslV2): string[] {
  const keys = new Set<string>();
  for (const item of dsl.items ?? []) keys.add(item.assetKey);
  for (const rule of dsl.rules) {
    if (rule.when.type === "collected") keys.add(rule.when.assetKey);
    for (const action of rule.do) {
      if (action.type === "open_door" || action.type === "grant_item") keys.add(action.assetKey);
    }
  }
  return Array.from(keys);
}

function triggerThreshold(value: string): number {
  const parsed = Number(value.match(/\d+/)?.[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampCount(value: unknown): number {
  return Math.max(1, Math.min(6, typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 1));
}

function readableRuleMessage(rule: GameplayDslRule): string {
  if (rule.do === "spawn_mine") return "Mines enter the arena";
  if (rule.do === "projectile_burst") return "Projectile pressure incoming";
  if (rule.do === "reward_burst") return "Reward route opened";
  if (rule.do === "stage_change") return `Stage changed${rule.stageId ? `: ${rule.stageId}` : ""}`;
  return "Enemy wave incoming";
}
