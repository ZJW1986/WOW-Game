import { createConversationSession } from "../core/conversation";
import {
  createArtifacts,
  createAssetRequirements,
  createPublishRecord,
  createQaReport,
  runMockPipeline,
  validateAssetReferences
} from "../core/pipeline";
import { classificationSchema, gameConfigSchema, gddSchema } from "../core/schemas";
import type {
  AssetPack,
  GameConfig,
  MockProject,
  PlayFeedback,
  PublishRecord,
  TemplateFamily,
  UserAnswer
} from "../core/types";
import type { ModelTaskRequest } from "./backend";
import { createDeepSeekExecutor, type DeepSeekExecutorOptions } from "./deepSeekExecutor";
import { createModelGateway, type GatewayResult } from "./modelGateway";
import { createPromptForTask } from "./promptPack";

export interface GeneratePlayableInput {
  idea: string;
  answers: UserAnswer[];
  templateFamily: TemplateFamily;
  projectId: string;
  baseUrl: string;
  model?: "deepseek-v4-flash" | "mock-designer" | "custom-provider";
}

export interface GenerationServiceOptions {
  deepseekApiKey?: string;
  deepseekBaseUrl?: string;
  fetcher?: DeepSeekExecutorOptions["fetcher"];
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
  | GatewayResult<ReturnType<typeof gddSchema.parse>>
  | GatewayResult<ReturnType<typeof gameConfigSchema.parse>>;

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

  return {
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
          preferredTemplate: input.templateFamily
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

      const assetRequirements = createAssetRequirements(classificationTask.output.templateFamily);
      const assetPack: AssetPack = {
        versionId: "v1",
        assets: assetRequirements
      };
      const fallbackGdd = extractArtifactContent(mockProject, "gdd.json");

      const gddTask = await gateway.runModelTask({
        taskType: "llm.gdd",
        provider,
        model,
        prompt: createPromptForTask("llm.gdd", {
          idea: input.idea,
          answers: input.answers,
          classification: classificationTask.output
        }),
        schema: gddSchema,
        preprocess: (raw) => normalizeGdd(raw, gddSchema.parse(fallbackGdd)),
        fallback: gddSchema.parse(fallbackGdd)
      });
      modelTasks.push(gddTask);
      trackFallback(gddTask, fallbacksUsed);

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
          assetPack
        }),
        schema: gameConfigSchema,
        preprocess: (raw) => normalizeGameConfig(raw, fallbackConfig),
        fallback: fallbackConfig
      });
      modelTasks.push(configTask);
      trackFallback(configTask, fallbacksUsed);

      const gameConfig = sanitizeGameConfig(configTask.output, assetPack);
      const qaReport = createQaReport(gameConfig, assetPack);
      const publishRecord = createPublishRecord(input.projectId, "v1", gameConfig.title, {
        visibility: "public",
        baseUrl: input.baseUrl,
        coverAssetKey: "cover.main"
      });
      const artifacts = createArtifacts({
        idea: input.idea,
        title: gameConfig.title,
        classification: classificationTask.output,
        assetRequirements,
        assetPack,
        gameConfig,
        qaReport,
        publishRecord
      }).map((artifact) =>
        artifact.fileName === "gdd.json"
          ? { ...artifact, content: gddTask.output }
          : artifact.fileName === "gdd.md"
            ? {
                ...artifact,
                content: `# Technical GDD\n\n\`\`\`json\n${JSON.stringify(gddTask.output, null, 2)}\n\`\`\``
              }
            : artifact
      );

      const project: MockProject = {
        ...mockProject,
        id: input.projectId,
        title: gameConfig.title,
        classification: classificationTask.output,
        artifacts,
        assetPack,
        gameConfig,
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
    level: normalizeLevel(value.level, fallback.level)
  };
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
  if (text.includes("中") || text.includes("normal") || text.includes("medium")) return "normal";
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
