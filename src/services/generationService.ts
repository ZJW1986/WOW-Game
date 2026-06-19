import { createConversationSession, createGuidedQuestions } from "../core/conversation";
import {
  createArtifacts,
  createAssetRequirements,
  createMatureGameBrief,
  createAssetStyleGuide,
  createGameHooks,
  createPublishRecord,
  createQaReport,
  runMockPipeline,
  validateAssetReferences
} from "../core/pipeline";
import {
  assetCandidatesSchema,
  classificationSchema,
  confirmedAssetsSchema,
  designBriefSchema,
  gameConfigSchema,
  gameHooksSchema,
  gddSchema,
  guidedQuestionsSchema,
  matureGameBriefSchema,
  revisionAnalysisSchema
} from "../core/schemas";
import type {
  AssetCandidate,
  AssetCandidates,
  AssetPack,
  ConfirmedAssets,
  DesignBrief,
  DesignQuestion,
  GameConfig,
  GameHooks,
  MatureGameBrief,
  MockProject,
  PlayFeedback,
  PublishRecord,
  ReferencePackageSummary,
  RevisionAnalysis,
  TemplateFamily,
  UserMaterial,
  UserAnswer
} from "../core/types";
import type { ModelTaskRequest } from "./backend";
import { createDeepSeekExecutor, type DeepSeekExecutorOptions } from "./deepSeekExecutor";
import { createMediaGateway, type MediaGatewayOptions } from "./mediaGateway";
import { createModelGateway, type GatewayResult } from "./modelGateway";
import { createPromptForTask } from "./promptPack";
import { createAgnesImageProvider } from "./agnesImageProvider";
import { runDynamicVerification } from "./verificationBench";
import { getReferenceGamePattern } from "./referenceGamePatterns";

export interface GeneratePlayableInput {
  idea: string;
  answers: UserAnswer[];
  templateFamily: TemplateFamily;
  projectId: string;
  baseUrl: string;
  model?: "deepseek-v4-flash" | "mock-designer" | "custom-provider";
  referencePackageSummary?: ReferencePackageSummary;
  userMaterials?: UserMaterial[];
  designBrief?: DesignBrief;
  confirmedAssets?: ConfirmedAssets;
  revisionHistory?: RevisionAnalysis[];
}

export interface GenerateGuidedQuestionsInput {
  idea: string;
  templateFamily: TemplateFamily;
  projectId?: string;
  model?: "deepseek-v4-flash" | "mock-designer" | "custom-provider";
  designBrief?: DesignBrief;
  referencePackageSummary?: ReferencePackageSummary;
  userMaterials?: UserMaterial[];
  previousAnswers?: UserAnswer[];
}

export interface GenerateDesignBriefInput {
  idea: string;
  templateFamily: TemplateFamily;
  model?: "deepseek-v4-flash" | "mock-designer" | "custom-provider";
  referencePackageSummary?: ReferencePackageSummary;
  userMaterials?: UserMaterial[];
}

export interface GenerateAssetCandidatesInput extends GenerateDesignBriefInput {
  designBrief?: DesignBrief;
}

export interface GenerateRevisionAnalysisInput extends GenerateDesignBriefInput {
  followup: string;
  designBrief?: DesignBrief;
  previousAnswers?: UserAnswer[];
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
  | GatewayResult<ReturnType<typeof designBriefSchema.parse>>
  | GatewayResult<ReturnType<typeof assetCandidatesSchema.parse>>
  | GatewayResult<ReturnType<typeof confirmedAssetsSchema.parse>>
  | GatewayResult<ReturnType<typeof revisionAnalysisSchema.parse>>
  | GatewayResult<ReturnType<typeof gddSchema.parse>>
  | GatewayResult<ReturnType<typeof matureGameBriefSchema.parse>>
  | GatewayResult<ReturnType<typeof gameConfigSchema.parse>>
  | GatewayResult<ReturnType<typeof gameHooksSchema.parse>>;

const generatedAssetCandidatesSchema = assetCandidatesSchema.transform(
  (value): AssetCandidates =>
    withCandidatePreviews({
      candidates: value.candidates.map((candidate) => ({
        ...candidate,
        previewUrl: candidate.previewUrl ?? "",
        fileUrl: candidate.fileUrl ?? "",
        source: candidate.source ?? "generated"
      }))
    })
);

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
    async generateDesignBrief(input: GenerateDesignBriefInput) {
      const fallback = createFallbackDesignBrief(input);
      const useRealModel = (input.model ?? "deepseek-v4-flash") === "deepseek-v4-flash";
      const provider = useRealModel ? "deepseek" : "mock";
      const model = useRealModel ? "deepseek-v4-flash" : "mock-designer";
      const task = await gateway.runModelTask({
        taskType: "llm.design_brief",
        provider,
        model,
        prompt: createPromptForTask("llm.design_brief", input as unknown as Record<string, unknown>),
        schema: designBriefSchema,
        preprocess: (raw) => normalizeDesignBrief(raw, fallback),
        fallback
      });
      return {
        designBrief: task.output,
        modelTask: task,
        fallbackUsed: task.status === "fallback"
      };
    },

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
          designBrief: input.designBrief,
          referencePackageSummary: input.referencePackageSummary,
          userMaterials: input.userMaterials,
          previousAnswers: input.previousAnswers,
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

    async generateAssetCandidates(input: GenerateAssetCandidatesInput) {
      const fallback = createFallbackAssetCandidates(input);
      const useRealModel = (input.model ?? "deepseek-v4-flash") === "deepseek-v4-flash";
      const provider = useRealModel ? "deepseek" : "mock";
      const model = useRealModel ? "deepseek-v4-flash" : "mock-designer";
      const task = await gateway.runModelTask({
        taskType: "llm.asset_prompts",
        provider,
        model,
        prompt: createPromptForTask("llm.asset_prompts", input as unknown as Record<string, unknown>),
        schema: generatedAssetCandidatesSchema,
        preprocess: (raw) => withCandidatePreviews(normalizeAssetCandidates(raw, fallback)),
        fallback
      });
      const assetCandidates = task.output;
      return {
        assetCandidates,
        confirmedAssets: confirmedAssetsSchema.parse({
          assets: assetCandidates.candidates.map((candidate) => ({
            ...candidate,
            approvalStatus: "approved" as const
          }))
        }),
        modelTask: task,
        fallbackUsed: task.status === "fallback"
      };
    },

    async generateRevisionAnalysis(input: GenerateRevisionAnalysisInput) {
      const fallback = createFallbackRevisionAnalysis(input);
      const useRealModel = (input.model ?? "deepseek-v4-flash") === "deepseek-v4-flash";
      const provider = useRealModel ? "deepseek" : "mock";
      const model = useRealModel ? "deepseek-v4-flash" : "mock-designer";
      const task = await gateway.runModelTask({
        taskType: "llm.revision_analysis",
        provider,
        model,
        prompt: createPromptForTask("llm.revision_analysis", input as unknown as Record<string, unknown>),
        schema: revisionAnalysisSchema,
        preprocess: (raw) => normalizeRevisionAnalysis(raw, fallback),
        fallback
      });
      return {
        revisionAnalysis: task.output,
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
          designBrief: input.designBrief,
          confirmedAssets: input.confirmedAssets,
          revisionHistory: input.revisionHistory,
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

      const referencePattern = getReferenceGamePattern(classificationTask.output.templateFamily);
      const fallbackMatureGameBrief = createFallbackMatureGameBrief(classificationTask.output.templateFamily);
      const matureBriefTask = await gateway.runModelTask({
        taskType: "llm.mature_game_brief",
        provider,
        model,
        prompt: createPromptForTask("llm.mature_game_brief", {
          idea: input.idea,
          answers: input.answers,
          designBrief: input.designBrief,
          confirmedAssets: input.confirmedAssets,
          revisionHistory: input.revisionHistory,
          classification: classificationTask.output,
          referencePattern,
          referencePackageSummary: input.referencePackageSummary,
          userMaterials: input.userMaterials
        }),
        schema: matureGameBriefSchema,
        preprocess: (raw) => normalizeMatureGameBrief(raw, fallbackMatureGameBrief),
        fallback: fallbackMatureGameBrief
      });
      modelTasks.push(matureBriefTask);
      trackFallback(matureBriefTask, fallbacksUsed);

      const fallbackGdd = extractArtifactContent(mockProject, "gdd.json");
      const parsedFallbackGdd = gddSchema.parse(fallbackGdd);
      const gddTask = await gateway.runModelTask({
        taskType: "llm.gdd",
        provider,
        model,
        prompt: createPromptForTask("llm.gdd", {
          idea: input.idea,
          answers: input.answers,
          designBrief: input.designBrief,
          confirmedAssets: input.confirmedAssets,
          revisionHistory: input.revisionHistory,
          classification: classificationTask.output,
          matureGameBrief: matureBriefTask.output,
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
        assets: applyConfirmedAssets(
          applyUserMaterials(generatedAssets, input.userMaterials ?? []),
          input.confirmedAssets
        )
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
          designBrief: input.designBrief,
          confirmedAssets: input.confirmedAssets,
          revisionHistory: input.revisionHistory,
          classification: classificationTask.output,
          matureGameBrief: matureBriefTask.output,
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
          designBrief: input.designBrief,
          confirmedAssets: input.confirmedAssets,
          revisionHistory: input.revisionHistory,
          classification: classificationTask.output,
          gdd: gddTask.output,
          matureGameBrief: matureBriefTask.output,
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
        matureGameBrief: matureBriefTask.output,
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
        )
        .concat(createCreativeArtifacts(input));

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

function createFallbackDesignBrief(input: GenerateDesignBriefInput): DesignBrief {
  const reference = input.referencePackageSummary
    ? [`参考 ${input.referencePackageSummary.packageName} 的玩法节奏和素材风格。`]
    : ["没有上传参考包，按用户创意建立第一版玩法。"];
  return {
    coreGameplay:
      input.templateFamily === "platformer"
        ? "平台跳跃、收集和躲避构成第一版核心循环。"
        : "俯视角移动、躲避危险和收集目标构成第一版核心循环。",
    playerGoal: "完成收集目标并避免失败条件。",
    referenceTakeaways: reference,
    risks: ["第一阶段只生成配置驱动的 2D Phaser 小游戏，不生成引擎生命周期代码。"],
    questionFocus: ["玩法目标", "角色和障碍", "视觉风格", "音效氛围", "关卡节奏"],
    developerPrompt: `Use the ${input.templateFamily} template to create a first playable game from: ${input.idea}`
  };
}

function normalizeDesignBrief(raw: unknown, fallback: DesignBrief): DesignBrief {
  const value = asRecord(raw);
  return {
    coreGameplay: normalizeString(value.coreGameplay, fallback.coreGameplay),
    playerGoal: normalizeString(value.playerGoal, fallback.playerGoal),
    referenceTakeaways: normalizeStringArray(value.referenceTakeaways, fallback.referenceTakeaways),
    risks: normalizeStringArray(value.risks, fallback.risks),
    questionFocus: normalizeStringArray(value.questionFocus, fallback.questionFocus),
    developerPrompt: normalizeString(value.developerPrompt, fallback.developerPrompt)
  };
}

function createFallbackMatureGameBrief(templateFamily: TemplateFamily): MatureGameBrief {
  return createMatureGameBrief(templateFamily);
}

function normalizeMatureGameBrief(raw: unknown, fallback: MatureGameBrief): MatureGameBrief {
  const value = asRecord(raw);
  return {
    referencePatternId: normalizeString(value.referencePatternId, fallback.referencePatternId),
    coreLoop: normalizeStringArray(value.coreLoop, fallback.coreLoop),
    firstThirtySeconds: normalizeStringArray(value.firstThirtySeconds, fallback.firstThirtySeconds),
    visualTheme: normalizeString(value.visualTheme, fallback.visualTheme),
    feedbackChecklist: normalizeStringArray(value.feedbackChecklist, fallback.feedbackChecklist),
    difficultyCurve: normalizeStringArray(value.difficultyCurve, fallback.difficultyCurve),
    gameFeelMoments: normalizeStringArray(value.gameFeelMoments, fallback.gameFeelMoments)
  };
}

function createFallbackAssetCandidates(input: GenerateAssetCandidatesInput): AssetCandidates {
  const brief = input.designBrief ?? createFallbackDesignBrief(input);
  const commonStyle = brief.developerPrompt.includes("cat") || input.idea.includes("猫") ? "cute sci-fi" : "arcade sci-fi";
  return withCandidatePreviews({
    candidates: [
      createCandidate("background", "world.background", "image", "背景", `${brief.developerPrompt}; background environment`, commonStyle, "游戏背景", ["image/*"]),
      createCandidate("player", "player.ship", "image", "主角", `${brief.developerPrompt}; player character sprite`, commonStyle, "玩家角色", ["image/*"]),
      createCandidate("hazard", "hazard.asteroid", "image", "危险物", `${brief.developerPrompt}; hazard obstacle sprite`, commonStyle, "失败危险物", ["image/*"]),
      createCandidate("collectible", "item.collectible", "image", "收集物", `${brief.developerPrompt}; collectible reward item`, commonStyle, "得分道具", ["image/*"]),
      createCandidate("bgm", "bgm.loop", "bgm", "BGM", `${brief.developerPrompt}; looping background music`, "synth arcade", "背景音乐", ["audio/*"]),
      createCandidate("sfx", "sfx.collect", "sfx", "收集音效", `${brief.developerPrompt}; collect sound effect`, "bright chime", "收集反馈", ["audio/*"])
    ]
  });
}

function createCandidate(
  slot: AssetCandidate["slot"],
  assetKey: string,
  type: AssetCandidate["type"],
  label: string,
  prompt: string,
  style: string,
  purpose: string,
  acceptedFileTypes: string[]
): AssetCandidate {
  return {
    slot,
    assetKey,
    type,
    label,
    prompt,
    style,
    purpose,
    acceptedFileTypes,
    previewUrl: "",
    fileUrl: "",
    source: "generated"
  };
}

function normalizeAssetCandidates(raw: unknown, fallback: AssetCandidates): AssetCandidates {
  const value = asRecord(raw);
  const rawCandidates = Array.isArray(value.candidates) ? value.candidates : [];
  const candidates = rawCandidates
    .map((item, index) => normalizeAssetCandidate(item, fallback.candidates[index]))
    .filter((item): item is AssetCandidate => Boolean(item));
  return { candidates: candidates.length > 0 ? candidates : fallback.candidates };
}

function normalizeAssetCandidate(raw: unknown, fallback?: AssetCandidate): AssetCandidate | null {
  const value = asRecord(raw);
  const slot = normalizeEnum(value.slot, fallback?.slot ?? "player", [
    "player",
    "background",
    "hazard",
    "collectible",
    "cover",
    "bgm",
    "sfx"
  ]);
  const type = normalizeEnum(value.type, fallback?.type ?? (slot === "bgm" ? "bgm" : slot === "sfx" ? "sfx" : "image"), [
    "image",
    "sfx",
    "bgm",
    "effect",
    "ui",
    "build"
  ]);
  const assetKey = normalizeString(value.assetKey, fallback?.assetKey ?? assetKeyForSlot(slot));
  const label = normalizeString(value.label, fallback?.label ?? slot);
  const prompt = normalizeString(value.prompt, fallback?.prompt ?? label);
  if (!assetKey || !prompt) return null;
  return {
    slot,
    assetKey,
    type,
    label,
    prompt,
    style: normalizeString(value.style, fallback?.style ?? "arcade"),
    purpose: normalizeString(value.purpose, fallback?.purpose ?? label),
    acceptedFileTypes: normalizeStringArray(value.acceptedFileTypes, fallback?.acceptedFileTypes ?? acceptedTypesFor(type)),
    previewUrl: normalizeString(value.previewUrl, fallback?.previewUrl ?? ""),
    fileUrl: normalizeString(value.fileUrl, fallback?.fileUrl ?? ""),
    source: normalizeEnum(value.source, fallback?.source ?? "generated", ["mock", "preset", "uploaded", "generated", "library"])
  };
}

function withCandidatePreviews(assetCandidates: AssetCandidates): AssetCandidates {
  return {
    candidates: assetCandidates.candidates.map((candidate) => {
      const previewUrl = candidate.previewUrl || createCandidatePreviewUrl(candidate);
      return {
        ...candidate,
        previewUrl,
        fileUrl: candidate.fileUrl || previewUrl,
        source: candidate.source || "generated",
        approvalStatus: candidate.approvalStatus ?? "pending"
      };
    })
  };
}

function createCandidatePreviewUrl(candidate: AssetCandidate): string {
  if (candidate.type === "sfx" || candidate.type === "bgm") {
    return `data:application/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify({ kind: candidate.type, assetKey: candidate.assetKey, prompt: candidate.prompt })
    )}`;
  }
  const color = candidate.slot === "hazard" ? "#fb7185" : candidate.slot === "collectible" ? "#facc15" : "#22d3ee";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100" viewBox="0 0 160 100"><rect width="160" height="100" rx="12" fill="#101828"/><circle cx="80" cy="45" r="24" fill="${color}"/><text x="80" y="86" text-anchor="middle" font-family="Arial" font-size="12" fill="#fff">${escapeXml(candidate.label)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (char) => {
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === "&") return "&amp;";
    if (char === "'") return "&apos;";
    return "&quot;";
  });
}

function createFallbackRevisionAnalysis(input: GenerateRevisionAnalysisInput): RevisionAnalysis {
  return {
    understoodChange: `理解追加需求：${input.followup}`,
    updatedDeveloperPrompt: `${input.designBrief?.developerPrompt ?? input.idea}\nRevision: ${input.followup}`,
    confirmationQuestions: [
      {
        id: "revision_confirm",
        label: "修改确认",
        prompt: "这个追加需求是否直接应用到下一版游戏？",
        inputType: "single_choice",
        options: ["直接应用", "再细化一下"],
        defaultAnswer: "直接应用",
        required: true
      }
    ],
    affectedAssets: [],
    risks: []
  };
}

function normalizeRevisionAnalysis(raw: unknown, fallback: RevisionAnalysis): RevisionAnalysis {
  const value = asRecord(raw);
  const rawQuestions = Array.isArray(value.confirmationQuestions) ? value.confirmationQuestions : [];
  return {
    understoodChange: normalizeString(value.understoodChange, fallback.understoodChange),
    updatedDeveloperPrompt: normalizeString(value.updatedDeveloperPrompt, fallback.updatedDeveloperPrompt),
    confirmationQuestions: rawQuestions
      .map((item, index) => normalizeDesignQuestion(item, fallback.confirmationQuestions[index], index))
      .filter((item): item is DesignQuestion => Boolean(item)),
    affectedAssets: normalizeStringArray(value.affectedAssets, fallback.affectedAssets),
    risks: normalizeStringArray(value.risks, fallback.risks)
  };
}

function assetKeyForSlot(slot: AssetCandidate["slot"]): string {
  if (slot === "background") return "world.background";
  if (slot === "hazard") return "hazard.asteroid";
  if (slot === "collectible") return "item.collectible";
  if (slot === "bgm") return "bgm.loop";
  if (slot === "sfx") return "sfx.collect";
  if (slot === "cover") return "cover.main";
  return "player.ship";
}

function acceptedTypesFor(type: AssetCandidate["type"]): string[] {
  if (type === "sfx" || type === "bgm") return ["audio/*"];
  if (type === "effect") return ["application/json"];
  return ["image/*"];
}

function createCreativeArtifacts(input: GeneratePlayableInput) {
  const artifacts = [];
  if (input.designBrief) {
    artifacts.push(
      {
        stage: "design-brief" as const,
        fileName: "design-brief.json",
        title: "Design Brief",
        content: input.designBrief,
        format: "json" as const
      },
      {
        stage: "design-brief" as const,
        fileName: "developer-prompt.md",
        title: "Developer Prompt",
        content: input.designBrief.developerPrompt,
        format: "md" as const
      }
    );
  }
  if (input.confirmedAssets) {
    artifacts.push({
      stage: "confirmed-assets" as const,
      fileName: "confirmed-assets.json",
      title: "Confirmed Assets",
      content: input.confirmedAssets,
      format: "json" as const
    });
  }
  if (input.revisionHistory && input.revisionHistory.length > 0) {
    artifacts.push({
      stage: "iteration-report" as const,
      fileName: "revision-analysis.json",
      title: "Revision Analysis",
      content: input.revisionHistory,
      format: "json" as const
    });
  }
  return artifacts;
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
  return createGameHooks(config);
}

function normalizeGameHooks(raw: unknown, fallback: GameHooks): GameHooks {
  const value = asRecord(raw);
  const enemyRules = asRecord(value.enemyRules);
  const collectibleRules = asRecord(value.collectibleRules);
  const winCondition = asRecord(value.winCondition);
  const failCondition = asRecord(value.failCondition);
  const numberTuning = asRecord(value.numberTuning);
  const levelLayout = asRecord(value.levelLayout);
  const levelFlow = asRecord(value.levelFlow);
  const collisionRules = asRecord(value.collisionRules);
  const feedbackRules = asRecord(value.feedbackRules);
  const spawnRules = asRecord(value.spawnRules);
  const visualLayerRules = asRecord(value.visualLayerRules);
  const difficultyRules = asRecord(value.difficultyRules);
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
    },
    levelFlow: {
      spawnPoint: normalizePoint(levelFlow.spawnPoint, fallback.levelFlow?.spawnPoint ?? { x: 120, y: 300 }),
      safeZones: normalizeRectArray(levelFlow.safeZones, fallback.levelFlow?.safeZones ?? []),
      finishZone: levelFlow.finishZone
        ? normalizeRect(levelFlow.finishZone, fallback.levelFlow?.finishZone ?? { x: 820, y: 430, width: 64, height: 110 })
        : fallback.levelFlow?.finishZone,
      cameraIntent: normalizeString(levelFlow.cameraIntent, fallback.levelFlow?.cameraIntent ?? "keep gameplay readable"),
      tutorialBeats: normalizeStringArray(levelFlow.tutorialBeats, fallback.levelFlow?.tutorialBeats ?? [])
    },
    collisionRules: {
      collisionRadius: clampNumber(
        normalizeNumber(collisionRules.collisionRadius, fallback.collisionRules?.collisionRadius ?? 12),
        1,
        96
      ),
      invulnerabilityMs: clampNumber(
        normalizeNumber(collisionRules.invulnerabilityMs, fallback.collisionRules?.invulnerabilityMs ?? 520),
        0,
        3000
      ),
      knockbackForce: clampNumber(
        normalizeNumber(collisionRules.knockbackForce, fallback.collisionRules?.knockbackForce ?? 160),
        0,
        800
      )
    },
    feedbackRules: {
      particleCount: clampNumber(
        normalizeNumber(feedbackRules.particleCount, fallback.feedbackRules?.particleCount ?? 18),
        1,
        48
      ),
      screenShakeIntensity: clampNumber(
        normalizeNumber(feedbackRules.screenShakeIntensity, fallback.feedbackRules?.screenShakeIntensity ?? 0.012),
        0,
        0.06
      ),
      collectBurstCount: clampNumber(
        normalizeNumber(feedbackRules.collectBurstCount, fallback.feedbackRules?.collectBurstCount ?? 12),
        1,
        36
      ),
      floatingScore:
        typeof feedbackRules.floatingScore === "boolean"
          ? feedbackRules.floatingScore
          : fallback.feedbackRules?.floatingScore,
      comboText:
        typeof feedbackRules.comboText === "boolean"
          ? feedbackRules.comboText
          : fallback.feedbackRules?.comboText,
      audioCueKeys: normalizeStringArray(feedbackRules.audioCueKeys, fallback.feedbackRules?.audioCueKeys ?? [])
    },
    spawnRules: {
      hazardIntervalMs: clampNumber(
        normalizeNumber(spawnRules.hazardIntervalMs, fallback.spawnRules?.hazardIntervalMs ?? 1100),
        100,
        6000
      ),
      maxActiveHazards: clampNumber(
        normalizeNumber(spawnRules.maxActiveHazards, fallback.spawnRules?.maxActiveHazards ?? 6),
        1,
        24
      )
    },
    visualLayerRules: {
      backgroundTreatment: normalizeString(
        visualLayerRules.backgroundTreatment,
        fallback.visualLayerRules?.backgroundTreatment ?? "parallax depth"
      ),
      foregroundProps: normalizeStringArray(visualLayerRules.foregroundProps, fallback.visualLayerRules?.foregroundProps ?? []),
      uiBadgeStyle: normalizeString(visualLayerRules.uiBadgeStyle, fallback.visualLayerRules?.uiBadgeStyle ?? "readable HUD")
    },
    difficultyRules: {
      hazardRamp: normalizeString(difficultyRules.hazardRamp, fallback.difficultyRules?.hazardRamp ?? "gentle ramp"),
      enemyPacing: normalizeString(difficultyRules.enemyPacing, fallback.difficultyRules?.enemyPacing ?? "readable pressure"),
      collectibleSpacing: normalizeString(
        difficultyRules.collectibleSpacing,
        fallback.difficultyRules?.collectibleSpacing ?? "guided reward path"
      ),
      checkpointPolicy: normalizeString(difficultyRules.checkpointPolicy, fallback.difficultyRules?.checkpointPolicy ?? "short retry")
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

function normalizeRect(
  value: unknown,
  fallback: { x: number; y: number; width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const record = asRecord(value);
  return {
    x: normalizeNumber(record.x, fallback.x),
    y: normalizeNumber(record.y, fallback.y),
    width: normalizeNumber(record.width, fallback.width),
    height: normalizeNumber(record.height, fallback.height)
  };
}

function normalizePoint(value: unknown, fallback: { x: number; y: number }): { x: number; y: number } {
  const record = asRecord(value);
  return {
    x: normalizeNumber(record.x, fallback.x),
    y: normalizeNumber(record.y, fallback.y)
  };
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

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

function applyUserMaterials(
  assets: AssetPack["assets"],
  userMaterials: UserMaterial[]
): AssetPack["assets"] {
  if (userMaterials.length === 0) return assets;
  const availableKeys = new Set(assets.map((asset) => asset.assetKey));
  const materialByKey = new Map(
    userMaterials
      .map((material) => [resolveUserMaterialAssetKey(material, availableKeys), material] as const)
      .filter(([assetKey]) => Boolean(assetKey))
  );
  return assets.map((asset) => {
    const material = materialByKey.get(asset.assetKey);
    if (!material || !isCompatibleUserMaterial(asset.type, material.mimeType)) return asset;
    const fileUrl = material.fileUrl.trim();
    const previewUrl = (material.previewUrl ?? material.fileUrl).trim();
    if (!fileUrl) return asset;
    return {
      ...asset,
      status: "uploaded",
      source: "uploaded",
      generationMode: "uploaded",
      copyrightStatus: "user_provided",
      fileUrl,
      previewUrl: previewUrl || fileUrl,
      provider: "uploaded",
      model: "user-upload",
      generationParams: {
        ...asset.generationParams,
        fileName: material.fileName,
        mimeType: material.mimeType,
        slot: material.slot ?? ""
      },
      approvalStatus: "approved"
    };
  });
}

function applyConfirmedAssets(
  assets: AssetPack["assets"],
  confirmedAssets?: ConfirmedAssets
): AssetPack["assets"] {
  if (!confirmedAssets || confirmedAssets.assets.length === 0) return assets;
  const availableKeys = new Set(assets.map((asset) => asset.assetKey));
  const candidateByKey = new Map(
    confirmedAssets.assets
      .map((candidate) => [resolveConfirmedAssetKey(candidate, availableKeys), candidate] as const)
      .filter(([assetKey]) => Boolean(assetKey))
  );
  return assets.map((asset) => {
    const candidate = candidateByKey.get(asset.assetKey);
    if (!candidate) return asset;
    return {
      ...asset,
      prompt: candidate.prompt || asset.prompt,
      style: candidate.style || asset.style,
      purpose: candidate.purpose || asset.purpose,
      status: candidate.source === "uploaded" ? "uploaded" : "generated",
      source: candidate.source,
      generationMode: candidate.source === "uploaded" ? "uploaded" : "model",
      copyrightStatus: candidate.source === "uploaded" ? "user_provided" : "generated",
      fileUrl: candidate.fileUrl || asset.fileUrl,
      previewUrl: candidate.previewUrl || asset.previewUrl,
      provider: candidate.source === "uploaded" ? "uploaded" : "confirmed-candidate",
      model: "asset-candidates-v1",
      generationParams: {
        ...asset.generationParams,
        slot: candidate.slot,
        candidateLabel: candidate.label
      },
      approvalStatus: "approved"
    };
  });
}

function resolveConfirmedAssetKey(candidate: AssetCandidate, availableKeys: Set<string>): string {
  if (availableKeys.has(candidate.assetKey)) return candidate.assetKey;
  const fallbackKeys: Record<AssetCandidate["slot"], string[]> = {
    player: ["player.hero", "player.ship", "player.cursor", "player.tower", "player.panel"],
    background: ["world.background", "cover.main", "world.tiles", "world.path"],
    hazard: ["hazard.enemy", "hazard.spike", "hazard.block", "hazard.timer", "hazard.asteroid"],
    collectible: ["item.collectible"],
    cover: ["cover.main", "world.background"],
    bgm: ["bgm.loop"],
    sfx: ["sfx.collect", "sfx.hit", "sfx.win", "sfx.lose"]
  };
  return fallbackKeys[candidate.slot].find((assetKey) => availableKeys.has(assetKey)) ?? candidate.assetKey;
}

function resolveUserMaterialAssetKey(material: UserMaterial, availableKeys: Set<string>): string {
  if (availableKeys.has(material.assetKey)) return material.assetKey;
  const slot = material.slot ?? inferUserMaterialSlot(material.assetKey);
  const fallbackKeys: Record<NonNullable<UserMaterial["slot"]>, string[]> = {
    player: ["player.hero", "player.ship", "player.cursor", "player.tower", "player.panel"],
    background: ["world.background", "cover.main", "world.tiles", "world.path"],
    hazard: ["hazard.enemy", "hazard.spike", "hazard.block", "hazard.timer"],
    collectible: ["item.collectible"],
    cover: ["cover.main", "world.background"],
    bgm: ["bgm.loop"],
    sfx: ["sfx.collect", "sfx.hit", "sfx.win", "sfx.lose"]
  };
  return fallbackKeys[slot].find((assetKey) => availableKeys.has(assetKey)) ?? material.assetKey;
}

function inferUserMaterialSlot(assetKey: string): NonNullable<UserMaterial["slot"]> {
  if (assetKey.startsWith("player.")) return "player";
  if (assetKey.startsWith("hazard.")) return "hazard";
  if (assetKey.startsWith("item.")) return "collectible";
  if (assetKey === "cover.main") return "cover";
  return "background";
}

function isCompatibleUserMaterial(assetType: AssetPack["assets"][number]["type"], mimeType: string): boolean {
  if (assetType === "image" || assetType === "ui") return mimeType.startsWith("image/");
  if (assetType === "sfx" || assetType === "bgm") return mimeType.startsWith("audio/");
  if (assetType === "effect") return mimeType.startsWith("image/") || mimeType === "application/json";
  return false;
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
