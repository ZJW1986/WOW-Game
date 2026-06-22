import type {
  AssetPack,
  AssetCandidate,
  AssetCandidates,
  ConfirmedAssets,
  ConfirmedThreeAssets,
  DesignBrief,
  ReferencePackageSummary,
  RevisionAnalysis,
  TemplateFamily,
  ThreeGameBrief,
  UploadedPackageArtifacts,
  UserAnswer,
  UserMaterial
} from "../core/types";
import type { StartModelId } from "../core/start";
import { createPublishRecord, runMockPipeline } from "../core/pipeline";
import {
  createBrowserVerificationReport,
  createGenerationService,
  createPlayableDirector,
  type GenerationServiceOptions
} from "./generationService";
import { validateCoreAssetCandidate } from "./visualAssetValidation";
import { createPlayableStore, type PlayableStoreOptions } from "./playableStore";
import {
  createFallbackEditPlan,
  parseUploadedPackage
} from "./uploadedPackageService";
import { createRuntimeAssetReport } from "../ui/previewAssets";
import { processGeneratedImageForSlot } from "./imageCutoutService";
import {
  createThreeAssetCandidates,
  generateThreeGameMvp,
  hasConfirmedThreeCoreAssets,
  normalizeThreeSceneDirector
} from "./threeGameService";
import {
  createTripoOptions,
  createTripoTextToModelTask,
  getTripoBalance,
  getTripoTask,
  pollTripoTask
} from "./tripo3dProvider";

export interface GenerationApiRequest {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

export interface GenerationApiResponse {
  status: number;
  body: Record<string, any>;
}

export interface GenerationApiOptions {
  env?: Record<string, string | undefined>;
  fetcher?: GenerationServiceOptions["fetcher"];
  storeIO?: Pick<PlayableStoreOptions, "writeText" | "readText" | "writeBytes" | "readBytes" | "ensureDir">;
}

let assetBatchSequence = 0;

function createAssetBatchId(slot?: string): string {
  assetBatchSequence += 1;
  const suffix = slot ? `-${safeAssetFileName(slot)}` : "";
  return `assets-${Date.now().toString(36)}-${assetBatchSequence.toString(36)}${suffix}`;
}

export function createGenerationApiHandler(options: GenerationApiOptions = {}) {
  return async function handleGenerationRequest(
    request: GenerationApiRequest
  ): Promise<GenerationApiResponse> {
    const env = options.env ?? readRuntimeEnv();
    const store = createPlayableStore({
      dataDir: env.DATA_DIR ?? "data",
      ...options.storeIO
    });
    const uploadFileMatch = request.path.match(/^\/api\/uploads\/([^/]+)\/([^/]+)\/files\/(.+)$/);
    if (request.method === "GET" && uploadFileMatch) {
      const bytes = await store.readUploadedPackageFile(
        uploadFileMatch[1],
        uploadFileMatch[2],
        decodeURIComponent(uploadFileMatch[3])
      );
      if (!bytes) {
        return { status: 404, body: { error: "Uploaded package file not found" } };
      }
      return {
        status: 200,
        body: {
          fileBase64: encodeBase64(bytes),
          contentType: contentTypeForPath(uploadFileMatch[3])
        }
      };
    }
    const playMatch = request.path.match(/^\/api\/play\/([^/]+)\/([^/]+)$/);
    if (request.method === "GET" && playMatch) {
      const record = await store.readPlayable(playMatch[1], playMatch[2]);
      if (!record) {
        return { status: 404, body: { error: "Playable version not found" } };
      }
      return { status: 200, body: record as unknown as Record<string, any> };
    }

    if (request.method === "GET" && request.path === "/api/tripo/balance") {
      try {
        const body = await getTripoBalance(createTripoOptions(env), createTripoFetcher(options.fetcher));
        return { status: 200, body };
      } catch (error) {
        return { status: 400, body: { error: error instanceof Error ? error.message : String(error) } };
      }
    }

    if (request.method === "POST" && request.path === "/api/tripo/text-to-model") {
      try {
        const taskId = await createTripoTextToModelTask(
          createTripoOptions(env),
          requireString(request.body.prompt, "prompt"),
          createTripoFetcher(options.fetcher)
        );
        return { status: 200, body: { taskId } };
      } catch (error) {
        return { status: 400, body: { error: error instanceof Error ? error.message : String(error) } };
      }
    }

    const tripoTaskMatch = request.path.match(/^\/api\/tripo\/tasks\/([^/]+)$/);
    if (request.method === "GET" && tripoTaskMatch) {
      try {
        const task = await getTripoTask(
          createTripoOptions(env),
          decodeURIComponent(tripoTaskMatch[1]),
          createTripoFetcher(options.fetcher)
        );
        return { status: 200, body: { task } };
      } catch (error) {
        return { status: 400, body: { error: error instanceof Error ? error.message : String(error) } };
      }
    }

    const feedbackMatch = request.path.match(/^\/api\/play\/([^/]+)\/([^/]+)\/feedback$/);
    if (request.method === "POST" && feedbackMatch) {
      try {
        const feedback = await store.addFeedback(feedbackMatch[1], feedbackMatch[2], {
          versionId: feedbackMatch[2],
          rating: requireNumber(request.body.rating, "rating"),
          comment: requireString(request.body.comment, "comment"),
          playerName: optionalString(request.body.playerName) ?? "player"
        });
        return { status: 201, body: { feedback } };
      } catch (error) {
        return {
          status: 404,
          body: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }

    if (request.method === "POST" && request.path === "/api/upload-package") {
      try {
        const packageName = requireString(request.body.packageName, "packageName");
        const packageFileName = requireString(request.body.packageFileName, "packageFileName");
        const projectId = `package-${Date.now()}`;
        const versionId = "v1";
        const parsedPackage = await parseUploadedPackage({
          packageName,
          packageFileName,
          packageBase64: requireString(request.body.packageBase64, "packageBase64"),
          projectId,
          versionId
        });
        const project = runMockPipeline(optionalString(request.body.description) ?? packageName);
        project.id = projectId;
        project.title = packageName;
        project.contentType = "uploaded_package";
        project.editable = true;
        project.shareable = true;
        project.sourceLabel = "ZIP Package";

        const publishRecord = createPublishRecord(project.id, project.version.id, project.title, {
          visibility: "public",
          baseUrl: optionalString(request.body.baseUrl) ?? env.PUBLIC_BASE_URL ?? "http://localhost:5173"
        });
        project.playUrl = publishRecord.playUrl;

        await store.saveUploadedPackageFiles(project.id, project.version.id, parsedPackage.extractedFiles);
        await store.savePlayable({
          project,
          publishRecord,
          feedback: [],
          uploadedPackage: {
            packageManifest: parsedPackage.packageManifest,
            assetIndex: parsedPackage.assetIndex,
            runtimeEntry: parsedPackage.runtimeEntry,
            healthReport: parsedPackage.healthReport,
            aiEditPlan: parsedPackage.aiEditPlan
          }
        });

        return {
          status: 201,
          body: {
            project,
            publishRecord,
            packageManifest: parsedPackage.packageManifest,
            assetIndex: parsedPackage.assetIndex,
            runtimeEntry: parsedPackage.runtimeEntry,
            healthReport: parsedPackage.healthReport,
            aiEditPlan: parsedPackage.aiEditPlan
          }
        };
      } catch (error) {
        return {
          status: 400,
          body: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }

    if (request.method === "POST" && request.path === "/api/package-edit-plan") {
      try {
        const projectId = requireString(request.body.projectId, "projectId");
        const versionId = requireString(request.body.versionId, "versionId");
        const userGoal = requireString(request.body.userGoal, "userGoal");
        const record = await store.readPlayable(projectId, versionId);
        if (!record?.uploadedPackage) {
          return { status: 404, body: { error: "Uploaded package not found" } };
        }
        const aiEditPlan = createFallbackEditPlan(
          record.project.title,
          record.uploadedPackage.assetIndex,
          record.uploadedPackage.healthReport,
          userGoal
        );
        const nextRecord = {
          ...record,
          uploadedPackage: {
            ...record.uploadedPackage,
            aiEditPlan
          }
        };
        await store.savePlayable(nextRecord);
        return {
          status: 200,
          body: {
            aiEditPlan,
            modelTask: {
              taskType: "llm.package_edit_plan",
              provider: "mock",
              model: "local-package-analyzer",
              status: "fallback"
            },
            fallbackUsed: true
          }
        };
      } catch (error) {
        return {
          status: 400,
          body: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }

    if (request.method === "POST" && request.path === "/api/replace-package-asset") {
      try {
        const projectId = requireString(request.body.projectId, "projectId");
        const versionId = requireString(request.body.versionId, "versionId");
        const assetPath = requireString(request.body.assetPath, "assetPath");
        const fileBase64 = requireString(request.body.fileBase64, "fileBase64");
        const record = await store.readPlayable(projectId, versionId);
        if (!record?.uploadedPackage) {
          return { status: 404, body: { error: "Uploaded package not found" } };
        }
        const editableAsset = [
          ...record.uploadedPackage.assetIndex.images,
          ...record.uploadedPackage.assetIndex.audio
        ].find((asset) => asset.path === assetPath);
        if (!editableAsset) {
          return { status: 400, body: { error: `Asset is not safely replaceable: ${assetPath}` } };
        }
        await store.saveUploadedPackageFiles(projectId, versionId, [
          { path: assetPath, bytes: decodeBase64(fileBase64) }
        ]);
        const aiEditPlan = createFallbackEditPlan(
          record.project.title,
          record.uploadedPackage.assetIndex,
          record.uploadedPackage.healthReport,
          `${assetPath} 已替换`
        );
        await store.savePlayable({
          ...record,
          uploadedPackage: {
            ...record.uploadedPackage,
            aiEditPlan
          }
        });
        return {
          status: 200,
          body: {
            replacedAsset: editableAsset,
            aiEditPlan,
            healthReport: record.uploadedPackage.healthReport
          }
        };
      } catch (error) {
        return {
          status: 400,
          body: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }

    if (request.method === "POST" && request.path === "/api/design-brief") {
      try {
        if (request.body.engineType === "threejs3d") {
          const idea = requireString(request.body.idea, "idea");
          const result = generateThreeGameMvp({
            idea,
            projectId: optionalString(request.body.projectId) ?? `three-brief-${Date.now()}`,
            baseUrl: optionalString(request.body.baseUrl) ?? env.PUBLIC_BASE_URL ?? "http://localhost:5173",
          viewportMode:
            request.body.viewportMode === "web_16_9" || request.body.viewportMode === "app_9_16"
              ? request.body.viewportMode
              : "app_9_16",
          gameType3d: parseThreeGameGenre(request.body.gameType3d),
          userMaterials: parseUserMaterials(request.body.userMaterials)
          });
          return {
            status: 200,
            body: {
              designBrief: {
                coreGameplay: result.threeGameBrief.coreLoop.join(" / "),
                playerGoal: result.project.gameConfig.playerGoal,
                referenceTakeaways: result.threeGameBrief.skillWorkflow,
                risks: ["3D model/audio providers may fall back to procedural assets until API keys are configured."],
                questionFocus: ["camera", "movement", "space", "hazard", "feedback", "assets"],
                developerPrompt: `${result.threeGameBrief.cameraIntent}\n${result.threeGameBrief.movementIntent}\n${result.threeGameBrief.spaceLayout}`
              },
              threeDesignBrief: result.threeGameBrief,
              modelTask: {
                taskType: "llm.three_design_brief",
                provider: "mock",
                model: "three-skill-director-fallback",
                status: "fallback"
              },
              fallbackUsed: true
            }
          };
        }
        const service = createGenerationService({
          deepseekApiKey: env.DEEPSEEK_API_KEY,
          deepseekBaseUrl: env.DEEPSEEK_BASE_URL,
          fetcher: options.fetcher,
          runtimeEnv: env
        });
        const referencePackageSummary = await readReferencePackageSummary(
          store,
          optionalString(request.body.referencePackageId),
          optionalString(request.body.referenceVersionId)
        );
        const result = await service.generateDesignBrief({
          idea: requireString(request.body.idea, "idea"),
          templateFamily: parseTemplateFamily(request.body.templateFamily),
          model: parseModel(request.body.model),
          referencePackageSummary,
          userMaterials: parseUserMaterials(request.body.userMaterials)
        });
        return { status: 200, body: result as unknown as Record<string, any> };
      } catch (error) {
        return {
          status: 400,
          body: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }

    if (request.method === "POST" && request.path === "/api/asset-candidates") {
      try {
        const service = createGenerationService({
          deepseekApiKey: env.DEEPSEEK_API_KEY,
          deepseekBaseUrl: env.DEEPSEEK_BASE_URL,
          fetcher: options.fetcher,
          runtimeEnv: env
        });
        const referencePackageSummary = await readReferencePackageSummary(
          store,
          optionalString(request.body.referencePackageId),
          optionalString(request.body.referenceVersionId)
        );
        const idea = requireString(request.body.idea, "idea");
        const result = await service.generateAssetCandidates({
          idea,
          templateFamily: parseTemplateFamily(request.body.templateFamily),
          model: parseModel(request.body.model),
          designBrief: parseOptionalDesignBrief(request.body.designBrief),
          answers: parseAnswers(request.body.answers),
          referencePackageSummary,
          userMaterials: parseUserMaterials(request.body.userMaterials)
        });
        const assetBatchId = createAssetBatchId();
        await localizeAssetCandidates(store, result.assetCandidates, idea, assetBatchId);
        result.assetCandidates = {
          candidates: result.assetCandidates.candidates.map((candidate) =>
            candidate.validationStatus === "failed" || candidate.error
              ? candidate
              : validateCoreAssetCandidate(candidate)
          )
        };
        result.confirmedAssets = {
          assets: result.assetCandidates.candidates
            .filter(isConfirmableCoreCandidate)
            .map((candidate) => ({
              ...candidate,
              approvalStatus: "approved" as const
            }))
        };
        return { status: 200, body: result as unknown as Record<string, any> };
      } catch (error) {
        return {
          status: 400,
          body: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }

    if (request.method === "POST" && request.path === "/api/regenerate-asset-candidate") {
      try {
        const service = createGenerationService({
          deepseekApiKey: env.DEEPSEEK_API_KEY,
          deepseekBaseUrl: env.DEEPSEEK_BASE_URL,
          fetcher: options.fetcher,
          runtimeEnv: env
        });
        const idea = requireString(request.body.idea, "idea");
        const candidate = parseAssetCandidateInput(request.body.candidate);
        const result = await service.regenerateAssetCandidate({
          idea,
          templateFamily: parseTemplateFamily(request.body.templateFamily),
          candidate
        });
        const assetBatchId = createAssetBatchId(candidate.slot);
        await localizeAssetCandidate(store, result.assetCandidate, idea, assetBatchId);
        result.assetCandidate =
          result.assetCandidate.validationStatus === "failed" || result.assetCandidate.error
            ? result.assetCandidate
            : validateCoreAssetCandidate(result.assetCandidate);
        return { status: 200, body: result as unknown as Record<string, any> };
      } catch (error) {
        return {
          status: 400,
          body: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }

    if (request.method === "POST" && request.path === "/api/process-uploaded-material") {
      try {
        const idea = requireString(request.body.idea, "idea");
        const slot = parseUserMaterialSlot(request.body.slot);
        const assetKey = runtimeAssetKeyForSlot(slot);
        const fileName = requireString(request.body.fileName, "fileName");
        const fileBase64 = requireString(request.body.fileBase64, "fileBase64");
        const contentType = requireString(request.body.contentType, "contentType");
        const bytes = decodeBase64(fileBase64);
        const result = await processUploadedMaterialCandidate(store, {
          idea,
          slot,
          assetKey,
          fileName,
          contentType,
          bytes,
          label: optionalString(request.body.label),
          prompt: optionalString(request.body.prompt),
          style: optionalString(request.body.style)
        });
        return { status: 200, body: { assetCandidate: result } };
      } catch (error) {
        return {
          status: 400,
          body: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }

    if (request.method === "POST" && request.path === "/api/revision-analysis") {
      try {
        const service = createGenerationService({
          deepseekApiKey: env.DEEPSEEK_API_KEY,
          deepseekBaseUrl: env.DEEPSEEK_BASE_URL,
          fetcher: options.fetcher,
          runtimeEnv: env
        });
        const referencePackageSummary = await readReferencePackageSummary(
          store,
          optionalString(request.body.referencePackageId),
          optionalString(request.body.referenceVersionId)
        );
        const result = await service.generateRevisionAnalysis({
          idea: requireString(request.body.idea, "idea"),
          followup: requireString(request.body.followup, "followup"),
          templateFamily: parseTemplateFamily(request.body.templateFamily),
          model: parseModel(request.body.model),
          designBrief: parseOptionalDesignBrief(request.body.designBrief),
          referencePackageSummary,
          userMaterials: parseUserMaterials(request.body.userMaterials),
          previousAnswers: parseAnswers(request.body.previousAnswers)
        });
        return { status: 200, body: result as unknown as Record<string, any> };
      } catch (error) {
        return {
          status: 400,
          body: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }

    if (request.method === "POST" && request.path === "/api/three-asset-candidates") {
      try {
        const idea = requireString(request.body.idea, "idea");
        const briefResult = generateThreeGameMvp({
          idea,
          projectId: optionalString(request.body.projectId) ?? `three-assets-${Date.now()}`,
          baseUrl: optionalString(request.body.baseUrl) ?? env.PUBLIC_BASE_URL ?? "http://localhost:5173",
          viewportMode:
            request.body.viewportMode === "web_16_9" || request.body.viewportMode === "app_9_16"
              ? request.body.viewportMode
              : "app_9_16",
          gameType3d: parseThreeGameGenre(request.body.gameType3d),
          answers: parseAnswers(request.body.answers),
          threeDesignBrief: parseOptionalThreeGameBrief(request.body.threeDesignBrief),
          userMaterials: parseUserMaterials(request.body.userMaterials)
        });
        const assetBatchId = createAssetBatchId("three");
        const threeAssetCandidates = createThreeAssetCandidates({
          idea,
          brief: briefResult.threeGameBrief,
          director: normalizeThreeSceneDirector(briefResult.threeSceneDirector, briefResult.threeGameBrief, parseAnswers(request.body.answers)),
          assetBatchId
        });
        const tripoOptions = createTripoOptions(env);
        const assets = await Promise.all(
          threeAssetCandidates.assets.map(async (asset) => {
            if (!tripoOptions.apiKey) {
              return {
                ...asset,
                status: "missing" as const,
                error: "TRIPO_API_KEY is not configured.",
                generationParams: { ...asset.generationParams, tripoStatus: "missing_api_key" }
              };
            }
            try {
              const taskId = await createTripoTextToModelTask(tripoOptions, asset.prompt, createTripoFetcher(options.fetcher));
              const task = await pollTripoTask(tripoOptions, taskId, createTripoFetcher(options.fetcher));
              const modelUrl = typeof task.output?.model_url === "string" ? task.output.model_url : "";
              const previewUrl =
                typeof task.output?.rendered_image_url === "string" ? task.output.rendered_image_url : asset.previewUrl;
              if (!modelUrl) {
                throw new Error(`Tripo task completed without model_url: ${taskId}`);
              }
              return {
                ...asset,
                status: "generated" as const,
                fileUrl: modelUrl,
                previewUrl,
                generationParams: { ...asset.generationParams, taskId, tripoStatus: "success", remoteModelUrl: modelUrl }
              };
            } catch (error) {
              return {
                ...asset,
                status: "failed" as const,
                error: error instanceof Error ? error.message : String(error),
                generationParams: { ...asset.generationParams, tripoStatus: "task_failed" }
              };
            }
          })
        );
        return {
          status: 200,
          body: {
            threeAssetCandidates: {
              ...threeAssetCandidates,
              assets
            },
            threeDesignBrief: briefResult.threeGameBrief,
            threeSceneDirector: briefResult.threeSceneDirector
          }
        };
      } catch (error) {
        return {
          status: 400,
          body: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }

    if (request.method === "POST" && request.path === "/api/generate-three-game") {
      try {
        const confirmedThreeAssets = parseOptionalConfirmedThreeAssets(request.body.confirmedThreeAssets);
        if (!hasConfirmedThreeCoreAssets(confirmedThreeAssets)) {
          return {
            status: 400,
            body: {
              error:
                "Missing confirmed 3D core models. Confirm three.model.player, three.model.hazard, and three.model.collectible before generating a Three.js game."
            }
          };
        }
        const result = generateThreeGameMvp({
          idea: requireString(request.body.idea, "idea"),
          projectId: optionalString(request.body.projectId) ?? `three-project-${Date.now()}`,
          baseUrl: optionalString(request.body.baseUrl) ?? env.PUBLIC_BASE_URL ?? "http://localhost:5173",
          viewportMode:
            request.body.viewportMode === "web_16_9" || request.body.viewportMode === "app_9_16"
              ? request.body.viewportMode
              : "app_9_16",
          gameType3d: parseThreeGameGenre(request.body.gameType3d),
          answers: parseAnswers(request.body.answers),
          threeDesignBrief: parseOptionalThreeGameBrief(request.body.threeDesignBrief),
          userMaterials: parseUserMaterials(request.body.userMaterials),
          confirmedThreeAssets
        });
        await store.savePlayable({
          project: result.project,
          publishRecord: result.publishRecord,
          feedback: []
        });
        return { status: 200, body: result as unknown as Record<string, any> };
      } catch (error) {
        return {
          status: 400,
          body: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }

    if (request.method === "POST" && request.path === "/api/guided-questions") {
      try {
        if (request.body.engineType === "threejs3d") {
          const { createThreeGuidedQuestions } = await import("../core/conversation");
          return {
            status: 200,
            body: {
              questions: createThreeGuidedQuestions(
                requireString(request.body.idea, "idea"),
                parseThreeGameGenre(request.body.gameType3d)
              ),
              modelTask: {
                taskType: "llm.three_guided_questions",
                provider: "mock",
                model: "three-skill-director-fallback",
                status: "fallback"
              },
              fallbackUsed: true
            }
          };
        }
        const service = createGenerationService({
          deepseekApiKey: env.DEEPSEEK_API_KEY,
          deepseekBaseUrl: env.DEEPSEEK_BASE_URL,
          fetcher: options.fetcher,
          runtimeEnv: env
        });
        const referencePackageSummary = await readReferencePackageSummary(
          store,
          optionalString(request.body.referencePackageId),
          optionalString(request.body.referenceVersionId)
        );
        const result = await service.generateGuidedQuestions({
          idea: requireString(request.body.idea, "idea"),
          templateFamily: parseTemplateFamily(request.body.templateFamily),
          projectId: optionalString(request.body.projectId),
          model: parseModel(request.body.model),
          designBrief: parseOptionalDesignBrief(request.body.designBrief),
          referencePackageSummary,
          userMaterials: parseUserMaterials(request.body.userMaterials),
          previousAnswers: parseAnswers(request.body.previousAnswers)
        });
        return { status: 200, body: result as unknown as Record<string, any> };
      } catch (error) {
        return {
          status: 400,
          body: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    }

    if (request.method !== "POST" || request.path !== "/api/generate-playable") {
      return {
        status: 404,
        body: { error: `No route for ${request.method} ${request.path}` }
      };
    }

    try {
      const confirmedAssets = parseOptionalConfirmedAssets(request.body.confirmedAssets);
      const confirmedAssetError = validateConfirmedCoreAssetInputs(confirmedAssets, request.body.allowPlaceholderAssets === true);
      if (confirmedAssetError) {
        return {
          status: 400,
          body: {
            error: confirmedAssetError
          }
        };
      }
      const service = createGenerationService({
        deepseekApiKey: env.DEEPSEEK_API_KEY,
        deepseekBaseUrl: env.DEEPSEEK_BASE_URL,
        fetcher: options.fetcher,
        runtimeEnv: env
      });
      const referencePackageId = optionalString(request.body.referencePackageId);
      const referenceVersionId = optionalString(request.body.referenceVersionId);
      const referencePackageSummary = await readReferencePackageSummary(store, referencePackageId, referenceVersionId);
      const result = await service.generatePlayableVersion({
        idea: requireString(request.body.idea, "idea"),
        answers: parseAnswers(request.body.answers),
        templateFamily: parseTemplateFamily(request.body.templateFamily),
        projectId: optionalString(request.body.projectId) ?? `project-${Date.now()}`,
        baseUrl: optionalString(request.body.baseUrl) ?? env.PUBLIC_BASE_URL ?? "http://localhost:5173",
        model: parseModel(request.body.model),
        referencePackageSummary,
        userMaterials: parseUserMaterials(request.body.userMaterials),
        designBrief: parseOptionalDesignBrief(request.body.designBrief),
        confirmedAssets,
        revisionHistory: parseRevisionHistory(request.body.revisionHistory)
      });
      if (referencePackageId && referenceVersionId && !referencePackageSummary) {
        result.fallbacksUsed.push("reference_package_missing");
      }
      const localizationError = await localizeRemoteImageAssets(store, result.project.id, result.project.version.id, result.project.assetPack);
      if (localizationError) {
        return {
          status: 400,
          body: { error: localizationError }
        };
      }
      result.runtimeAssetReport = createRuntimeAssetReport(result.project.assetPack);
      result.playableDirector = createPlayableDirector(
        result.project.gameConfig,
        result.project.gameHooks,
        result.runtimeAssetReport
      );
      result.verificationReport = createBrowserVerificationReport(result.runtimeAssetReport, result.playableDirector);
      result.deliveryReady = result.verificationReport.passed;
      syncDeliveryArtifacts(result.project, result.playableDirector, result.runtimeAssetReport, result.verificationReport);
      syncAssetPackArtifact(result.project);
      const finalAssetError = validateFinalCoreAssets(result.project.assetPack, confirmedAssets);
      if (finalAssetError) {
        return {
          status: 400,
          body: { error: finalAssetError }
        };
      }
      await store.savePlayable({
        project: result.project,
        publishRecord: result.publishRecord,
        feedback: []
      });

      return { status: 200, body: result as unknown as Record<string, any> };
    } catch (error) {
      return {
        status: 400,
        body: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  };
}

async function localizeRemoteImageAssets(
  store: ReturnType<typeof createPlayableStore>,
  projectId: string,
  versionId: string,
  assetPack: AssetPack
): Promise<string | null> {
  const errors: string[] = [];
  await Promise.all(
    assetPack.assets.map(async (asset) => {
      if ((asset.type !== "image" && asset.type !== "ui") || !/^https?:\/\//.test(asset.fileUrl)) return;
      try {
        const localized = await localizeImageUrl(store, {
          projectId,
          versionId,
          assetKey: asset.assetKey,
          slot: inferSlotFromAssetKey(asset.assetKey),
          remoteUrl: asset.fileUrl,
          prompt: asset.prompt,
          style: asset.style,
          idea: asset.purpose
        });
        asset.fileUrl = localized.localUrl;
        asset.previewUrl = localized.localUrl;
        asset.generationParams = {
          ...asset.generationParams,
          originalRemoteUrl: localized.originalRemoteUrl,
          localized: true,
          originalLibraryUrl: localized.originalLibraryUrl,
          processedLibraryUrl: localized.libraryUrl,
          cutoutApplied: localized.cutoutApplied,
          cutoutMethod: localized.cutoutMethod ?? ""
        };
        asset.error = undefined;
      } catch (error) {
        const message = `Remote image could not be localized for ${asset.assetKey}: ${error instanceof Error ? error.message : String(error)}`;
        asset.status = "failed";
        asset.error = message;
        errors.push(message);
      }
    })
  );
  return errors.length > 0 ? errors.join("; ") : null;
}

async function localizeAssetCandidates(
  store: ReturnType<typeof createPlayableStore>,
  assetCandidates: AssetCandidates,
  idea: string,
  assetBatchId: string
): Promise<void> {
  await Promise.all(
    assetCandidates.candidates.map((candidate) => localizeAssetCandidate(store, candidate, idea, assetBatchId))
  );
}

async function localizeAssetCandidate(
  store: ReturnType<typeof createPlayableStore>,
  candidate: AssetCandidate,
  idea: string,
  assetBatchId: string
): Promise<void> {
  if (
    (candidate.type !== "image" && candidate.type !== "ui") ||
    (!/^https?:\/\//.test(candidate.fileUrl) && !candidate.fileUrl.startsWith("data:image"))
  ) return;
  try {
    const localized = await localizeImageUrl(store, {
      projectId: "asset-candidates",
      versionId: assetBatchId,
      assetKey: candidate.assetKey,
      slot: candidate.slot,
      remoteUrl: candidate.fileUrl,
      prompt: candidate.prompt,
      style: candidate.style,
      idea
    });
    candidate.fileUrl = localized.localUrl;
    candidate.previewUrl = localized.localUrl;
    candidate.generationParams = {
      ...(candidate.generationParams ?? {}),
      assetBatchId,
      slotRevisionId: `${assetBatchId}-${candidate.slot}`,
      originalRemoteUrl: localized.originalRemoteUrl,
      localized: true,
      libraryFileUrl: localized.libraryUrl,
      originalLibraryUrl: localized.originalLibraryUrl,
      processedLibraryUrl: localized.libraryUrl,
      libraryKeywords: localized.keywords.join(","),
      cutoutApplied: localized.cutoutApplied,
      cutoutMethod: localized.cutoutMethod ?? "",
      chromaKeyColor: localized.chromaKeyColor ?? "",
      chromaTolerance: localized.chromaTolerance ?? 0,
      edgeResidueScore: localized.edgeResidueScore ?? 0,
      spillScore: localized.spillScore ?? 0,
      subjectCoverage: localized.subjectCoverage ?? 0
    };
    const validated = validateCoreAssetCandidate({
      ...candidate,
      fileUrl: localized.validationUrl,
      previewUrl: localized.validationUrl
    });
    const validationErrors = [
      ...(validated.validationErrors ?? []),
      ...(localized.validationErrors ?? [])
    ];
    const fatalValidationErrors = validationErrors.filter(isFatalAssetValidationError);
    candidate.slotRole = validated.slotRole;
    candidate.requiresTransparency = validated.requiresTransparency;
    candidate.subjectBounds = localized.subjectBounds ?? validated.subjectBounds;
    candidate.alphaCoverage = localized.alphaCoverage ?? validated.alphaCoverage;
    candidate.validationStatus =
      fatalValidationErrors.length > 0 ? "failed" : validationErrors.length > 0 ? "warning" : validated.validationStatus;
    candidate.validationErrors = validationErrors;
    if (candidate.validationStatus === "failed") {
      candidate.error = fatalValidationErrors.join(" ") || "Visual asset validation failed.";
      candidate.approvalStatus = "rejected";
      return;
    }
    candidate.error = undefined;
  } catch (error) {
    candidate.fileUrl = "";
    candidate.previewUrl = "";
    candidate.error = `Remote image could not be localized: ${error instanceof Error ? error.message : String(error)}`;
    candidate.approvalStatus = "rejected";
  }
}

function isFatalAssetValidationError(error: string): boolean {
  return !/edge residue|touches the image edge/i.test(error);
}

async function localizeImageUrl(
  store: ReturnType<typeof createPlayableStore>,
  input: {
    projectId: string;
    versionId: string;
    assetKey: string;
    slot: string;
    remoteUrl: string;
    prompt: string;
    style: string;
    idea: string;
  }
): Promise<{
  localUrl: string;
  libraryUrl: string;
  originalRemoteUrl: string;
  keywords: string[];
  validationUrl: string;
  originalLibraryUrl: string;
  cutoutApplied: boolean;
  cutoutMethod?: string;
  alphaCoverage?: number;
  subjectBounds?: { x: number; y: number; width: number; height: number };
  chromaKeyColor?: string;
  chromaTolerance?: number;
  edgeResidueScore?: number;
  spillScore?: number;
  subjectCoverage?: number;
  validationErrors?: string[];
}> {
  const localizedInput = await readImageInput(input.remoteUrl);
  const contentType = localizedInput.contentType;
  const bytes = localizedInput.bytes;
  const extension = extensionForContentType(contentType, input.remoteUrl);
  const originalFileName = `${safeAssetFileName(input.assetKey)}.${extension}`;
  const assetPath = `generated/original/${originalFileName}`;
  await store.saveProjectAsset(input.projectId, input.versionId, assetPath, bytes);
  const originalLocalUrl = `/projects/${input.projectId}/${input.versionId}/assets/${assetPath}`;
  const keywords = extractAssetLibraryKeywords(input.idea, input.prompt, input.style);
  const keywordPath = safeKeywordPath(keywords, input.idea, input.assetKey);
  const libraryAssetPath = `${keywordPath}/original/${originalFileName}`;
  await store.saveLibraryAsset(libraryAssetPath, bytes);
  const originalLibraryUrl = `/asset-library/assets/${libraryAssetPath}`;
  const processed = await processGeneratedImageForSlot({
    slot: input.slot,
    assetKey: input.assetKey,
    bytes,
    contentType
  });
  const processedFileName = processed.cutoutApplied
    ? `${safeAssetFileName(input.assetKey)}.cutout.png`
    : originalFileName;
  const processedAssetPath = processed.cutoutApplied
    ? `generated/processed/${processedFileName}`
    : assetPath;
  if (processed.cutoutApplied) {
    await store.saveProjectAsset(input.projectId, input.versionId, processedAssetPath, processed.outputBytes);
  }
  const localUrl = processed.cutoutApplied
    ? `/projects/${input.projectId}/${input.versionId}/assets/${processedAssetPath}`
    : originalLocalUrl;
  const processedLibraryPath = processed.cutoutApplied
    ? `${keywordPath}/processed/${processedFileName}`
    : libraryAssetPath;
  if (processed.cutoutApplied) {
    await store.saveLibraryAsset(processedLibraryPath, processed.outputBytes);
  }
  const libraryUrl = `/asset-library/assets/${processedLibraryPath}`;
  await appendAssetLibraryIndex(store, {
    assetKey: input.assetKey,
    slot: input.slot,
    fileUrl: libraryUrl,
    originalFileUrl: originalLibraryUrl,
    sourceProjectId: input.projectId,
    sourceVersionId: input.versionId,
    originalRemoteUrl: input.remoteUrl,
    prompt: input.prompt,
    style: input.style,
    keywords,
    provider: "agnes",
    cutoutApplied: processed.cutoutApplied,
    cutoutMethod: processed.cutoutMethod,
    savedAt: new Date("2026-06-20T00:00:00.000Z").toISOString()
  });
  return {
    localUrl,
    libraryUrl,
    originalRemoteUrl: input.remoteUrl,
    keywords,
    validationUrl: processed.outputExtension === "png"
      ? `data:image/png;base64,${Buffer.from(processed.outputBytes).toString("base64")}`
      : localUrl,
    originalLibraryUrl,
    cutoutApplied: processed.cutoutApplied,
    cutoutMethod: processed.cutoutMethod,
    alphaCoverage: processed.validation.alphaCoverage,
    subjectBounds: processed.validation.subjectBounds,
    chromaKeyColor: processed.validation.chromaKeyColor,
    chromaTolerance: processed.validation.chromaTolerance,
    edgeResidueScore: processed.validation.edgeResidueScore,
    spillScore: processed.validation.spillScore,
    subjectCoverage: processed.validation.subjectCoverage,
    validationErrors: processed.validation.validationErrors
  };
}

async function readImageInput(url: string): Promise<{ contentType: string; bytes: Uint8Array }> {
  if (url.startsWith("data:image")) {
    const match = url.match(/^data:([^;,]+)(?:;base64)?,/);
    return {
      contentType: match?.[1] ?? "image/png",
      bytes: decodeBase64(url)
    };
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return {
    contentType: response.headers.get("content-type") ?? "",
    bytes: new Uint8Array(await response.arrayBuffer())
  };
}

async function processUploadedMaterialCandidate(
  store: ReturnType<typeof createPlayableStore>,
  input: {
    idea: string;
    slot: AssetCandidate["slot"];
    assetKey: string;
    fileName: string;
    contentType: string;
    bytes: Uint8Array;
    label?: string;
    prompt?: string;
    style?: string;
  }
): Promise<AssetCandidate> {
  const projectId = "uploaded-materials";
  const versionId = "draft";
  const extension = extensionForContentType(input.contentType, input.fileName);
  const originalFileName = `${safeAssetFileName(input.assetKey)}.${extension}`;
  const originalAssetPath = `uploaded/original/${originalFileName}`;
  await store.saveProjectAsset(projectId, versionId, originalAssetPath, input.bytes);
  const originalLocalUrl = `/projects/${projectId}/${versionId}/assets/${originalAssetPath}`;
  const processed = await processGeneratedImageForSlot({
    slot: input.slot,
    assetKey: input.assetKey,
    bytes: input.bytes,
    contentType: input.contentType
  });
  const processedFileName = processed.cutoutApplied
    ? `${safeAssetFileName(input.assetKey)}.cutout.png`
    : originalFileName;
  const processedAssetPath = processed.cutoutApplied
    ? `uploaded/processed/${processedFileName}`
    : originalAssetPath;
  if (processed.cutoutApplied) {
    await store.saveProjectAsset(projectId, versionId, processedAssetPath, processed.outputBytes);
  }
  const localUrl = processed.cutoutApplied
    ? `/projects/${projectId}/${versionId}/assets/${processedAssetPath}`
    : originalLocalUrl;
  const keywords = extractAssetLibraryKeywords(input.idea, input.prompt ?? input.fileName, input.style ?? "");
  const keywordPath = safeKeywordPath(keywords, input.idea, input.assetKey);
  const originalLibraryPath = `${keywordPath}/uploaded/original/${originalFileName}`;
  await store.saveLibraryAsset(originalLibraryPath, input.bytes);
  const processedLibraryPath = processed.cutoutApplied
    ? `${keywordPath}/uploaded/processed/${processedFileName}`
    : originalLibraryPath;
  if (processed.cutoutApplied) {
    await store.saveLibraryAsset(processedLibraryPath, processed.outputBytes);
  }
  const candidate = validateCoreAssetCandidate({
    slot: input.slot,
    assetKey: input.assetKey,
    type: "image",
    label: input.label ?? input.fileName,
    prompt: input.prompt ?? input.fileName,
    style: input.style ?? "uploaded",
    purpose: input.label ?? input.fileName,
    acceptedFileTypes: ["image/*"],
    previewUrl: localUrl,
    fileUrl: localUrl,
    source: "uploaded",
    provider: "uploaded",
    model: "user-file",
    approvalStatus: "pending",
    generationParams: {
      fileName: input.fileName,
      contentType: input.contentType,
      originalLibraryUrl: `/asset-library/assets/${originalLibraryPath}`,
      processedLibraryUrl: `/asset-library/assets/${processedLibraryPath}`,
      cutoutApplied: processed.cutoutApplied,
      cutoutMethod: processed.cutoutMethod ?? "",
      chromaKeyColor: processed.validation.chromaKeyColor ?? "",
      chromaTolerance: processed.validation.chromaTolerance ?? 0,
      edgeResidueScore: processed.validation.edgeResidueScore ?? 0,
      spillScore: processed.validation.spillScore ?? 0,
      subjectCoverage: processed.validation.subjectCoverage ?? 0
    },
    subjectBounds: processed.validation.subjectBounds,
    alphaCoverage: processed.validation.alphaCoverage,
    validationStatus: processed.validation.validationStatus,
    validationErrors: processed.validation.validationErrors
  } as AssetCandidate);
  const validationErrors = [
    ...(candidate.validationErrors ?? []),
    ...processed.validation.validationErrors
  ];
  return {
    ...candidate,
    validationStatus: validationErrors.length > 0 ? "failed" : candidate.validationStatus,
    validationErrors,
    error: validationErrors.length > 0 ? validationErrors.join(" ") : undefined,
    approvalStatus: validationErrors.length > 0 ? "rejected" : "approved"
  };
}

async function appendAssetLibraryIndex(
  store: ReturnType<typeof createPlayableStore>,
  entry: Record<string, unknown>
): Promise<void> {
  const index = await store.readAssetLibraryIndex();
  const nextIndex = [
    entry,
    ...index.filter(
      (item) =>
        !isRecord(item) ||
        item.assetKey !== entry.assetKey ||
        item.fileUrl !== entry.fileUrl
    )
  ];
  await store.saveAssetLibraryIndex(nextIndex);
}

function extractAssetLibraryKeywords(idea: string, prompt: string, style: string): string[] {
  const text = `${idea} ${prompt} ${style}`;
  const keywordPatterns = [
    "太空猫",
    "躲避游戏",
    "飞船",
    "陨石",
    "鱼干",
    "星空",
    "科幻",
    "霓虹",
    "平台跳跃",
    "机器人",
    "金币"
  ];
  const keywords = keywordPatterns.filter((keyword) => text.includes(keyword));
  if (keywords.length > 0) return keywords.slice(0, 4);
  return text
    .split(/[\s,，。:：;；、]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 4);
}

function syncAssetPackArtifact(project: { artifacts: Array<{ fileName: string; content: unknown }>; assetPack: AssetPack }) {
  project.artifacts = project.artifacts.map((artifact) =>
    artifact.fileName === "asset-pack.json" ? { ...artifact, content: project.assetPack } : artifact
  );
}

function syncDeliveryArtifacts(
  project: { artifacts: Array<{ fileName: string; content: unknown }> },
  playableDirector: unknown,
  runtimeAssetReport: unknown,
  verificationReport: unknown
) {
  project.artifacts = project.artifacts.map((artifact) => {
    if (artifact.fileName === "playable-director.json") return { ...artifact, content: playableDirector };
    if (artifact.fileName === "runtime-asset-report.json") return { ...artifact, content: runtimeAssetReport };
    if (artifact.fileName === "browser-verification-report.json") return { ...artifact, content: verificationReport };
    return artifact;
  });
}

function safeAssetFileName(assetKey: string): string {
  return assetKey.replace(/[^a-z0-9._-]+/gi, "_");
}

function safeKeywordPath(keywords: string[], idea: string, assetKey: string): string {
  const slugs = keywords
    .map((keyword) => slugForPath(keyword))
    .filter(Boolean)
    .slice(0, 4);
  if (slugs.length > 0) return slugs.join("-");
  return `idea-${stableHash(`${idea}:${assetKey}`).toString(36)}`;
}

function slugForPath(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function extensionForContentType(contentType: string, url: string): string {
  const lowerType = contentType.toLowerCase();
  if (lowerType.includes("image/webp")) return "webp";
  if (lowerType.includes("image/jpeg")) return "jpg";
  if (lowerType.includes("image/svg")) return "svg";
  if (lowerType.includes("image/png")) return "png";
  const lowerUrl = url.toLowerCase().split("?")[0];
  if (lowerUrl.endsWith(".webp")) return "webp";
  if (lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg")) return "jpg";
  if (lowerUrl.endsWith(".svg")) return "svg";
  return "png";
}

async function readReferencePackageSummary(
  store: ReturnType<typeof createPlayableStore>,
  projectId?: string,
  versionId?: string
): Promise<ReferencePackageSummary | undefined> {
  if (!projectId || !versionId) return undefined;
  const record = await store.readPlayable(projectId, versionId);
  if (!record?.uploadedPackage) return undefined;
  return summarizeReferencePackage(projectId, versionId, record.uploadedPackage);
}

function summarizeReferencePackage(
  projectId: string,
  versionId: string,
  uploadedPackage: UploadedPackageArtifacts
): ReferencePackageSummary {
  return {
    projectId,
    versionId,
    packageName: uploadedPackage.packageManifest.packageName,
    packageFileName: uploadedPackage.packageManifest.packageFileName,
    fileCount: uploadedPackage.packageManifest.fileCount,
    totalSize: uploadedPackage.packageManifest.totalSize,
    healthStatus: uploadedPackage.healthReport.status,
    entry: uploadedPackage.runtimeEntry.entry,
    scripts: uploadedPackage.runtimeEntry.scripts.slice(0, 20),
    styles: uploadedPackage.runtimeEntry.styles.slice(0, 20),
    images: uploadedPackage.assetIndex.images.slice(0, 30),
    audio: uploadedPackage.assetIndex.audio.slice(0, 20),
    fonts: uploadedPackage.assetIndex.fonts.slice(0, 10),
    data: uploadedPackage.assetIndex.data.slice(0, 20),
    suggestedEdits: uploadedPackage.aiEditPlan.suggestedEdits,
    risks: [...uploadedPackage.healthReport.errors, ...uploadedPackage.healthReport.warnings]
  };
}

function contentTypeForPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".html")) return "text/html; charset=utf-8";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (lower.endsWith(".css")) return "text/css; charset=utf-8";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function encodeBase64(bytes: Uint8Array): string {
  const bufferCtor = (globalThis as { Buffer?: { from: (bytes: Uint8Array) => { toString: (encoding: string) => string } } }).Buffer;
  if (bufferCtor) return bufferCtor.from(bytes).toString("base64");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function createTripoFetcher(fetcher: GenerationServiceOptions["fetcher"] | undefined) {
  return async (url: string, init: RequestInit): Promise<Response> => {
    if (fetcher) {
      const raw = await fetcher({
        url,
        init: init as {
          method: "POST";
          headers: Record<string, string>;
          body: string;
        }
      });
      return new Response(raw, { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return fetch(url, init);
  };
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.includes(",") ? value.split(",").pop() ?? "" : value;
  const bufferCtor = (globalThis as { Buffer?: { from: (value: string, encoding: string) => Uint8Array } }).Buffer;
  if (bufferCtor) return bufferCtor.from(normalized, "base64");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required string field: ${field}`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Missing required number field: ${field}`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function parseTemplateFamily(value: unknown): TemplateFamily {
  if (
    value === "platformer" ||
    value === "top_down" ||
    value === "grid_logic" ||
    value === "tower_defense" ||
    value === "ui_heavy"
  ) {
    return value;
  }
  return "top_down";
}

function parseThreeGameGenre(value: unknown) {
  if (
    value === "runner" ||
    value === "dodge_collect" ||
    value === "flight_shooter" ||
    value === "third_person_collect" ||
    value === "exploration"
  ) {
    return value;
  }
  return undefined;
}

function parseUserMaterialSlot(value: unknown): AssetCandidate["slot"] {
  if (
    value === "background" ||
    value === "player" ||
    value === "hazard" ||
    value === "collectible"
  ) {
    return value;
  }
  throw new Error("Unsupported uploaded material slot.");
}

function runtimeAssetKeyForSlot(slot: AssetCandidate["slot"]): string {
  if (slot === "background") return "world.background";
  if (slot === "player") return "player.ship";
  if (slot === "hazard") return "hazard.enemy";
  if (slot === "collectible") return "item.collectible";
  if (slot === "cover") return "cover.main";
  if (slot === "bgm") return "bgm.loop";
  if (slot === "sfx") return "sfx.collect";
  return "player.ship";
}

function parseModel(value: unknown): StartModelId {
  if (
    value === "deepseek-v4-flash" ||
    value === "gemini-flash" ||
    value === "mock-designer" ||
    value === "custom-provider"
  ) {
    return value;
  }
  return "deepseek-v4-flash";
}

function parseAnswers(value: unknown): UserAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (answer): answer is UserAnswer =>
        typeof answer === "object" &&
        answer !== null &&
        typeof (answer as UserAnswer).questionId === "string" &&
        typeof (answer as UserAnswer).value === "string"
    )
    .map((answer) => ({
      questionId: answer.questionId,
      value: answer.value,
      answeredAt: typeof answer.answeredAt === "string" ? answer.answeredAt : new Date("2026-06-20T00:00:00.000Z").toISOString()
    }));
}

function parseUserMaterials(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (material) =>
        typeof material === "object" &&
        material !== null &&
        typeof material.assetKey === "string" &&
        typeof material.fileName === "string" &&
        typeof material.fileUrl === "string" &&
        typeof material.mimeType === "string"
    )
    .map((material) => ({
      assetKey: material.assetKey,
      slot:
        material.slot === "player" ||
        material.slot === "background" ||
        material.slot === "hazard" ||
        material.slot === "collectible" ||
        material.slot === "cover" ||
        material.slot === "bgm" ||
        material.slot === "sfx"
          ? material.slot
          : undefined,
      fileName: material.fileName,
      fileUrl: material.fileUrl,
      previewUrl: typeof material.previewUrl === "string" ? material.previewUrl : undefined,
      mimeType: material.mimeType
    }));
}

function parseOptionalDesignBrief(value: unknown): DesignBrief | undefined {
  if (!isRecord(value)) return undefined;
  return {
    coreGameplay: optionalString(value.coreGameplay) ?? "",
    playerGoal: optionalString(value.playerGoal) ?? "",
    referenceTakeaways: parseStringArray(value.referenceTakeaways),
    risks: parseStringArray(value.risks),
    questionFocus: parseStringArray(value.questionFocus),
    developerPrompt: optionalString(value.developerPrompt) ?? ""
  };
}

function parseOptionalThreeGameBrief(value: unknown): ThreeGameBrief | undefined {
  if (!isRecord(value)) return undefined;
  const genre = parseThreeGameGenre(value.genre) ?? "dodge_collect";
  const mobileFormat = value.mobileFormat === "landscape_16_9" ? "landscape_16_9" : "portrait_9_16";
  return {
    genre,
    title: optionalString(value.title) ?? "",
    coreLoop: parseStringArray(value.coreLoop),
    playerFantasy: optionalString(value.playerFantasy) ?? "",
    mobileFormat,
    cameraIntent: optionalString(value.cameraIntent) ?? "",
    movementIntent: optionalString(value.movementIntent) ?? "",
    spaceLayout: optionalString(value.spaceLayout) ?? "",
    interactionFeedback: parseStringArray(value.interactionFeedback),
    mobileControlPlan: optionalString(value.mobileControlPlan) ?? "",
    assetNeeds: parseStringArray(value.assetNeeds),
    skillWorkflow: parseStringArray(value.skillWorkflow)
  };
}

function parseOptionalConfirmedAssets(value: unknown): ConfirmedAssets | undefined {
  if (!isRecord(value) || !Array.isArray(value.assets)) return undefined;
  return {
    assets: value.assets
      .filter(isRecord)
      .map((asset) => ({
        slot: parseAssetSlot(asset.slot),
        assetKey: optionalString(asset.assetKey) ?? "",
        type: parseAssetType(asset.type),
        label: optionalString(asset.label) ?? "",
        prompt: optionalString(asset.prompt) ?? "",
        style: optionalString(asset.style) ?? "",
        purpose: optionalString(asset.purpose) ?? "",
        acceptedFileTypes: parseStringArray(asset.acceptedFileTypes),
        previewUrl: optionalString(asset.previewUrl) ?? "",
        fileUrl: optionalString(asset.fileUrl) ?? "",
        source: parseAssetSource(asset.source),
        provider: optionalString(asset.provider),
        model: optionalString(asset.model),
        generationParams: isRecord(asset.generationParams)
          ? Object.fromEntries(
              Object.entries(asset.generationParams).filter(
                (entry): entry is [string, string | number | boolean] =>
                  typeof entry[1] === "string" || typeof entry[1] === "number" || typeof entry[1] === "boolean"
              )
            )
          : undefined,
        error: optionalString(asset.error),
        approvalStatus:
          asset.approvalStatus === "pending" ||
          asset.approvalStatus === "approved" ||
          asset.approvalStatus === "rejected"
            ? asset.approvalStatus
            : "approved",
        slotRole: asset.slotRole === "background" || asset.slotRole === "sprite" ? asset.slotRole : undefined,
        requiresTransparency: typeof asset.requiresTransparency === "boolean" ? asset.requiresTransparency : undefined,
        subjectBounds: isRecord(asset.subjectBounds)
          ? {
              x: readNumber(asset.subjectBounds.x, 0),
              y: readNumber(asset.subjectBounds.y, 0),
              width: readNumber(asset.subjectBounds.width, 0),
              height: readNumber(asset.subjectBounds.height, 0)
            }
          : undefined,
        alphaCoverage: typeof asset.alphaCoverage === "number" ? asset.alphaCoverage : undefined,
        validationStatus:
          asset.validationStatus === "passed" ||
          asset.validationStatus === "warning" ||
          asset.validationStatus === "failed"
            ? asset.validationStatus
            : undefined,
        validationErrors: parseStringArray(asset.validationErrors)
      }))
      .filter((asset) => asset.assetKey && asset.prompt)
  };
}

function parseOptionalConfirmedThreeAssets(value: unknown): ConfirmedThreeAssets | undefined {
  if (!isRecord(value) || !Array.isArray(value.assets)) return undefined;
  return {
    assets: value.assets
      .filter(isRecord)
      .map((asset) => ({
        assetKey: optionalString(asset.assetKey) ?? "",
        type: parseAssetType(asset.type),
        purpose: optionalString(asset.purpose) ?? "",
        style: optionalString(asset.style) ?? "",
        generationMode:
          asset.generationMode === "mock" ||
          asset.generationMode === "model" ||
          asset.generationMode === "uploaded" ||
          asset.generationMode === "preset"
            ? asset.generationMode
            : "model",
        copyrightStatus:
          asset.copyrightStatus === "placeholder" ||
          asset.copyrightStatus === "generated" ||
          asset.copyrightStatus === "licensed" ||
          asset.copyrightStatus === "user_provided"
            ? asset.copyrightStatus
            : "generated",
        spec: optionalString(asset.spec) ?? "",
        status:
          asset.status === "missing" ||
          asset.status === "mock" ||
          asset.status === "uploaded" ||
          asset.status === "generated" ||
          asset.status === "failed"
            ? asset.status
            : "generated",
        prompt: optionalString(asset.prompt) ?? "",
        acceptedFileTypes: parseStringArray(asset.acceptedFileTypes),
        previewUrl: optionalString(asset.previewUrl) ?? "",
        source: parseAssetSource(asset.source),
        fileUrl: optionalString(asset.fileUrl) ?? "",
        provider: optionalString(asset.provider) ?? "",
        model: optionalString(asset.model) ?? "",
        generationParams: isRecord(asset.generationParams)
          ? Object.fromEntries(
              Object.entries(asset.generationParams).filter(
                (entry): entry is [string, string | number | boolean] =>
                  typeof entry[1] === "string" || typeof entry[1] === "number" || typeof entry[1] === "boolean"
              )
            )
          : {},
        approvalStatus:
          asset.approvalStatus === "pending" ||
          asset.approvalStatus === "approved" ||
          asset.approvalStatus === "rejected"
            ? asset.approvalStatus
            : "approved",
        error: optionalString(asset.error)
      }))
      .filter((asset) => asset.assetKey && asset.type === "model")
  };
}

function parseAssetCandidateInput(value: unknown): AssetCandidate {
  const parsed = parseOptionalConfirmedAssets({ assets: [value] })?.assets[0];
  if (!parsed) throw new Error("candidate is required");
  return parsed;
}

function validateConfirmedCoreAssetInputs(
  confirmedAssets: ConfirmedAssets | undefined,
  allowPlaceholderAssets: boolean
): string | null {
  if (allowPlaceholderAssets) return null;
  const remoteAsset = confirmedAssets?.assets.find(
    (asset) =>
      ["background", "player", "hazard", "collectible"].includes(asset.slot) &&
      asset.approvalStatus !== "rejected" &&
      (/^https?:\/\//.test(asset.fileUrl) || /^https?:\/\//.test(asset.previewUrl))
  );
  if (remoteAsset) {
    return `Core assets must be localized before generating a playable game: ${remoteAsset.slot}/${remoteAsset.assetKey}`;
  }
  if (!hasConfirmedCoreAssets(confirmedAssets)) {
    return "Core assets must be confirmed before generating a playable game.";
  }
  const invalidAsset = confirmedAssets?.assets.find(
    (asset) =>
      ["background", "player", "hazard", "collectible"].includes(asset.slot) &&
      asset.approvalStatus !== "rejected" &&
      (!isRuntimeImageUrl(asset.fileUrl) || !isRuntimeImageUrl(asset.previewUrl) || asset.validationStatus === "failed")
  );
  if (invalidAsset) {
    return `Core assets must pass visual validation before generating a playable game: ${invalidAsset.slot}/${invalidAsset.assetKey}`;
  }
  return null;
}

function hasConfirmedCoreAssets(confirmedAssets: ConfirmedAssets | undefined): boolean {
  const requiredSlots = new Set(["background", "player", "hazard", "collectible"]);
  for (const asset of confirmedAssets?.assets ?? []) {
    if (
      requiredSlots.has(asset.slot) &&
      asset.approvalStatus !== "rejected" &&
    isRuntimeImageUrl(asset.fileUrl) &&
    isRuntimeImageUrl(asset.previewUrl) &&
    asset.validationStatus !== "failed" &&
    !asset.error
    ) {
      requiredSlots.delete(asset.slot);
    }
  }
  return requiredSlots.size === 0;
}

function isConfirmableCoreCandidate(candidate: AssetCandidate): boolean {
  return (
    ["background", "player", "hazard", "collectible"].includes(candidate.slot) &&
    (candidate.type === "image" || candidate.type === "ui") &&
    candidate.approvalStatus !== "rejected" &&
    isRuntimeImageUrl(candidate.fileUrl) &&
    isRuntimeImageUrl(candidate.previewUrl) &&
    candidate.validationStatus !== "failed" &&
    !candidate.error
  );
}

function isRuntimeImageUrl(fileUrl: string): boolean {
  return fileUrl.startsWith("data:image") || fileUrl.startsWith("blob:") || fileUrl.startsWith("/projects/");
}

function validateFinalCoreAssets(assetPack: AssetPack, confirmedAssets: ConfirmedAssets | undefined): string | null {
  if (!confirmedAssets) return null;
  const requiredSlots = ["background", "player", "hazard", "collectible"] as const;
  for (const slot of requiredSlots) {
    const confirmed = confirmedAssets.assets.find(
      (asset) =>
        asset.slot === slot &&
        asset.approvalStatus !== "rejected" &&
        asset.fileUrl.trim() &&
        asset.previewUrl.trim()
    );
    const finalAsset = assetPack.assets.find(
      (asset) => coreAssetKeysBySlot[slot].includes(asset.assetKey) && finalAssetUsesConfirmedUrl(asset, confirmed)
    );
    if (!confirmed || !finalAsset) {
      return "Final asset-pack must use confirmed core assets before saving a playable game.";
    }
  }
  return null;
}

function finalAssetUsesConfirmedUrl(asset: AssetPack["assets"][number], confirmed: ConfirmedAssets["assets"][number] | undefined): boolean {
  if (!confirmed) return false;
  const originalRemoteUrl =
    typeof asset.generationParams?.originalRemoteUrl === "string" ? asset.generationParams.originalRemoteUrl : undefined;
  return (
    asset.fileUrl === confirmed.fileUrl ||
    originalRemoteUrl === confirmed.fileUrl
  );
}

function inferSlotFromAssetKey(assetKey: string): string {
  if (assetKey.startsWith("player.")) return "player";
  if (assetKey.startsWith("hazard.")) return "hazard";
  if (assetKey.startsWith("item.")) return "collectible";
  if (assetKey.startsWith("world.") || assetKey.startsWith("cover.")) return "background";
  return "asset";
}

function createLocalizationFallbackImage(assetKey: string): string {
  const color = assetKey.includes("hazard")
    ? "#fb7185"
    : assetKey.includes("collectible")
      ? "#facc15"
      : assetKey.includes("player")
        ? "#22d3ee"
        : "#172554";
  const label = assetKey.split(".").at(-1) ?? "asset";
  const shape = assetKey.includes("background")
    ? `<rect width="160" height="100" fill="${color}"/><circle cx="32" cy="24" r="3" fill="#fff"/><circle cx="120" cy="38" r="2" fill="#fff"/>`
    : assetKey.includes("hazard")
      ? `<polygon points="80,14 140,86 20,86" fill="${color}"/><circle cx="80" cy="66" r="6" fill="#fff"/>`
      : assetKey.includes("collectible")
        ? `<circle cx="80" cy="48" r="26" fill="${color}"/><path d="M80 18l7 22 23 1-18 13 6 22-18-12-18 12 6-22-18-13 23-1z" fill="#fff"/>`
        : `<polygon points="80,12 120,88 80,70 40,88" fill="${color}"/><circle cx="80" cy="58" r="8" fill="#fff"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100" viewBox="0 0 160 100"><rect width="160" height="100" rx="10" fill="#0b1020"/>${shape}<text x="80" y="94" text-anchor="middle" font-family="Arial" font-size="10" fill="#f8fafc">${escapeSvgText(label)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeSvgText(text: string): string {
  return text.replace(/[<>&'"]/g, (char) => {
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === "&") return "&amp;";
    if (char === "'") return "&apos;";
    return "&quot;";
  });
}

const coreAssetKeysBySlot: Record<string, string[]> = {
  background: ["world.background", "cover.main", "world.tiles", "world.path"],
  player: ["player.ship", "player.hero", "player.cursor", "player.tower", "player.panel"],
  hazard: ["hazard.enemy", "hazard.spike", "hazard.block", "hazard.timer"],
  collectible: ["item.collectible"]
};

function parseRevisionHistory(value: unknown): RevisionAnalysis[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    understoodChange: optionalString(item.understoodChange) ?? "",
    updatedDeveloperPrompt: optionalString(item.updatedDeveloperPrompt) ?? "",
    confirmationQuestions: Array.isArray(item.confirmationQuestions)
      ? item.confirmationQuestions.filter(isRecord).map((question, index) => ({
          id: optionalString(question.id) ?? `revision_${index + 1}`,
          label: optionalString(question.label) ?? "修改确认",
          prompt: optionalString(question.prompt) ?? "",
          inputType:
            question.inputType === "single_choice" ||
            question.inputType === "multi_choice" ||
            question.inputType === "short_text" ||
            question.inputType === "number"
              ? question.inputType
              : "short_text",
          options: parseStringArray(question.options),
          defaultAnswer: optionalString(question.defaultAnswer) ?? "",
          required: typeof question.required === "boolean" ? question.required : true
        }))
      : [],
    affectedAssets: parseStringArray(item.affectedAssets),
    risks: parseStringArray(item.risks)
  }));
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseAssetSlot(value: unknown): ConfirmedAssets["assets"][number]["slot"] {
  if (
    value === "player" ||
    value === "background" ||
    value === "hazard" ||
    value === "collectible" ||
    value === "cover" ||
    value === "bgm" ||
    value === "sfx"
  ) {
    return value;
  }
  return "player";
}

function parseAssetType(value: unknown): ConfirmedAssets["assets"][number]["type"] {
  if (
    value === "image" ||
    value === "sfx" ||
    value === "bgm" ||
    value === "effect" ||
    value === "ui" ||
    value === "build" ||
    value === "model" ||
    value === "texture" ||
    value === "skybox" ||
    value === "material" ||
    value === "audio" ||
    value === "icon"
  ) {
    return value;
  }
  return "image";
}

function parseAssetSource(value: unknown): ConfirmedAssets["assets"][number]["source"] {
  if (value === "mock" || value === "preset" || value === "uploaded" || value === "generated" || value === "library") {
    return value;
  }
  return "generated";
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function readRuntimeEnv(): Record<string, string | undefined> {
  const maybeProcess = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  return maybeProcess.process?.env ?? {};
}
