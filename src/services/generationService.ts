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
  gameplayDslSchema,
  gddSchema,
  guidedQuestionsSchema,
  matureGameBriefSchema,
  revisionAnalysisSchema
} from "../core/schemas";
import type {
  AssetCandidate,
  AssetCandidates,
  AssetPack,
  AssetRequirement,
  BrowserVerificationReport,
  ConfirmedAssets,
  DesignBrief,
  DesignQuestion,
  GameConfig,
  GameHooks,
  GameplayDsl,
  MatureGameBrief,
  MockProject,
  PlayableDirector,
  PlayFeedback,
  PublishRecord,
  ReferencePackageSummary,
  RuntimeAssetReport,
  RevisionAnalysis,
  TemplateFamily,
  UserMaterial,
  UserAnswer
} from "../core/types";
import type { StartModelId } from "../core/start";
import type { ModelTaskRequest } from "./backend";
import { createDeepSeekExecutor, type DeepSeekExecutorOptions } from "./deepSeekExecutor";
import { createMediaGateway, type MediaGatewayOptions } from "./mediaGateway";
import { createModelGateway, type GatewayResult } from "./modelGateway";
import { createPromptForTask } from "./promptPack";
import { createAgnesImageProvider } from "./agnesImageProvider";
import { runDynamicVerification } from "./verificationBench";
import { getReferenceGamePattern } from "./referenceGamePatterns";
import { createRuntimeAssetReport } from "../ui/previewAssets";
import {
  createVisualAssetReport,
  validateCoreAssetCandidate
} from "./visualAssetValidation";
import { compileGameplayDsl } from "./gameplayDsl";

export interface GeneratePlayableInput {
  idea: string;
  answers: UserAnswer[];
  templateFamily: TemplateFamily;
  projectId: string;
  baseUrl: string;
  model?: StartModelId;
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
  model?: StartModelId;
  designBrief?: DesignBrief;
  referencePackageSummary?: ReferencePackageSummary;
  userMaterials?: UserMaterial[];
  previousAnswers?: UserAnswer[];
}

export interface GenerateDesignBriefInput {
  idea: string;
  templateFamily: TemplateFamily;
  model?: StartModelId;
  referencePackageSummary?: ReferencePackageSummary;
  userMaterials?: UserMaterial[];
}

export interface GenerateAssetCandidatesInput extends GenerateDesignBriefInput {
  designBrief?: DesignBrief;
  answers?: UserAnswer[];
}

export interface RegenerateAssetCandidateInput {
  idea: string;
  templateFamily: TemplateFamily;
  candidate: AssetCandidate;
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
  runtimeEnv?: Record<string, string | undefined>;
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
  | GatewayResult<ReturnType<typeof gameHooksSchema.parse>>
  | GatewayResult<ReturnType<typeof gameplayDslSchema.parse>>;

const generatedAssetCandidatesSchema = assetCandidatesSchema.transform(
  (value): AssetCandidates =>
    withCandidatePreviews({
      candidates: value.candidates.map((candidate) => ({
        ...candidate,
        previewUrl: candidate.previewUrl ?? "",
        fileUrl: candidate.fileUrl ?? "",
        source: candidate.source ?? "generated",
        approvalStatus: candidate.approvalStatus ?? "pending"
      }))
    })
);

export function createGenerationService(options: GenerationServiceOptions = {}) {
  const env = options.runtimeEnv ?? readRuntimeEnv();
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
    ...createMediaGatewayOptions(env, options.fetcher),
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
      const parsedCandidates = normalizeCoreImageCandidates(generatedAssetCandidatesSchema.parse(task.output), fallback);
      const assetCandidates = await generateCandidateMedia(parsedCandidates, input.templateFamily, mediaGateway, input);
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

    async regenerateAssetCandidate(input: RegenerateAssetCandidateInput) {
      const assetCandidates = await generateCandidateMedia(
        { candidates: [input.candidate] },
        input.templateFamily,
        mediaGateway,
        input
      );
      return {
        assetCandidate: assetCandidates.candidates[0]
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
      const classification = lockClassificationToPlayableIntent(
        classificationTask.output,
        input.idea,
        input.templateFamily,
        fallbacksUsed
      );

      const referencePattern = getReferenceGamePattern(classification.templateFamily);
      const fallbackMatureGameBrief = createFallbackMatureGameBrief(classification.templateFamily);
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
          classification,
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
        templateFamily: classification.templateFamily,
        gdd: gddTask.output
      });
      const assetRequirements = createAssetRequirements(classification.templateFamily).map(
        (requirement) => ({
          ...requirement,
          style: `${assetStyleGuide.visualStyle}; ${requirement.style}`,
          prompt: assetStyleGuide.assetPrompts[requirement.assetKey] ?? requirement.prompt
        })
      );
      const preboundAssets = applyConfirmedAssets(
        applyUserMaterials(assetRequirements, input.userMaterials ?? []),
        input.confirmedAssets
      );
      const generatedAssets = await Promise.all(
        preboundAssets.map((requirement) => {
          if (isResolvedRuntimeAsset(requirement)) return Promise.resolve(requirement);
          if (isOptionalImageRequirement(requirement)) {
            return Promise.resolve(mediaGateway.generateProceduralAsset(input.projectId, "v1", requirement));
          }
          return mediaGateway.generateProjectAsset(input.projectId, "v1", requirement);
        })
      );
      const assetPack: AssetPack = {
        versionId: "v1",
        assets: generatedAssets
      };

      const fallbackConfig = {
        ...mockProject.gameConfig,
        templateFamily: classification.templateFamily
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
          classification,
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

      const sanitizedGameConfig = sanitizeGameConfig(
        alignGameConfigToTemplate({ ...configTask.output, templateFamily: classification.templateFamily }),
        assetPack
      );
      const gameConfig = {
        ...sanitizedGameConfig,
        title: normalizeGeneratedTitle(
          sanitizedGameConfig.title,
          input.idea,
          input.designBrief,
          configTask.status === "fallback" || model === "mock-designer"
        )
      };
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
          classification,
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

      const fallbackDsl = createFallbackGameplayDsl(gameConfig);
      const dslTask = await gateway.runModelTask({
        taskType: "llm.gameplay_dsl",
        provider,
        model,
        prompt: createPromptForTask("llm.gameplay_dsl", {
          idea: input.idea,
          answers: input.answers,
          designBrief: input.designBrief,
          revisionHistory: input.revisionHistory,
          classification,
          gdd: gddTask.output,
          matureGameBrief: matureBriefTask.output,
          gameConfig,
          gameHooks: hooksTask.output,
          assetPack,
          referencePackageSummary: input.referencePackageSummary
        }),
        schema: gameplayDslSchema,
        preprocess: (raw) => normalizeGameplayDsl(raw, fallbackDsl),
        fallback: fallbackDsl
      });
      modelTasks.push(dslTask);
      trackFallback(dslTask, fallbacksUsed);

      const gameHooks = enhanceGameHooksForTemplate(
        mergeGameplayDslIntoHooks(hooksTask.output, dslTask.output, assetPack),
        gameConfig,
        input
      );
      const runtimeAssetReport = createRuntimeAssetReport(assetPack);
      const visualAssetReport = createVisualAssetReport(assetPack);
      const playableDirector = createPlayableDirector(gameConfig, gameHooks, runtimeAssetReport);
      const verificationReport = createBrowserVerificationReport(runtimeAssetReport, playableDirector);
      const deliveryReady = verificationReport.passed && visualAssetReport.ready;
      const publishRecord = createPublishRecord(input.projectId, "v1", gameConfig.title, {
        visibility: "public",
        baseUrl: input.baseUrl,
        coverAssetKey: "cover.main"
      });
      const qaReport = runDynamicVerification({
        ...mockProject,
        id: input.projectId,
        title: gameConfig.title,
        classification,
        assetPack,
        gameConfig,
        gameHooks,
        qaReport: createQaReport(gameConfig, assetPack),
        playUrl: publishRecord.playUrl
      });
      const artifacts = createArtifacts({
        idea: input.idea,
        title: gameConfig.title,
        classification,
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
        .concat([
          {
            stage: "gameplay-dsl" as const,
            fileName: "gameplay-dsl.json",
            title: "Gameplay DSL",
            content: dslTask.output,
            format: "json" as const
          }
        ])
        .concat(createDeliveryArtifacts(playableDirector, runtimeAssetReport, visualAssetReport, verificationReport))
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
        classification,
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
        fallbacksUsed,
        playableDirector,
        runtimeAssetReport,
        verificationReport,
        deliveryReady
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
      createCandidate("background", "world.background", "image", labelForAssetSlot("background", input.idea), `${brief.developerPrompt}; ${promptForAssetSlot("background", input.idea)}`, commonStyle, "游戏背景", ["image/*"]),
      createCandidate("player", "player.ship", "image", labelForAssetSlot("player", input.idea), `${brief.developerPrompt}; ${promptForAssetSlot("player", input.idea)}`, commonStyle, "玩家角色", ["image/*"]),
      createCandidate("hazard", "hazard.enemy", "image", labelForAssetSlot("hazard", input.idea), `${brief.developerPrompt}; ${promptForAssetSlot("hazard", input.idea)}`, commonStyle, "危险物", ["image/*"]),
      createCandidate("collectible", "item.collectible", "image", labelForAssetSlot("collectible", input.idea), `${brief.developerPrompt}; ${promptForAssetSlot("collectible", input.idea)}`, commonStyle, "得分道具", ["image/*"])
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

function finalizeAssetCandidatePrompts(
  assetCandidates: AssetCandidates,
  input: Pick<GenerateAssetCandidatesInput, "idea" | "designBrief" | "answers"> | Pick<RegenerateAssetCandidateInput, "idea">
): AssetCandidates {
  return {
    candidates: assetCandidates.candidates.map((candidate) => {
      const modelPrompt = candidate.prompt;
      const finalPrompt = buildSlotSpecificImagePrompt(candidate, {
        idea: input.idea,
        designBrief: "designBrief" in input ? input.designBrief : undefined,
        answers: "answers" in input ? input.answers : undefined,
        modelPrompt
      });
      return {
        ...candidate,
        prompt: finalPrompt,
        generationParams: {
          ...(candidate.generationParams ?? {}),
          modelPrompt,
          finalPrompt
        }
      };
    })
  };
}

function buildSlotSpecificImagePrompt(
  candidate: AssetCandidate,
  input: {
    idea: string;
    designBrief?: DesignBrief;
    answers?: UserAnswer[];
    modelPrompt?: string;
  }
): string {
  const slotInstruction = promptForAssetSlot(candidate.slot, input.idea);
  const answerSummary = (input.answers ?? [])
    .map((answer) => answer.value.trim())
    .filter(Boolean)
    .join("；");
  const modelPrompt =
    input.modelPrompt && !shouldReplaceGenericAssetText(input.modelPrompt, candidate.slot)
      ? `模型原始素材建议：${input.modelPrompt}`
      : "";
  return [
    `WOW Game 核心图片素材：${labelForAssetSlot(candidate.slot, input.idea)}`,
    `slot: ${candidate.slot}`,
    `assetKey: ${assetKeyForSlot(candidate.slot)}`,
    `玩家创意：${input.idea}`,
    input.designBrief?.developerPrompt ? `设计理解：${input.designBrief.developerPrompt}` : "",
    answerSummary ? `玩家补充答案：${answerSummary}` : "",
    modelPrompt,
    slotInstruction,
    candidate.slot === "background"
      ? "输出要求：16:9 游戏场景背景，不要主角、敌人、UI、文字，不要测试网格或纯色块。"
      : "输出要求：独立居中的游戏精灵，纯绿幕背景便于抠图，不要文字、UI、测试网格、方块占位图。"
  ]
    .filter(Boolean)
    .join("。");
}

function labelForAssetSlot(slot: AssetCandidate["slot"], idea: string): string {
  if (slot === "background") return includesAny(idea, ["太空", "星", "飞船", "陨石"]) ? "太空背景" : "游戏背景";
  if (slot === "player") {
    if (idea.includes("太空猫")) return "太空猫飞船";
    if (idea.includes("猫")) return "猫咪主角";
    if (includesAny(idea, ["飞船", "飞机", "战机"])) return "玩家飞船";
    return "玩家角色";
  }
  if (slot === "hazard") {
    if (idea.includes("陨石")) return "陨石危险物";
    if (idea.includes("敌")) return "敌人危险物";
    return "危险物";
  }
  if (slot === "collectible") {
    if (idea.includes("鱼干")) return "鱼干收集物";
    if (idea.includes("星星")) return "星星收集物";
    if (idea.includes("金币")) return "金币收集物";
    return "收集物";
  }
  return "素材";
}

function promptForAssetSlot(slot: AssetCandidate["slot"], idea: string): string {
  const concept = idea.trim() || "WOW Game 2D demo";
  if (slot === "background") {
    return `根据玩家创意「${concept}」生成游戏背景：16:9 宽幅场景图，突出世界观和空间层次，不包含主角、敌人、UI、文字`;
  }
  if (slot === "player") {
    return `根据玩家创意「${concept}」生成玩家主角精灵：主体清晰居中，和危险物/收集物明显不同，适合 2D 游戏操作`;
  }
  if (slot === "hazard") {
    return `根据玩家创意「${concept}」生成危险物或敌人精灵：必须表现威胁感，形状和颜色区别于主角与收集物`;
  }
  if (slot === "collectible") {
    return `根据玩家创意「${concept}」生成收集物精灵：必须表现奖励感，小尺寸也能辨认，区别于危险物`;
  }
  return `根据玩家创意「${concept}」生成游戏素材`;
}

function shouldReplaceGenericAssetText(text: string | undefined, slot: AssetCandidate["slot"]): boolean {
  const value = (text ?? "").trim();
  if (!value) return true;
  const lower = value.toLowerCase();
  const genericFragments = [
    "sky background",
    "player character",
    "spike hazard",
    "coin collectible",
    "small blue square",
    "simple sky",
    "triangular spike",
    "platformer game",
    "background",
    "player",
    "hazard",
    "collectible"
  ];
  if (genericFragments.some((fragment) => lower === fragment || lower.includes(fragment))) return true;
  if (slot === "hazard" && lower.includes("spike")) return true;
  return false;
}

function includesAny(text: string, tokens: string[]): boolean {
  return tokens.some((token) => text.includes(token));
}

function normalizeAssetCandidates(raw: unknown, fallback: AssetCandidates): AssetCandidates {
  const value = asRecord(raw);
  const rawCandidates = Array.isArray(value.candidates) ? value.candidates : [];
  const candidates = rawCandidates
    .map((item, index) => normalizeAssetCandidate(item, fallback.candidates[index]))
    .filter((item): item is AssetCandidate => Boolean(item));
  return normalizeCoreImageCandidates(candidates.length > 0 ? candidates : fallback.candidates, fallback);
}

function normalizeCoreImageCandidates(input: AssetCandidate[] | AssetCandidates, fallback: AssetCandidates): AssetCandidates {
  const candidates = Array.isArray(input) ? input : input.candidates;
  const requiredSlots: Array<AssetCandidate["slot"]> = ["background", "player", "hazard", "collectible"];
  const bySlot = new Map<AssetCandidate["slot"], AssetCandidate>();
  for (const candidate of candidates) {
    if (!requiredSlots.includes(candidate.slot)) continue;
    const fallbackCandidate = fallback.candidates.find((item) => item.slot === candidate.slot);
    bySlot.set(candidate.slot, {
      ...candidate,
      type: "image",
      assetKey: assetKeyForSlot(candidate.slot),
      label: shouldReplaceGenericAssetText(candidate.label, candidate.slot)
        ? fallbackCandidate?.label ?? candidate.label
        : candidate.label,
      prompt: candidate.prompt || fallbackCandidate?.prompt || candidate.label,
      purpose: shouldReplaceGenericAssetText(candidate.purpose, candidate.slot)
        ? fallbackCandidate?.purpose ?? candidate.purpose
        : candidate.purpose,
      acceptedFileTypes: ["image/*"]
    });
  }
  for (const candidate of fallback.candidates) {
    if (!requiredSlots.includes(candidate.slot) || bySlot.has(candidate.slot)) continue;
    bySlot.set(candidate.slot, {
      ...candidate,
      type: "image",
      assetKey: assetKeyForSlot(candidate.slot),
      acceptedFileTypes: ["image/*"]
    });
  }
  return {
    candidates: requiredSlots.map((slot) => bySlot.get(slot)).filter((item): item is AssetCandidate => Boolean(item))
  };
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
    source: normalizeEnum(value.source, fallback?.source ?? "generated", ["mock", "preset", "uploaded", "generated", "library"]),
    provider: normalizeString(value.provider, fallback?.provider ?? ""),
    model: normalizeString(value.model, fallback?.model ?? ""),
    generationParams: asRecord(value.generationParams ?? fallback?.generationParams),
    error: normalizeString(value.error, fallback?.error ?? "")
  };
}

async function generateCandidateMedia(
  assetCandidates: AssetCandidates,
  templateFamily: TemplateFamily,
  mediaGateway: ReturnType<typeof createMediaGateway>,
  input: Pick<GenerateAssetCandidatesInput, "idea" | "designBrief" | "answers"> | Pick<RegenerateAssetCandidateInput, "idea">
): Promise<AssetCandidates> {
  const withPreviews = withCandidatePreviews(finalizeAssetCandidatePrompts(assetCandidates, input));
  const candidates = await Promise.all(
    withPreviews.candidates.map(async (candidate) => {
      if (candidate.type !== "image" && candidate.type !== "ui") return candidate;
      const requirement = createCandidateAssetRequirement(candidate, templateFamily, input.idea);
      const generated = await mediaGateway.generateProjectAsset("asset-candidates", "draft", requirement);
      const processedUrl =
        typeof generated.generationParams?.processedLibraryUrl === "string"
          ? generated.generationParams.processedLibraryUrl
          : "";
      const candidateFileUrl = processedUrl || generated.fileUrl || candidate.fileUrl;
      return validateCoreAssetCandidate({
        ...candidate,
        previewUrl: candidateFileUrl || generated.previewUrl || candidate.previewUrl,
        fileUrl: candidateFileUrl,
        source: generated.source,
        provider: generated.provider,
        model: generated.model,
        generationParams: {
          ...(candidate.generationParams ?? {}),
          ...(generated.generationParams ?? {}),
          finalPrompt: candidate.prompt
        },
        error: generated.error,
        approvalStatus: "pending" as const
      } as AssetCandidate);
    })
  );
  return { candidates };
}

function createCandidateAssetRequirement(
  candidate: AssetCandidate,
  templateFamily: TemplateFamily,
  idea = ""
): AssetRequirement {
  const transparent = candidate.slot === "player" || candidate.slot === "hazard" || candidate.slot === "collectible";
  return {
    assetKey: candidate.assetKey,
    type: candidate.type,
    purpose: candidate.purpose,
    style: candidate.style,
    generationMode: "model",
    copyrightStatus: "generated",
    spec: [
      `${candidate.label} for ${templateFamily}`,
      idea ? `user idea: ${idea}` : "",
      transparent
        ? "solid chroma green background, isolated centered sprite, readable silhouette, no shadow, no glow, no ground, no border, no checkerboard; use chroma magenta background if the subject is green"
        : "wide 16:9 gameplay background, no foreground player, no UI text",
      `slot: ${candidate.slot}`
    ].join("; "),
    status: "missing",
    prompt: candidate.prompt,
    acceptedFileTypes: candidate.acceptedFileTypes,
    previewUrl: candidate.previewUrl,
    source: candidate.source,
    fileUrl: candidate.fileUrl,
    provider: "pending",
    model: "pending",
    generationParams: {
      slot: candidate.slot,
      templateFamily
    },
    transparentBackgroundRequired: transparent,
    targetSize: transparent ? "512x512" : "1536x864",
    approvalStatus: "pending"
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
  if (slot === "hazard") return "hazard.enemy";
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

function createDeliveryArtifacts(
  playableDirector: PlayableDirector,
  runtimeAssetReport: RuntimeAssetReport,
  visualAssetReport: ReturnType<typeof createVisualAssetReport>,
  verificationReport: BrowserVerificationReport
) {
  return [
    {
      stage: "playable-director" as const,
      fileName: "playable-director.json",
      title: "Playable Director",
      content: playableDirector,
      format: "json" as const
    },
    {
      stage: "runtime-asset-report" as const,
      fileName: "runtime-asset-report.json",
      title: "Runtime Asset Report",
      content: runtimeAssetReport,
      format: "json" as const
    },
    {
      stage: "visual-asset-report" as const,
      fileName: "visual-asset-report.json",
      title: "Visual Asset Report",
      content: visualAssetReport,
      format: "json" as const
    },
    {
      stage: "browser-verification-report" as const,
      fileName: "browser-verification-report.json",
      title: "Browser Verification Report",
      content: verificationReport,
      format: "json" as const
    },
    {
      stage: "playability-report" as const,
      fileName: "playability-report.json",
      title: "Playability Report",
      content: verificationReport,
      format: "json" as const
    }
  ];
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

function lockClassificationToPlayableIntent(
  classification: ReturnType<typeof classificationSchema.parse>,
  idea: string,
  preferredTemplate: TemplateFamily,
  fallbacksUsed: string[]
): ReturnType<typeof classificationSchema.parse> {
  const lockedTemplate = shouldForceTopDown(idea, preferredTemplate) ? "top_down" : preferredTemplate;
  if (classification.templateFamily === lockedTemplate) return classification;
  fallbacksUsed.push("template_drift_blocked");
  return {
    ...classification,
    templateFamily: lockedTemplate,
    reasons: [
      ...classification.reasons,
      `Template locked to ${lockedTemplate} by user choice and playable intent.`
    ]
  };
}

function shouldForceTopDown(idea: string, preferredTemplate: TemplateFamily): boolean {
  if (preferredTemplate !== "top_down") return false;
  const text = idea.toLowerCase();
  const hasShip = /飞船|太空|飞机|spaceship|ship|space/.test(text);
  const hasDodge = /躲避|闪避|避开|dodge|avoid/.test(text);
  const hasHazard = /陨石|障碍|危险|asteroid|meteor|hazard/.test(text);
  const hasCollect = /收集|星星|鱼干|collect|star/.test(text);
  return [hasShip, hasDodge, hasHazard, hasCollect].filter(Boolean).length >= 2;
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
  return alignGameConfigToTemplate({
    templateFamily: normalizeTemplateFamily(value.templateFamily, fallback.templateFamily),
    title: normalizeString(value.title, fallback.title),
    pitch: normalizeString(value.pitch, fallback.pitch),
    playerGoal: normalizeString(value.playerGoal, fallback.playerGoal),
    controls: normalizeStringArray(value.controls, fallback.controls),
    difficulty: normalizeDifficulty(value.difficulty, fallback.difficulty),
    referencedAssetKeys: normalizeStringArray(value.referencedAssetKeys, fallback.referencedAssetKeys),
    gameplay: normalizeGameplay(value.gameplay, fallback.gameplay),
    level: normalizeLevel(value.level, fallback.level)
  });
}

function alignGameConfigToTemplate(config: GameConfig): GameConfig {
  if (config.templateFamily === "top_down") {
    return {
      ...config,
      controls: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"],
      playerGoal:
        config.playerGoal || "Move through lanes, collect targets, dodge hazards, and use Space for a short dash.",
      gameplay: {
        ...config.gameplay,
        primaryAction: "dodge_collect",
        objectiveMode: "collect_score",
        playerAbility: "dash",
        spawnPattern: config.gameplay.spawnPattern === "grid" ? "lanes" : config.gameplay.spawnPattern
      }
    };
  }
  if (config.templateFamily === "platformer") {
    return {
      ...config,
      controls: ["ArrowLeft", "ArrowRight", "Space"],
      gameplay: {
        ...config.gameplay,
        primaryAction: "jump_reach_goal",
        objectiveMode: config.gameplay.objectiveMode === "collect_score" ? "reach_exit" : config.gameplay.objectiveMode,
        playerAbility: "jump"
      }
    };
  }
  return config;
}

function createFallbackGameHooks(config: GameConfig): GameHooks {
  return createGameHooks(config);
}

function createFallbackGameplayDsl(config: GameConfig): GameplayDsl {
  if (config.templateFamily === "platformer") {
    return {
      version: "1",
      rules: [
        { id: "teach-reward", when: "timeMs >= 3500", do: "reward_burst", count: 2, message: "奖励路径打开" },
        { id: "mid-hazard", when: "score >= 2", do: "spawn_wave", enemyType: "patroller", count: 2, message: "巡逻危险出现" },
        { id: "finale-stage", when: "timeMs >= 14000", do: "stage_change", stageId: "finale", message: "终点冲刺阶段" },
        { id: "jump-feedback", when: "score >= 1", do: "effect", effect: "collect_burst" }
      ]
    };
  }
  return {
    version: "1",
    rules: [
      { id: "opening-wave", when: "timeMs >= 4000", do: "spawn_wave", enemyType: "chaser", count: 2, message: "第一波追踪压力进入" },
      { id: "score-reward", when: "score >= 1", do: "reward_burst", count: 2, message: "奖励路线打开" },
      { id: "score-pressure", when: "score >= 2", do: "projectile_burst", enemyType: "shooter", count: 2, message: "弹幕压力增强" },
      { id: "mine-field", when: "timeMs >= 9000", do: "spawn_mine", enemyType: "mine", count: 2, message: "地雷区激活" },
      { id: "impact-feedback", when: "score >= 1", do: "effect", effect: "screen_shake" }
    ]
  };
}

function normalizeGameplayDsl(raw: unknown, fallback: GameplayDsl): GameplayDsl {
  const parsed = gameplayDslSchema.safeParse(raw);
  if (parsed.success && parsed.data.rules.length > 0) return parsed.data;
  return fallback;
}

function mergeGameplayDslIntoHooks(hooks: GameHooks, gameplayDsl: GameplayDsl, assetPack: AssetPack): GameHooks {
  const compiled = compileGameplayDsl(gameplayDsl, assetPack);
  if (!compiled.success) return hooks;
  const compiledImpactRules = compiled.hooks.impactRules;
  return {
    ...hooks,
    enemyArchetypes: mergeById(hooks.enemyArchetypes ?? [], compiled.hooks.enemyArchetypes ?? []),
    encounterTimeline: [...(hooks.encounterTimeline ?? []), ...(compiled.hooks.encounterTimeline ?? [])],
    stageGoals: mergeById(hooks.stageGoals ?? [], compiled.hooks.stageGoals ?? []),
    impactRules: compiledImpactRules
      ? {
          ...(hooks.impactRules ?? compiledImpactRules),
          ...compiledImpactRules
        }
      : hooks.impactRules
  };
}

function mergeById<T extends { id: string }>(base: T[], additions: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of base) byId.set(item.id, item);
  for (const item of additions) byId.set(item.id, item);
  return Array.from(byId.values());
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
  const normalized: GameHooks = {
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
    },
    enemyArchetypes: normalizeEnemyArchetypes(value.enemyArchetypes, fallback.enemyArchetypes ?? []),
    attackRules: normalizeAttackRules(value.attackRules, fallback.attackRules),
    stageGoals: normalizeStageGoals(value.stageGoals, fallback.stageGoals ?? []),
    impactRules: normalizeImpactRules(value.impactRules, fallback.impactRules),
    encounterTimeline: normalizeEncounterTimeline(value.encounterTimeline, fallback.encounterTimeline ?? [])
  };
  return normalized;
}

function enhanceGameHooksForTemplate(
  hooks: GameHooks,
  config: GameConfig,
  input: GeneratePlayableInput
): GameHooks {
  const designText = [
    input.idea,
    input.designBrief?.developerPrompt,
    input.designBrief?.coreGameplay,
    ...input.answers.map((answer) => answer.value)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (config.templateFamily === "top_down") {
    const wantsWaves = /wave|runner|endless|asteroid|meteor|飞船|太空|陨石|躲避|赛博|城市/.test(designText);
    const movement = wantsWaves ? "wave" : hooks.enemyRules.movement === "static" ? "chase" : hooks.enemyRules.movement;
    const base: GameHooks = {
      ...hooks,
      enemyRules: {
        ...hooks.enemyRules,
        movement,
        speed: Math.max(hooks.enemyRules.speed, wantsWaves ? 145 : 130),
        waveIntervalMs: hooks.enemyRules.waveIntervalMs > 0 ? hooks.enemyRules.waveIntervalMs : 420
      },
      collectibleRules: {
        ...hooks.collectibleRules,
        placement: hooks.collectibleRules.placement === "random" ? "grid" : hooks.collectibleRules.placement,
        value: Math.max(1, hooks.collectibleRules.value)
      },
      failCondition: {
        ...hooks.failCondition,
        mode: "hit_hazard",
        lives: Math.max(1, Math.min(hooks.failCondition.lives || 1, config.difficulty === "hard" ? 1 : 2))
      },
      numberTuning: {
        ...hooks.numberTuning,
        playerSpeed: Math.max(hooks.numberTuning.playerSpeed, 270),
        hazardSpeed: Math.max(hooks.numberTuning.hazardSpeed, wantsWaves ? 150 : 135)
      },
      levelLayout: {
        ...hooks.levelLayout,
        lanes:
          hooks.levelLayout.lanes.length > 0
            ? hooks.levelLayout.lanes
            : [
                { y: 145, speed: 135, count: 2 },
                { y: 260, speed: 155, count: 2 },
                { y: 375, speed: 145, count: 2 }
              ]
      },
      levelFlow: {
        ...(hooks.levelFlow ?? {
          spawnPoint: { x: 140, y: 270 },
          safeZones: [],
          cameraIntent: "show readable dodge lanes",
          tutorialBeats: []
        }),
        spawnPoint: hooks.levelFlow?.spawnPoint ?? { x: 140, y: 270 },
        safeZones: hooks.levelFlow?.safeZones?.length ? hooks.levelFlow.safeZones : [{ x: 140, y: 270, width: 160, height: 130 }],
        tutorialBeats: hooks.levelFlow?.tutorialBeats?.length
          ? hooks.levelFlow.tutorialBeats
          : ["safe start", "first pickup teaches route", "second lane introduces moving hazard"]
      },
      collisionRules: {
        collisionRadius: hooks.collisionRules?.collisionRadius ?? 14,
        invulnerabilityMs: Math.max(hooks.collisionRules?.invulnerabilityMs ?? 650, 650),
        knockbackForce: Math.max(hooks.collisionRules?.knockbackForce ?? 180, 180)
      },
      feedbackRules: {
        particleCount: Math.max(hooks.feedbackRules?.particleCount ?? 22, 22),
        screenShakeIntensity: Math.max(hooks.feedbackRules?.screenShakeIntensity ?? 0.018, 0.018),
        collectBurstCount: Math.max(hooks.feedbackRules?.collectBurstCount ?? 16, 16),
        floatingScore: hooks.feedbackRules?.floatingScore ?? true,
        comboText: hooks.feedbackRules?.comboText ?? true,
        audioCueKeys: hooks.feedbackRules?.audioCueKeys ?? ["sfx.collect", "sfx.hit", "sfx.win", "sfx.lose"]
      },
      spawnRules: {
        hazardIntervalMs: Math.min(hooks.spawnRules?.hazardIntervalMs ?? 820, 900),
        maxActiveHazards: Math.max(hooks.spawnRules?.maxActiveHazards ?? config.level.hazards, config.level.hazards + 2)
      }
    };
    return normalizeCommercialHooks(base, config, designText);
  }

  if (config.templateFamily === "platformer") {
    const base: GameHooks = {
      ...hooks,
      enemyRules: {
        ...hooks.enemyRules,
        movement: hooks.enemyRules.movement === "static" ? "patrol" : hooks.enemyRules.movement,
        speed: Math.max(hooks.enemyRules.speed, 110)
      },
      failCondition: {
        ...hooks.failCondition,
        mode: "hit_hazard",
        lives: Math.max(1, Math.min(hooks.failCondition.lives || 1, 2))
      },
      numberTuning: {
        ...hooks.numberTuning,
        playerSpeed: Math.max(hooks.numberTuning.playerSpeed, 220),
        jumpVelocity: Math.max(hooks.numberTuning.jumpVelocity, 460)
      },
      levelLayout: {
        ...hooks.levelLayout,
        platforms:
          hooks.levelLayout.platforms.length >= 3
            ? hooks.levelLayout.platforms
            : [
                { x: 480, y: 510, width: 920, height: 28 },
                { x: 270, y: 405, width: 180, height: 20 },
                { x: 520, y: 320, width: 190, height: 20 },
                { x: 760, y: 235, width: 160, height: 20 }
              ]
      },
      levelFlow: {
        ...(hooks.levelFlow ?? {
          spawnPoint: { x: 96, y: 430 },
          safeZones: [],
          cameraIntent: "show jump route",
          tutorialBeats: []
        }),
        spawnPoint: hooks.levelFlow?.spawnPoint ?? { x: 96, y: 430 },
        finishZone: hooks.levelFlow?.finishZone ?? { x: 830, y: 420, width: 60, height: 130 }
      }
    };
    return normalizeCommercialHooks(base, config, designText);
  }

  return normalizeCommercialHooks(hooks, config, designText);
}

function normalizeCommercialHooks(hooks: GameHooks, config: GameConfig, designText: string): GameHooks {
  const wantsExplosions = /explode|explosion|bomb|mine|blast|爆炸|炸|地雷|陨石|撞/.test(designText);
  const wantsShooting = /shoot|bullet|laser|projectile|射击|子弹|激光/.test(designText);
  const wantsChase = /chase|hunt|追|追踪|敌人|怪/.test(designText);
  const enemyArchetypes =
    hooks.enemyArchetypes && hooks.enemyArchetypes.length >= 2
      ? hooks.enemyArchetypes
      : defaultEnemyArchetypes(config, { wantsExplosions, wantsShooting, wantsChase });
  const attackRules = hooks.attackRules ?? {
    contactDamage: 1,
    dashDamage: config.templateFamily === "top_down" ? 0 : 1,
    projectileSpeed: wantsShooting ? 220 : 170,
    projectileCooldownMs: wantsShooting ? 1200 : 1800,
    explosionRadius: wantsExplosions ? 92 : 68,
    explosionDelayMs: wantsExplosions ? 520 : 700,
    warningMs: 420
  };
  const impactRules = hooks.impactRules ?? {
    hitStopMs: wantsExplosions ? 110 : 75,
    screenShakeIntensity: Math.max(hooks.feedbackRules?.screenShakeIntensity ?? 0.018, wantsExplosions ? 0.026 : 0.018),
    explosionParticles: wantsExplosions ? 34 : 22,
    knockbackForce: Math.max(hooks.collisionRules?.knockbackForce ?? 180, wantsExplosions ? 220 : 180),
    invulnerabilityMs: Math.max(hooks.collisionRules?.invulnerabilityMs ?? 650, 650),
    comboWindowMs: 1800
  };
  return {
    ...hooks,
    enemyArchetypes,
    attackRules,
    stageGoals: hooks.stageGoals?.length ? hooks.stageGoals : defaultStageGoals(config, enemyArchetypes),
    impactRules,
    encounterTimeline: hooks.encounterTimeline?.length ? hooks.encounterTimeline : defaultEncounterTimeline(config)
  };
}

function defaultEnemyArchetypes(
  config: GameConfig,
  flags: { wantsExplosions: boolean; wantsShooting: boolean; wantsChase: boolean }
): NonNullable<GameHooks["enemyArchetypes"]> {
  if (config.templateFamily === "platformer") {
    return [
      { id: "patroller_1", type: "patroller", count: 2, speed: 110, spawnAfterMs: 0, warningMs: 250 },
      {
        id: flags.wantsExplosions ? "mine_1" : "charger_1",
        type: flags.wantsExplosions ? "mine" : "charger",
        count: 2,
        speed: 135,
        spawnAfterMs: 6500,
        warningMs: 520
      }
    ];
  }
  return [
    {
      id: flags.wantsChase ? "chaser_1" : "patroller_1",
      type: flags.wantsChase ? "chaser" : "patroller",
      count: 2,
      speed: 135,
      spawnAfterMs: 0,
      laneY: 260,
      warningMs: 280
    },
    {
      id: flags.wantsShooting ? "shooter_1" : flags.wantsExplosions ? "mine_1" : "charger_1",
      type: flags.wantsShooting ? "shooter" : flags.wantsExplosions ? "mine" : "charger",
      count: 2,
      speed: flags.wantsShooting ? 95 : 155,
      spawnAfterMs: 5200,
      laneY: 150,
      warningMs: 520
    },
    { id: "orbiter_1", type: "orbiter", count: 1, speed: 120, spawnAfterMs: 10500, laneY: 375, warningMs: 300 }
  ];
}

function defaultStageGoals(
  config: GameConfig,
  enemyArchetypes: NonNullable<GameHooks["enemyArchetypes"]>
): NonNullable<GameHooks["stageGoals"]> {
  const firstEnemy = enemyArchetypes[0]?.id ?? "patroller_1";
  const secondEnemy = enemyArchetypes[1]?.id ?? firstEnemy;
  return [
    {
      id: "teach",
      label: config.templateFamily === "platformer" ? "Learn jump timing and collect the first reward" : "Learn movement, collect the first reward, and test dash",
      startsAtMs: 0,
      durationMs: 5000,
      objective: "learn_controls",
      target: 1,
      enemyMix: [firstEnemy],
      rewardPacing: "slow"
    },
    {
      id: "pressure",
      label: "Collect under enemy pressure",
      startsAtMs: 5000,
      durationMs: 10000,
      objective: "collect",
      target: Math.max(3, Math.ceil(config.level.winScore / 2)),
      enemyMix: [firstEnemy, secondEnemy],
      rewardPacing: "normal"
    },
    {
      id: "finale",
      label: "Survive the final wave and finish the goal",
      startsAtMs: 15000,
      durationMs: 12000,
      objective: "finale",
      target: config.level.winScore,
      enemyMix: enemyArchetypes.map((enemy) => enemy.id),
      rewardPacing: "burst"
    }
  ];
}

function defaultEncounterTimeline(config: GameConfig): NonNullable<GameHooks["encounterTimeline"]> {
  return [
    { atMs: 4800, trigger: "time", event: "spawn_wave", intensity: 2, message: "Hazard pattern is changing" },
    { atMs: 9000, trigger: "score", event: "reward_burst", intensity: 2, message: "Reward route opened" },
    {
      atMs: 14500,
      trigger: "time",
      event: config.templateFamily === "platformer" ? "spawn_mine" : "projectile_burst",
      intensity: 3,
      message: "Final pressure incoming"
    }
  ];
}

function normalizeEnemyArchetypes(value: unknown, fallback: NonNullable<GameHooks["enemyArchetypes"]>) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .filter((item) => typeof item === "object" && item !== null)
    .map((item, index) => {
      const record = asRecord(item);
      return {
        id: normalizeSlug(record.id, `enemy_${index + 1}`),
        type: normalizeEnum(record.type, "chaser" as const, [
          "chaser",
          "patroller",
          "charger",
          "shooter",
          "orbiter",
          "mine"
        ]),
        count: clampNumber(normalizeNumber(record.count, 1), 1, 8),
        speed: clampNumber(normalizeNumber(record.speed, 120), 20, 360),
        spawnAfterMs: clampNumber(normalizeNumber(record.spawnAfterMs, 0), 0, 120000),
        laneY: record.laneY === undefined ? undefined : clampNumber(normalizeNumber(record.laneY, 260), 60, 500),
        warningMs: record.warningMs === undefined ? undefined : clampNumber(normalizeNumber(record.warningMs, 300), 0, 3000)
      };
    });
  return items.length > 0 ? items : fallback;
}

function normalizeAttackRules(value: unknown, fallback?: GameHooks["attackRules"]): NonNullable<GameHooks["attackRules"]> | undefined {
  const record = asRecord(value);
  if (!Object.keys(record).length && !fallback) return undefined;
  return {
    contactDamage: clampNumber(normalizeNumber(record.contactDamage, fallback?.contactDamage ?? 1), 1, 3),
    dashDamage: clampNumber(normalizeNumber(record.dashDamage, fallback?.dashDamage ?? 0), 0, 3),
    projectileSpeed: clampNumber(normalizeNumber(record.projectileSpeed, fallback?.projectileSpeed ?? 180), 60, 420),
    projectileCooldownMs: clampNumber(normalizeNumber(record.projectileCooldownMs, fallback?.projectileCooldownMs ?? 1400), 250, 8000),
    explosionRadius: clampNumber(normalizeNumber(record.explosionRadius, fallback?.explosionRadius ?? 72), 28, 96),
    explosionDelayMs: clampNumber(normalizeNumber(record.explosionDelayMs, fallback?.explosionDelayMs ?? 650), 100, 3000),
    warningMs: clampNumber(normalizeNumber(record.warningMs, fallback?.warningMs ?? 420), 0, 3000)
  };
}

function normalizeStageGoals(value: unknown, fallback: NonNullable<GameHooks["stageGoals"]>) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .filter((item) => typeof item === "object" && item !== null)
    .map((item, index) => {
      const record = asRecord(item);
      return {
        id: normalizeSlug(record.id, `stage_${index + 1}`),
        label: normalizeString(record.label, index === 0 ? "Learn controls" : "Survive the pressure"),
        startsAtMs: clampNumber(normalizeNumber(record.startsAtMs, index * 7000), 0, 180000),
        durationMs: clampNumber(normalizeNumber(record.durationMs, 7000), 1000, 60000),
        objective: normalizeEnum(record.objective, "collect" as const, ["learn_controls", "collect", "survive", "finale"]),
        target: clampNumber(normalizeNumber(record.target, 1), 0, 99),
        enemyMix: normalizeStringArray(record.enemyMix, []),
        rewardPacing: normalizeEnum(record.rewardPacing, "normal" as const, ["slow", "normal", "burst"])
      };
    });
  return items.length > 0 ? items : fallback;
}

function normalizeImpactRules(value: unknown, fallback?: GameHooks["impactRules"]): NonNullable<GameHooks["impactRules"]> | undefined {
  const record = asRecord(value);
  if (!Object.keys(record).length && !fallback) return undefined;
  return {
    hitStopMs: clampNumber(normalizeNumber(record.hitStopMs, fallback?.hitStopMs ?? 80), 0, 300),
    screenShakeIntensity: clampNumber(normalizeNumber(record.screenShakeIntensity, fallback?.screenShakeIntensity ?? 0.018), 0, 0.08),
    explosionParticles: clampNumber(normalizeNumber(record.explosionParticles, fallback?.explosionParticles ?? 24), 1, 64),
    knockbackForce: clampNumber(normalizeNumber(record.knockbackForce, fallback?.knockbackForce ?? 180), 0, 800),
    invulnerabilityMs: clampNumber(normalizeNumber(record.invulnerabilityMs, fallback?.invulnerabilityMs ?? 650), 0, 3000),
    comboWindowMs: clampNumber(normalizeNumber(record.comboWindowMs, fallback?.comboWindowMs ?? 1800), 300, 6000)
  };
}

function normalizeEncounterTimeline(value: unknown, fallback: NonNullable<GameHooks["encounterTimeline"]>) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .filter((item) => typeof item === "object" && item !== null)
    .map((item) => {
      const record = asRecord(item);
      return {
        atMs: clampNumber(normalizeNumber(record.atMs, 0), 0, 180000),
        trigger: normalizeEnum(record.trigger, "time" as const, ["time", "score"]),
        event: normalizeEnum(record.event, "spawn_wave" as const, [
          "spawn_wave",
          "spawn_mine",
          "projectile_burst",
          "reward_burst",
          "finale"
        ]),
        intensity: clampNumber(normalizeNumber(record.intensity, 1), 1, 5),
        message: normalizeString(record.message, "Incoming pressure")
      };
    });
  return items.length > 0 ? items : fallback;
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

function normalizeSlug(value: unknown, fallback: string): string {
  const text = normalizeString(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return text || fallback;
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

export function createPlayableDirector(
  gameConfig: GameConfig,
  gameHooks: GameHooks,
  runtimeAssetReport: RuntimeAssetReport
): PlayableDirector {
  const coreAssets = Object.fromEntries(
    runtimeAssetReport.slots.map((slot) => [slot.slot, slot.assetKey])
  ) as PlayableDirector["coreAssets"];
  const enemyArchetypes = gameHooks.enemyArchetypes?.length
    ? gameHooks.enemyArchetypes
    : [
        { id: "chaser_pressure", type: "chaser" as const, count: 2, speed: 140, spawnAfterMs: 5000 },
        { id: "charger_warning", type: "charger" as const, count: 1, speed: 220, spawnAfterMs: 12000, warningMs: 500 }
      ];
  const stageGoals = gameHooks.stageGoals?.length
    ? gameHooks.stageGoals
    : [
        {
          id: "tutorial",
          label: "学习移动并拿到第一个奖励",
          startsAtMs: 0,
          durationMs: 5000,
          objective: "learn_controls" as const,
          target: 1,
          enemyMix: [],
          rewardPacing: "slow" as const
        },
        {
          id: "collect",
          label: "收集目标并观察危险节奏",
          startsAtMs: 5000,
          durationMs: 14000,
          objective: "collect" as const,
          target: Math.max(3, Math.min(gameConfig.level.winScore, 6)),
          enemyMix: ["chaser"],
          rewardPacing: "normal" as const
        },
        {
          id: "finale",
          label: "压力波次：完成最后收集",
          startsAtMs: 19000,
          durationMs: 20000,
          objective: "finale" as const,
          target: gameConfig.level.winScore,
          enemyMix: ["chaser", "charger"],
          rewardPacing: "burst" as const
        }
      ];
  const encounterTimeline = gameHooks.encounterTimeline?.length
    ? gameHooks.encounterTimeline
    : [
        { atMs: 5000, trigger: "time" as const, event: "spawn_wave" as const, intensity: 1, message: "第一波危险接近" },
        { atMs: 12000, trigger: "time" as const, event: "projectile_burst" as const, intensity: 2, message: "注意冲刺和爆炸预警" },
        { atMs: 22000, trigger: "time" as const, event: "finale" as const, intensity: 3, message: "最终压力波次" }
      ];
  return {
    templateFamily: gameConfig.templateFamily,
    playerGoal: gameConfig.playerGoal,
    coreAssets,
    enemyArchetypes,
    stageGoals,
    encounterTimeline,
    winCondition: gameHooks.winCondition,
    failCondition: gameHooks.failCondition,
    firstMinuteScript: [
      "0-5s: show controls and one safe collectible",
      "5-19s: spawn readable enemies and guide collection",
      "19-40s: pressure wave with collision and explosion feedback",
      "40-60s: force win or lose resolution and allow restart"
    ]
  };
}

export function createBrowserVerificationReport(
  runtimeAssetReport: RuntimeAssetReport,
  playableDirector: PlayableDirector
): BrowserVerificationReport {
  const checks = [
    {
      id: "core_images_bound",
      passed: runtimeAssetReport.ready,
      detail: runtimeAssetReport.ready ? "All core image slots are bound." : runtimeAssetReport.errors.join("; ")
    },
    {
      id: "director_has_enemies",
      passed: playableDirector.enemyArchetypes.length >= 2,
      detail: `${playableDirector.enemyArchetypes.length} enemy archetypes`
    },
    {
      id: "director_has_stages",
      passed: playableDirector.stageGoals.length >= 3,
      detail: `${playableDirector.stageGoals.length} stage goals`
    },
    {
      id: "director_has_outcomes",
      passed: Boolean(playableDirector.winCondition.target && playableDirector.failCondition.lives),
      detail: `win=${playableDirector.winCondition.mode}, fail=${playableDirector.failCondition.mode}`
    }
  ];
  return {
    passed: checks.every((check) => check.passed),
    checks
  };
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

function isResolvedRuntimeAsset(asset: AssetRequirement): boolean {
  return (
    Boolean(asset.fileUrl.trim()) &&
    asset.approvalStatus === "approved" &&
    (asset.status === "uploaded" || asset.status === "generated")
  );
}

function isOptionalImageRequirement(asset: AssetRequirement): boolean {
  if (asset.type !== "image" && asset.type !== "ui") return false;
  return !["world.background", "player.ship", "hazard.enemy", "item.collectible"].includes(asset.assetKey);
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
      provider: candidate.source === "uploaded" ? "uploaded" : candidate.provider || asset.provider || "confirmed-candidate",
      model: candidate.source === "uploaded" ? "user-upload" : candidate.model || asset.model || "asset-candidates-v1",
      generationParams: {
        ...asset.generationParams,
        ...(candidate.generationParams ?? {}),
        slot: candidate.slot,
        candidateLabel: candidate.label
      },
      approvalStatus: "approved"
    };
  });
}

function resolveConfirmedAssetKey(candidate: AssetCandidate, availableKeys: Set<string>): string {
  const fallbackKeys: Record<AssetCandidate["slot"], string[]> = {
    player: ["player.ship"],
    background: ["world.background"],
    hazard: ["hazard.enemy", "hazard.spike", "hazard.block", "hazard.timer", "hazard.asteroid"],
    collectible: ["item.collectible"],
    cover: ["cover.main", "world.background"],
    bgm: ["bgm.loop"],
    sfx: ["sfx.collect", "sfx.hit", "sfx.win", "sfx.lose"]
  };
  if (candidate.slot === "player" || candidate.slot === "background" || candidate.slot === "hazard" || candidate.slot === "collectible") {
    return fallbackKeys[candidate.slot].find((assetKey) => availableKeys.has(assetKey)) ?? candidate.assetKey;
  }
  if (availableKeys.has(candidate.assetKey)) return candidate.assetKey;
  return fallbackKeys[candidate.slot].find((assetKey) => availableKeys.has(assetKey)) ?? candidate.assetKey;
}

function resolveUserMaterialAssetKey(material: UserMaterial, availableKeys: Set<string>): string {
  const slot = material.slot ?? inferUserMaterialSlot(material.assetKey);
  const fallbackKeys: Record<NonNullable<UserMaterial["slot"]>, string[]> = {
    player: ["player.ship"],
    background: ["world.background"],
    hazard: ["hazard.enemy", "hazard.spike", "hazard.block", "hazard.timer"],
    collectible: ["item.collectible"],
    cover: ["cover.main", "world.background"],
    bgm: ["bgm.loop"],
    sfx: ["sfx.collect", "sfx.hit", "sfx.win", "sfx.lose"]
  };
  if (slot === "player" || slot === "background" || slot === "hazard" || slot === "collectible") {
    return fallbackKeys[slot].find((assetKey) => availableKeys.has(assetKey)) ?? material.assetKey;
  }
  if (availableKeys.has(material.assetKey)) return material.assetKey;
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

function normalizeGeneratedTitle(
  currentTitle: string,
  idea: string,
  designBrief: DesignBrief | undefined,
  shouldUseIdeaTitle: boolean
): string {
  const trimmed = currentTitle.trim();
  if (trimmed && !shouldUseIdeaTitle && !isGenericGeneratedTitle(trimmed, idea)) return trimmed;
  if (trimmed && !shouldUseIdeaTitle) return trimmed;
  return deriveTitleFromIdea(idea, designBrief);
}

function isGenericGeneratedTitle(title: string, idea: string): boolean {
  const genericTitles = new Set([
    "星尘航线",
    "跳动森林",
    "边境塔线",
    "晶格谜阵",
    "口袋工坊",
    "闪避迷航",
    "Star Runner",
    "Generated Game",
    "WOW Game"
  ]);
  if (genericTitles.has(title)) return true;
  if (/^(untitled|default|demo|test)/i.test(title)) return true;
  return idea.length >= 6 && title.length <= 4;
}

function deriveTitleFromIdea(idea: string, designBrief?: DesignBrief): string {
  const text = `${idea} ${designBrief?.coreGameplay ?? ""} ${designBrief?.playerGoal ?? ""}`;
  const subject = pickKeyword(text, [
    "太空猫",
    "赛博猫",
    "飞船",
    "机器人",
    "潜艇",
    "矿工",
    "魔法师",
    "猫",
    "船"
  ]);
  const target = pickKeyword(text, ["鱼干", "星星", "水晶", "金币", "钥匙", "芯片", "能量", "宝石"]);
  const danger = pickKeyword(text, ["陨石", "水雷", "尖刺", "火球", "敌人", "障碍"]);
  if (subject && target) return `${subject}${target}航线`;
  if (subject && danger) return `${subject}${danger}挑战`;
  if (subject) return `${subject}冒险`;
  if (target) return `${target}收集行动`;
  return "玩家创意挑战";
}

function pickKeyword(text: string, keywords: string[]): string {
  return keywords.find((keyword) => text.includes(keyword)) ?? "";
}

function readRuntimeEnv(): Record<string, string | undefined> {
  const maybeProcess = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  return maybeProcess.process?.env ?? {};
}

function createMediaGatewayOptionsFromEnv(env: Record<string, string | undefined>): MediaGatewayOptions {
  return createMediaGatewayOptions(env);
}

function createMediaGatewayOptions(
  env: Record<string, string | undefined>,
  fetcher?: DeepSeekExecutorOptions["fetcher"]
): MediaGatewayOptions {
  if (env.IMAGE_PROVIDER !== "agnes") return {};
  return {
    imageProvider: createAgnesImageProvider({
      apiKey: env.IMAGE_API_KEY,
      baseUrl: env.IMAGE_BASE_URL,
      endpoint: env.IMAGE_ENDPOINT,
      model: env.IMAGE_MODEL,
      authHeader: env.IMAGE_AUTH_HEADER,
      responseImagePath: env.IMAGE_RESPONSE_PATH,
      timeoutMs: parseOptionalNumber(env.IMAGE_TIMEOUT_MS),
      fetcher
    })
  };
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
