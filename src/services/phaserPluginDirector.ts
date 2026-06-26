import type { AssetPack, GameHooks, PhaserPluginDirector } from "../core/types";
import { phaserPluginDirectorSchema } from "../core/schemas";

type CompileResult =
  | { success: true; hooks: Pick<GameHooks, "enemyArchetypes" | "encounterTimeline" | "impactRules" | "levelLayout"> }
  | { success: false; errors: string[] };

const forbiddenCodePatterns = [
  /new\s+Phaser\.Game/i,
  /\bscene\s*\./i,
  /\bthis\.(preload|create|update)\b/i,
  /\beval\s*\(/i,
  /\bfetch\s*\(/i,
  /\bXMLHttpRequest\b/i,
  /\bdocument\b/i,
  /\bwindow\b/i,
  /\blocalStorage\b/i
];

export function validatePhaserPluginDirector(payload: unknown, assetPack?: AssetPack) {
  const parsed = phaserPluginDirectorSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      accepted: false as const,
      errors: parsed.error.issues.map((issue) => issue.message),
      fallbackLayer: "gameplay-dsl" as const
    };
  }

  const errors: string[] = [];
  const assetKeys = new Set(assetPack?.assets.map((asset) => asset.assetKey) ?? []);
  for (const action of parsed.data.actions) {
    if (action.type === "scene_lifecycle") {
      errors.push("Forbidden Phaser lifecycle action: scene_lifecycle");
      continue;
    }
    if (action.type === "custom_code") {
      errors.push("Forbidden custom code action: custom_code");
      for (const pattern of forbiddenCodePatterns) {
        const match = action.code.match(pattern);
        if (match) errors.push(`Forbidden code token: ${match[0]}`);
      }
      continue;
    }
    if ("assetKey" in action && action.assetKey && !assetKeys.has(action.assetKey)) {
      errors.push(`Unknown plugin assetKey: ${action.assetKey}`);
    }
  }

  return {
    accepted: errors.length === 0,
    errors,
    fallbackLayer: "gameplay-dsl" as const,
    director: parsed.data
  };
}

export function compilePhaserPluginDirectorToHooks(payload: unknown, assetPack?: AssetPack): CompileResult {
  const validation = validatePhaserPluginDirector(payload, assetPack);
  if (!validation.accepted) return { success: false, errors: validation.errors };

  const director = validation.director as PhaserPluginDirector;
  const enemyArchetypes: NonNullable<GameHooks["enemyArchetypes"]> = [];
  const encounterTimeline: NonNullable<GameHooks["encounterTimeline"]> = [];
  const lanes: GameHooks["levelLayout"]["lanes"] = [];
  const platforms: GameHooks["levelLayout"]["platforms"] = [];
  let maxShake = 0.018;
  let effectCount = 0;

  for (const action of director.actions) {
    if (action.type === "spawn_enemy" || action.type === "spawn_projectile") {
      const enemyType = action.enemyType ?? (action.type === "spawn_projectile" ? "shooter" : "charger");
      enemyArchetypes.push({
        id: `${enemyType}_${enemyArchetypes.length + 1}`,
        type: enemyType,
        count: clampCount(action.count),
        speed: enemyType === "mine" ? 0 : 140 + enemyArchetypes.length * 8,
        spawnAfterMs: action.atMs,
        warningMs: 420
      });
      encounterTimeline.push({
        atMs: action.atMs,
        trigger: "time",
        event: action.type === "spawn_projectile" ? "projectile_burst" : "spawn_wave",
        intensity: clampCount(action.count),
        message: action.type === "spawn_projectile" ? "Projectile burst incoming" : "Enemy wave incoming"
      });
    }

    if (action.type === "spawn_item") {
      encounterTimeline.push({
        atMs: action.atMs,
        trigger: "time",
        event: "reward_burst",
        intensity: clampCount(action.count),
        message: "Reward item spawned"
      });
    }

    if (action.type === "moving_platform") {
      platforms.push({
        x: action.x ?? 480,
        y: action.y ?? 360,
        width: 170,
        height: 20
      });
    }

    if (action.type === "path_lane") {
      lanes.push({
        y: action.y ?? 260,
        speed: action.speed ?? 120,
        count: clampCount(action.count)
      });
    }

    if (action.type === "camera_shake") maxShake = Math.max(maxShake, action.intensity ?? 0.02);
    if (action.type === "particles" || action.type === "hit_flash" || action.type === "status_effect") effectCount += 1;
  }

  return {
    success: true,
    hooks: {
      enemyArchetypes,
      encounterTimeline,
      impactRules: {
        hitStopMs: effectCount > 0 ? 100 : 70,
        screenShakeIntensity: maxShake,
        explosionParticles: effectCount > 0 ? 32 : 22,
        knockbackForce: 190,
        invulnerabilityMs: 650,
        comboWindowMs: 1800
      },
      levelLayout: {
        platforms,
        lanes,
        grid: { columns: 0, rows: 0 }
      }
    }
  };
}

function clampCount(value: unknown): number {
  return Math.max(1, Math.min(8, typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 1));
}
