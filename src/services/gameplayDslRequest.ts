import { gameplayDslSchema } from "../core/schemas";
import type { AssetPack, DesignBrief, GameConfig, GameplayDsl } from "../core/types";
import type { ModelTaskRequest } from "./backend";
import { validateGameplayDsl } from "./gameplayDsl";
import { createRetryBudget } from "./retryBudget";

export interface RequestGameplayDslInput {
  idea: string;
  designBrief: DesignBrief;
  gameConfig: GameConfig;
  assetPack: AssetPack;
  fallback: GameplayDsl;
  provider: (request: ModelTaskRequest) => Promise<string>;
  providerName?: ModelTaskRequest["provider"];
  model?: string;
  maxRepairAttempts?: number;
}

export interface RequestGameplayDslResult {
  dsl: GameplayDsl;
  status: "success" | "fallback";
  attempts: number;
  validationErrors: string[];
}

export async function requestGameplayDsl(input: RequestGameplayDslInput): Promise<RequestGameplayDslResult> {
  const repairLimit = Math.max(0, input.maxRepairAttempts ?? 2);
  const retryBudget = createRetryBudget({ dsl: repairLimit });
  const maxAttempts = 1 + repairLimit;
  const validationErrors: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const prompt = buildGameplayDslPrompt(input, validationErrors);
    try {
      const raw = await input.provider({
        taskType: "llm.gameplay_dsl",
        provider: input.providerName ?? "deepseek",
        model: input.model ?? "deepseek-v4-flash",
        prompt
      });
      const payload = JSON.parse(raw) as unknown;
      const parsed = gameplayDslSchema.safeParse(payload);
      if (!parsed.success) {
        validationErrors.push(...parsed.error.issues.map((issue) => issue.message));
        if (attempt < maxAttempts) retryBudget.consume("dsl");
        continue;
      }
      const validation = validateGameplayDsl(parsed.data, input.assetPack);
      if (!validation.success) {
        validationErrors.push(...validation.errors);
        if (attempt < maxAttempts) retryBudget.consume("dsl");
        continue;
      }
      return { dsl: validation.dsl, status: "success", attempts: attempt, validationErrors };
    } catch (error) {
      validationErrors.push(error instanceof Error ? error.message : String(error));
      if (attempt < maxAttempts) retryBudget.consume("dsl");
    }
  }

  return { dsl: input.fallback, status: "fallback", attempts: maxAttempts, validationErrors };
}

export function buildGameplayDslPrompt(input: RequestGameplayDslInput, validationErrors: string[] = []): string {
  const repairBlock = validationErrors.length
    ? [
        "请修复以下 GameplayDSL 校验错误，只返回修复后的 JSON：",
        ...validationErrors.map((error) => `- ${error}`)
      ].join("\n")
    : "请生成 GameplayDSL v2 JSON，只返回 JSON。";

  return [
    "你是 WOW Game 的受控玩法 DSL 设计器。",
    "Task: llm.gameplay_dsl.",
    "禁止输出 Phaser/Three.js 生命周期代码、JavaScript、TypeScript、DOM、网络请求或 markdown。",
    "必须输出 JSON object，优先使用 version:\"2\"。",
    "允许触发器：time, score, collected, enemiesAlive, stage, hpBelow, zoneEntered, combo。",
    "允许动作：spawn_zone, open_door, grant_item, set_counter, change_player_speed, fail, win。",
    "assetKey 只能使用 assetPack 中存在的 key。",
    repairBlock,
    "",
    "参考示例 1：",
    JSON.stringify({
      version: "2",
      items: [{ assetKey: "item.key", grantsCounter: "keys", value: 1 }],
      rules: [
        {
          id: "three-keys-open-door",
          when: { type: "collected", assetKey: "item.key", count: 3 },
          do: [{ type: "open_door", assetKey: "door.portal" }]
        }
      ]
    }),
    "参考示例 2：",
    JSON.stringify({
      version: "2",
      zones: [{ id: "right-lane", x: 640, y: 120, width: 160, height: 260 }],
      rules: [
        {
          id: "score-spawn-pressure",
          when: { type: "score", op: ">=", value: 5 },
          do: [{ type: "spawn_zone", zoneId: "right-lane", enemyType: "chaser", count: 3 }]
        }
      ]
    }),
    "参考示例 3：",
    JSON.stringify({
      version: "2",
      counters: [{ name: "comboReward", initialValue: 0 }],
      rules: [
        {
          id: "combo-reward",
          when: { type: "combo", op: ">=", value: 4 },
          do: [{ type: "set_counter", name: "comboReward", value: 1 }]
        }
      ]
    }),
    "",
    "Input:",
    JSON.stringify({
      idea: input.idea,
      designBrief: input.designBrief,
      gameConfig: input.gameConfig,
      assetKeys: input.assetPack.assets.map((asset) => asset.assetKey)
    }, null, 2)
  ].join("\n");
}
