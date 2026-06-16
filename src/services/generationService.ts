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
