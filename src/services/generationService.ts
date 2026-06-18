import { createConversationSession, createGuidedQuestions } from "../core/conversation";
import {
  createArtifacts,
  createAssetRequirements,
  createAssetStyleGuide,
  createPublishRecord,
  createQaReport,
  runMockPipeline,
  validateAssetReferences
} from "../core/pipeline";
import { classificationSchema, gameConfigSchema, gameHooksSchema, gddSchema, guidedQuestionsSchema } from "../core/schemas";
import type {
  AssetPack,
  DesignQuestion,
  GameConfig,
  GameHooks,
  MockProject,
  PlayFeedback,
  PublishRecord,
  ReferencePackageSummary,
  TemplateFamily,
  UserAnswer
} from "../core/types";
import type { ModelTaskRequest } from "./backend";
import { createDeepSeekExecutor, type DeepSeekExecutorOptions } from "./deepSeekExecutor";
import { createMediaGateway, type MediaGatewayOptions } from "./mediaGateway";
import { createModelGateway, type GatewayResult } from "./modelGateway";
import { createPromptForTask } from "./promptPack";
import { createAgnesImageProvider } from "./agnesImageProvider";
import { runDynamicVerification } from "./verificationBench";

export interface GeneratePlayableInput {
  idea: string;
  answers: UserAnswer[];
  templateFamily: TemplateFamily;
  projectId: string;
  baseUrl: string;
  model?: "deepseek-v4-flash" | "mock-designer" | "custom-provider";
  referencePackageSummary?: ReferencePackageSummary;
}

export interface GenerateGuidedQuestionsInput {
  idea: string;
  templateFamily: TemplateFamily;
  projectId?: string;
  model?: "deepseek-v4-flash" | "mock-designer" | "custom-provider";
}

export interface GenerationServiceOptions {
  deepseekApiKey?: string;
  deepseekBaseUrl?: string;
  fetcher?: DeepSeekExecutorOptions["fetcher"];
  mediaGateway?: MediaGatewayOptions;
}

export interface SharePayload {
  qrPayload: string;
  webShareData: {
    title: string;
    text: string;
    url: string;
  };
}

type GenerationModelTask =
  | GatewayResult<unknown>
  | GatewayResult<ReturnType<typeof classificationSchema.parse>>
  | GatewayResult<ReturnType<typeof guidedQuestionsSchema.parse>>
  | GatewayResult<ReturnType<typeof gddSchema.parse>>
  | GatewayResult<ReturnType<typeof gameConfigSchema.parse>>
  | GatewayResult<ReturnType<typeof gameHooksSchema.parse>>;

export function createGenerationService(options: GenerationServiceOptions = {}) {
  const env = readRuntimeEnv();
  const apiKey = options.deepseekApiKey ?? env.DEEPSEEK_API_KEY;
  const baseUrl = options.deepseekBaseUrl ?? env.DEEPSEEK_BASE_URL;
  const executor = createDeepSeekExecutor({
    apiKey,
    baseUrl,
    fetcher: options.fetcher
  });
  const gateway = createModelGateway({
    provider: async (request: ModelTaskRequest) => {
      if (request.provider !== "deepseek") {
        return JSON.stringify({});
      }
      const result = await executor.runJsonTask(request);
      if (result.status !== "success") {
        throw new Error(result.error ?? `DeepSeek task failed: ${result.status}`);
      }
      return result.rawJson;
    }
  });
  const mediaGateway = createMediaGateway({
    ...createMediaGatewayOptionsFromEnv(env),
    ...options.mediaGateway
  });

  return {
    async generateGuidedQuestions(input: GenerateGuidedQuestionsInput) {
      const fallbackQuestions = createGuidedQuestions(input.idea);
      const useRealModel = (input.model ?? "deepseek-v4-flash") === "deepseek-v4-flash";
      const provider = useRealModel ? "deepseek" : "mock";
      const model = useRealModel ? "deepseek-v4-flash" : "mock-designer";
      const task = await gateway.runModelTask({
        taskType: "llm.guided_questions",
        provider,
        model,
        prompt: createPromptForTask("llm.guided_questions", {
          idea: input.idea,
          templateFamily: input.templateFamily,
          projectId: input.projectId,
          designGuardrails: [
            "Only ask questions that can affect a first playable 2D game.",
            "Prefer controls, win condition, fail condition, visual style, target duration.",
            "Keep platformer/top_down constraints compatible with Phaser templates."
          ]
        }),
        schema: guidedQuestionsSchema,
        preprocess: (raw) => normalizeGuidedQuestions(raw, fallbackQuestions, input.idea),
        fallback: { questions: fallbackQuestions }
      });

      return {
        questions: task.output.questions,
        modelTask: task,
        fallbackUsed: task.status === "fallback"
      };
    },

    async generatePlayableVersion(input: GeneratePlayableInput) {
      const session = createConversationSession(input.idea, {
        projectId: input.projectId,
        preferredTemplate: input.templateFamily
      });
      const mockProject = runMockPipeline(input.idea);
      mockProject.id = input.projectId;

      const modelTasks: GenerationModelTask[] = [];
      const fallbacksUsed: string[] = [];
      const useRealModel = (input.model ?? "deepseek-v4-flash") === "deepseek-v4-flash";
      const provider = useRealModel ? "deepseek" : "mock";
      const model = useRealModel ? "deepseek-v4-flash" : "mock-designer";

      const classificationTask = await gateway.runModelTask({
        taskType: "llm.classification",
        provider,
        model,
        prompt: createPromptForTask("llm.classification", {
          idea: input.idea,
          answers: input.answers,
          preferredTemplate: input.templateFamily,
          referencePackageSummary: input.referencePackageSummary
        }),
        schema: classificationSchema,
        preprocess: (raw) => normalizeClassification(raw, input.templateFamily),
        fallback: {
          ...mockProject.classification,
          templateFamily: input.templateFamily
        }
      });
      modelTasks.push(classificationTask);
      trackFallback(classificationTask, fallbacksUsed);

      const fallbackGdd = extractArtifactContent(mockProject, "gdd.json");
      const parsedFallbackGdd = gddSchema.parse(fallbackGdd);
      const gddTask = await gateway.runModelTask({
        taskType: "llm.gdd",
        provider,
        model,
        prompt: createPromptForTask("llm.gdd", {
          idea: input.idea,
          answers: input.answers,
          classification: classificationTask.output,
          referencePackageSummary: input.referencePackageSummary
        }),
        schema: gddSchema,
        preprocess: (raw) => normalizeGdd(raw, parsedFallbackGdd),
        fallback: parsedFallbackGdd
      });
      modelTasks.push(gddTask);
      trackFallback(gddTask, fallbacksUsed);

      const assetStyleGuide = createAssetStyleGuide({
        title: mockProject.title,
        templateFamily: classificationTask.output.templateFamily,
        gdd: gddTask.output
      });
      const assetRequirements = createAssetRequirements(classificationTask.output.templateFamily).map(
        (requirement) => ({
          ...requirement,
          style: `${assetStyleGuide.visualStyle}; ${requirement.style}`,
          prompt: assetStyleGuide.assetPrompts[requirement.assetKey] ?? requirement.prompt
        })
      );
      const generatedAssets = await Promise.all(
        assetRequirements.map((requirement) =>
          mediaGateway.generateProjectAsset(input.projectId, "v1", requirement)
        )
      );
      const assetPack: AssetPack = {
        versionId: "v1",
        assets: generatedAssets
      };

      const fallbackConfig = {
        ...mockProject.gameConfig,
        templateFamily: classificationTask.output.templateFamily
      };
      const configTask = await gateway.runModelTask({
        taskType: "llm.game_config",
        provider,
        model,
        prompt: createPromptForTask("llm.game_config", {
          idea: input.idea,
          answers: input.answers,
          classification: classificationTask.output,
          gdd: gddTask.output,
          assetPack,
          referencePackageSummary: input.referencePackageSummary
        }),
        schema: gameConfigSchema,
        preprocess: (raw) => normalizeGameConfig(raw, fallbackConfig),
        fallback: fallbackConfig
      });
      modelTasks.push(configTask);
      trackFallback(configTask, fallbacksUsed);

      const gameConfig = sanitizeGameConfig(configTask.output, assetPack);
      const fallbackHooks = createFallbackGameHooks(gameConfig);
      const hooksTask = await gateway.runModelTask({
        taskType: "llm.game_hooks",
        provider,
        model,
        prompt: createPromptForTask("llm.game_hooks", {
          idea: input.idea,
          answers: input.answers,
          classification: classificationTask.output,
          gdd: gddTask.output,
          gameConfig,
          referencePackageSummary: input.referencePackageSummary
        }),
        schema: gameHooksSchema,
        preprocess: (raw) => normalizeGameHooks(raw, fallbackHooks),
        fallback: fallbackHooks
      });
      modelTasks.push(hooksTask);
      trackFallback(hooksTask, fallbacksUsed);

      const gameHooks = hooksTask.output;
      const publishRecord = createPublishRecord(input.projectId, "v1", gameConfig.title, {
        visibility: "public",
        baseUrl: input.baseUrl,
        coverAssetKey: "cover.main"
      });
      const qaReport = runDynamicVerification({
        ...mockProject,
        id: input.projectId,
        title: gameConfig.title,
        classification: classificationTask.output,
        assetPack,
        gameConfig,
        gameHooks,
        qaReport: createQaReport(gameConfig, assetPack),
        playUrl: publishRecord.playUrl
      });
      const artifacts = createArtifacts({
        idea: input.idea,
        title: gameConfig.title,
        classification: classificationTask.output,
        assetRequirements,
        assetStyleGuide,
        assetPack,
        gameConfig,
        gameHooks,
        qaReport,
        publishRecord
      })
        .map((artifact) =>
          artifact.fileName === "gdd.json"
            ? { ...artifact, content: gddTask.output }
            : artifact.fileName === "gdd.md"
              ? {
                  ...artifact,
                  content: `# Technical GDD\n\n\`\`\`json\n${JSON.stringify(gddTask.output, null, 2)}\n\`\`\``
                }
              : artifact
        )
        .concat(
          input.referencePackageSummary
            ? [
                {
                  stage: "asset-requirements" as const,
                  fileName: "reference-package.json",
                  title: "Reference Package",
                  content: input.referencePackageSummary,
                  format: "json" as const
                }
              ]
            : []
        );

      const project: MockProject = {
        ...mockProject,
        id: input.projectId,
        title: gameConfig.title,
        classification: classificationTask.output,
        artifacts,
        assetPack,
        gameConfig,
        gameHooks,
        qaReport,
        playUrl: publishRecord.playUrl
      };
      const version = {
        id: "v1",
        projectId: input.projectId,
        artifactFiles: project.artifacts.map((artifact) => artifact.fileName),
        status: "published" as const
      };
      const share = createSharePayload(publishRecord);
      const feedback: PlayFeedback = {
        versionId: version.id,
        rating: 0,
        comment: "",
        playerName: "",
        iterationSuggestion: "下一版可根据玩家反馈继续调整节奏、数值和关卡。",
        createdAt: "2026-06-17T00:00:00.000Z"
      };

      return {
        session: {
          ...session,
          answers: input.answers
        },
        project,
        version,
        publishRecord,
        share,
        feedback,
        modelTasks,
        fallbacksUsed
      };
    }
  };
}

function normalizeGuidedQuestions(raw: unknown, fallbackQuestions: DesignQuestion[], idea = "") {
  const value = asRecord(raw);
  const rawQuestions = Array.isArray(value.questions) ? value.questions : Array.isArray(raw) ? raw : [];
  if (rawQuestions.length < 3) {
    return { questions: [] };
  }
  const questions = rawQuestions
    .map((item, index) => normalizeDesignQuestion(item, fallbackQuestions[index], index))
    .filter((item): item is DesignQuestion => Boolean(item));
  if (questions.length < 3) {
    throw new Error("Guided questions artifact must include at least 3 usable questions");
  }
  if (containsChinese(idea) && questions.some(questionLooksEnglish)) {
    return { questions: fallbackQuestions };
  }
  return {
    questions: questions.slice(0, 5)
  };
}

function normalizeDesignQuestion(
  raw: unknown,
  fallback: DesignQuestion | undefined,
  index: number
): DesignQuestion | null {
  const value = asRecord(raw);
  const inputType = normalizeInputType(value.inputType, fallback?.inputType ?? "short_text");
  const id = normalizeQuestionId(value.id, fallback?.id ?? `question_${index + 1}`);
  const label = normalizeString(value.label, fallback?.label ?? `问题 ${index + 1}`);
  const prompt = normalizeString(value.prompt, fallback?.prompt ?? label);
  const defaultAnswer = normalizeString(value.defaultAnswer, fallback?.defaultAnswer ?? "");
  const options = normalizeStringArray(value.options, fallback?.options ?? []);
  if (!prompt || !defaultAnswer) return null;
  return {
    id,
    label,
    prompt,
    inputType,
    options: inputType === "short_text" || inputType === "number" ? undefined : options,
    defaultAnswer,
    required: typeof value.required === "boolean" ? value.required : fallback?.required ?? true
  };
}

function normalizeQuestionId(value: unknown, fallback: string): string {
  const text = normalizeString(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return text || fallback;
}

function normalizeInputType(value: unknown, fallback: DesignQuestion["inputType"]): DesignQuestion["inputType"] {
  if (
    value === "single_choice" ||
    value === "multi_choice" ||
    value === "short_text" ||
    value === "number"
  ) {
    return value;
  }
  const text = normalizeString(value, "").toLowerCase();
  if (text.includes("single") || text.includes("单选")) return "single_choice";
  if (text.includes("multi") || text.includes("多选")) return "multi_choice";
  if (text.includes("number") || text.includes("数字")) return "number";
  return fallback;
}

function normalizeClassification(raw: unknown, fallbackFamily: TemplateFamily) {
  const value = asRecord(raw);
  return {
    templateFamily: normalizeTemplateFamily(value.templateFamily, fallbackFamily),
    reasons: normalizeStringArray(value.reasons),
    risks: normalizeStringArray(value.risks),
    unsupportedRequests: normalizeStringArray(value.unsupportedRequests)
  };
}

function normalizeGdd(raw: unknown, fallback: ReturnType<typeof gddSchema.parse>) {
  const value = asRecord(raw);
  return {
    concept: normalizeString(value.concept, fallback.concept),
    loop: normalizeStringArray(value.loop, fallback.loop),
    entities: normalizeStringArray(value.entities, fallback.entities),
    level: normalizeLevel(value.level, fallback.level),
    numbers: asRecord(value.numbers),
    implementationRoute: normalizeString(value.implementationRoute, fallback.implementationRoute)
  };
}

function normalizeGameConfig(raw: unknown, fallback: GameConfig): GameConfig {
  const value = asRecord(raw);
  return {
    templateFamily: normalizeTemplateFamily(value.templateFamily, fallback.templateFamily),
    title: normalizeString(value.title, fallback.title),
    pitch: normalizeString(value.pitch, fallback.pitch),
    playerGoal: normalizeString(value.playerGoal, fallback.playerGoal),
    controls: normalizeStringArray(value.controls, fallback.controls),
    difficulty: normalizeDifficulty(value.difficulty, fallback.difficulty),
    referencedAssetKeys: normalizeStringArray(value.referencedAssetKeys, fallback.referencedAssetKeys),
    gameplay: normalizeGameplay(value.gameplay, fallback.gameplay),
    level: normalizeLevel(value.level, fallback.level)
  };
}

function createFallbackGameHooks(config: GameConfig): GameHooks {
  return {
    enemyRules: {
      movement: config.gameplay.enemyBehavior === "wave" ? "wave" : config.gameplay.enemyBehavior === "chase" ? "chase" : "patrol",
      speed: config.templateFamily === "platformer" ? 120 : 150,
      waveIntervalMs: config.gameplay.enemyBehavior === "wave" ? 1400 : 0
    },
    collectibleRules: {
      placement: config.templateFamily === "grid_logic" ? "grid" : config.templateFamily === "platformer" ? "arc" : "line",
      value: 1,
      respawn: false
    },
    winCondition: {
      mode: config.gameplay.objectiveMode,
      target: config.level.winScore
    },
    failCondition: {
      mode: config.templateFamily === "tower_defense" ? "base_destroyed" : "hit_hazard",
      lives: 1
    },
    numberTuning: {
      playerSpeed: config.templateFamily === "platformer" ? 210 : 250,
      jumpVelocity: config.templateFamily === "platformer" ? 430 : 0,
      hazardSpeed: config.templateFamily === "platformer" ? 90 : 130
    },
    levelLayout: {
      platforms:
        config.templateFamily === "platformer"
          ? [
              { x: 480, y: 510, width: 920, height: 28 },
              { x: 360, y: 390, width: 180, height: 20 },
              { x: 680, y: 290, width: 180, height: 20 }
            ]
          : [],
      lanes: [
        { y: 170, speed: 120, count: Math.max(1, Math.ceil(config.level.hazards / 2)) },
        { y: 320, speed: 150, count: Math.max(1, Math.floor(config.level.hazards / 2)) }
      ],
      grid: { columns: 8, rows: 6 }
    }
  };
}

function normalizeGameHooks(raw: unknown, fallback: GameHooks): GameHooks {
  const value = asRecord(raw);
  const enemyRules = asRecord(value.enemyRules);
  const collectibleRules = asRecord(value.collectibleRules);
  const winCondition = asRecord(value.winCondition);
  const failCondition = asRecord(value.failCondition);
  const numberTuning = asRecord(value.numberTuning);
  const levelLayout = asRecord(value.levelLayout);
  return {
    enemyRules: {
      movement: normalizeEnum(enemyRules.movement, fallback.enemyRules.movement, ["static", "patrol", "chase", "wave"]),
      speed: normalizeNumber(enemyRules.speed, fallback.enemyRules.speed),
      waveIntervalMs: normalizeNumber(enemyRules.waveIntervalMs, fallback.enemyRules.waveIntervalMs)
    },
    collectibleRules: {
      placement: normalizeEnum(collectibleRules.placement, fallback.collectibleRules.placement, [
        "line",
        "arc",
        "grid",
        "random"
      ]),
      value: normalizeNumber(collectibleRules.value, fallback.collectibleRules.value),
      respawn: typeof collectibleRules.respawn === "boolean" ? collectibleRules.respawn : fallback.collectibleRules.respawn
    },
    winCondition: {
      mode: normalizeEnum(winCondition.mode, fallback.winCondition.mode, [
        "collect_score",
        "reach_exit",
        "survive_timer",
        "defend_base",
        "solve_state"
      ]),
      target: normalizeNumber(winCondition.target, fallback.winCondition.target)
    },
    failCondition: {
      mode: normalizeEnum(failCondition.mode, fallback.failCondition.mode, [
        "hit_hazard",
        "time_out",
        "base_destroyed",
        "moves_exhausted"
      ]),
      lives: normalizeNumber(failCondition.lives, fallback.failCondition.lives)
    },
    numberTuning: {
      playerSpeed: normalizeNumber(numberTuning.playerSpeed, fallback.numberTuning.playerSpeed),
      jumpVelocity: normalizeNumber(numberTuning.jumpVelocity, fallback.numberTuning.jumpVelocity),
      hazardSpeed: normalizeNumber(numberTuning.hazardSpeed, fallback.numberTuning.hazardSpeed)
    },
    levelLayout: {
      platforms: normalizeRectArray(levelLayout.platforms, fallback.levelLayout.platforms),
      lanes: normalizeLaneArray(levelLayout.lanes, fallback.levelLayout.lanes),
      grid: {
        columns: normalizeNumber(asRecord(levelLayout.grid).columns, fallback.levelLayout.grid.columns),
        rows: normalizeNumber(asRecord(levelLayout.grid).rows, fallback.levelLayout.grid.rows)
      }
    }
  };
}

function normalizeGameplay(value: unknown, fallback: GameConfig["gameplay"]): GameConfig["gameplay"] {
  const record = asRecord(value);
  return {
    primaryAction: normalizeEnum(record.primaryAction, fallback.primaryAction, [
      "dodge_collect",
      "jump_reach_goal",
      "solve_grid",
      "defend_route",
      "manage_choices"
    ]),
    enemyBehavior: normalizeEnum(record.enemyBehavior, fallback.enemyBehavior, [
      "static",
      "patrol",
      "chase",
      "wave",
      "timer"
    ]),
    objectiveMode: normalizeEnum(record.objectiveMode, fallback.objectiveMode, [
      "collect_score",
      "reach_exit",
      "survive_timer",
      "defend_base",
      "solve_state"
    ]),
    playerAbility: normalizeEnum(record.playerAbility, fallback.playerAbility, [
      "dash",
      "jump",
      "push",
      "build",
      "choose"
    ]),
    spawnPattern: normalizeEnum(record.spawnPattern, fallback.spawnPattern, [
      "fixed",
      "staggered",
      "lanes",
      "grid",
      "waves"
    ])
  };
}

function normalizeEnum<T extends string>(value: unknown, fallback: T, allowed: readonly T[]): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeTemplateFamily(value: unknown, fallback: TemplateFamily): TemplateFamily {
  if (
    value === "platformer" ||
    value === "top_down" ||
    value === "grid_logic" ||
    value === "tower_defense" ||
    value === "ui_heavy"
  ) {
    return value;
  }
  const text = normalizeString(value, "").toLowerCase();
  if (text.includes("平台") || text.includes("跳") || text.includes("platform")) return "platformer";
  if (text.includes("俯视") || text.includes("飞船") || text.includes("top")) return "top_down";
  if (text.includes("格子") || text.includes("解谜") || text.includes("grid")) return "grid_logic";
  if (text.includes("塔防") || text.includes("tower")) return "tower_defense";
  if (text.includes("经营") || text.includes("卡牌") || text.includes("ui")) return "ui_heavy";
  return fallback;
}

function normalizeDifficulty(value: unknown, fallback: GameConfig["difficulty"]): GameConfig["difficulty"] {
  if (value === "easy" || value === "normal" || value === "hard") return value;
  const text = normalizeString(value, "").toLowerCase();
  if (text.includes("简单") || text.includes("easy")) return "easy";
  if (text.includes("困难") || text.includes("hard")) return "hard";
  if (text.includes("中等") || text.includes("normal") || text.includes("medium")) return "normal";
  return fallback;
}

function normalizeLevel(value: unknown, fallback: GameConfig["level"]) {
  const record = asRecord(value);
  return {
    width: normalizeNumber(record.width, fallback.width),
    height: normalizeNumber(record.height, fallback.height),
    collectibles: normalizeNumber(record.collectibles, fallback.collectibles),
    hazards: normalizeNumber(record.hazards, fallback.hazards),
    winScore: normalizeNumber(record.winScore, fallback.winScore)
  };
}

function normalizeRectArray(
  value: unknown,
  fallback: GameHooks["levelLayout"]["platforms"]
): GameHooks["levelLayout"]["platforms"] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => {
      const record = asRecord(item);
      return {
        x: normalizeNumber(record.x, 0),
        y: normalizeNumber(record.y, 0),
        width: normalizeNumber(record.width, 0),
        height: normalizeNumber(record.height, 0)
      };
    })
    .filter((item) => item.width > 0 && item.height > 0);
  return items.length > 0 ? items : fallback;
}

function normalizeLaneArray(
  value: unknown,
  fallback: GameHooks["levelLayout"]["lanes"]
): GameHooks["levelLayout"]["lanes"] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => {
      const record = asRecord(item);
      return {
        y: normalizeNumber(record.y, 0),
        speed: normalizeNumber(record.speed, 0),
        count: normalizeNumber(record.count, 0)
      };
    })
    .filter((item) => item.count > 0);
  return items.length > 0 ? items : fallback;
}

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.match(/\d+/)?.[0]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function normalizeStringArray(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (typeof item === "number") return String(item);
        const record = asRecord(item);
        return normalizeString(record.name ?? record.label ?? record.id ?? record.value, "");
      })
      .filter(Boolean);
    return items.length > 0 ? items : fallback;
  }
  if (typeof value === "string") {
    const items = value
      .split(/[,，、\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : fallback;
  }
  return fallback;
}

function containsChinese(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

function questionLooksEnglish(question: DesignQuestion): boolean {
  const visibleText = [
    question.label,
    question.prompt,
    question.defaultAnswer,
    ...(question.options ?? [])
  ].join(" ");
  return /[A-Za-z]{4,}/.test(visibleText) && !containsChinese(visibleText);
}

function asRecord(value: unknown): Record<string, any> {
  return typeof value === "object" && value !== null ? (value as Record<string, any>) : {};
}

function sanitizeGameConfig(config: GameConfig, assetPack: AssetPack): GameConfig {
  const available = new Set(assetPack.assets.map((asset) => asset.assetKey));
  const referencedAssetKeys = config.referencedAssetKeys.filter((assetKey) => available.has(assetKey));
  const safeReferencedAssetKeys =
    referencedAssetKeys.length > 0 ? referencedAssetKeys : assetPack.assets.map((asset) => asset.assetKey);
  const sanitized = {
    ...config,
    referencedAssetKeys: safeReferencedAssetKeys
  };
  const missing = validateAssetReferences(sanitized, assetPack);
  if (missing.length > 0) {
    return {
      ...sanitized,
      referencedAssetKeys: safeReferencedAssetKeys.filter((assetKey) => !missing.includes(assetKey))
    };
  }
  return sanitized;
}

function trackFallback(result: GatewayResult<unknown>, fallbacksUsed: string[]) {
  if (result.status === "fallback") {
    fallbacksUsed.push(result.taskType);
  }
}

function extractArtifactContent(project: MockProject, fileName: string) {
  const artifact = project.artifacts.find((item) => item.fileName === fileName);
  if (!artifact) {
    throw new Error(`Missing mock artifact: ${fileName}`);
  }
  return artifact.content;
}

function createSharePayload(publishRecord: PublishRecord): SharePayload {
  return {
    qrPayload: `WOW Game Share URL: ${publishRecord.publicUrl}`,
    webShareData: {
      title: publishRecord.shareTitle,
      text: publishRecord.shareDescription,
      url: publishRecord.publicUrl
    }
  };
}

function readRuntimeEnv(): Record<string, string | undefined> {
  const maybeProcess = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  return maybeProcess.process?.env ?? {};
}

function createMediaGatewayOptionsFromEnv(env: Record<string, string | undefined>): MediaGatewayOptions {
  if (env.IMAGE_PROVIDER !== "agnes") return {};
  return {
    imageProvider: createAgnesImageProvider({
      apiKey: env.IMAGE_API_KEY,
      baseUrl: env.IMAGE_BASE_URL,
      endpoint: env.IMAGE_ENDPOINT,
      model: env.IMAGE_MODEL,
      authHeader: env.IMAGE_AUTH_HEADER,
      responseImagePath: env.IMAGE_RESPONSE_PATH,
      timeoutMs: parseOptionalNumber(env.IMAGE_TIMEOUT_MS)
    })
  };
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
