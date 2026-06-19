import type {
  ConfirmedAssets,
  DesignBrief,
  ReferencePackageSummary,
  RevisionAnalysis,
  TemplateFamily,
  UploadedPackageArtifacts,
  UserAnswer,
  UserMaterial
} from "../core/types";
import type { StartModelId } from "../core/start";
import { createPublishRecord, runMockPipeline } from "../core/pipeline";
import { createGenerationService, type GenerationServiceOptions } from "./generationService";
import { createPlayableStore, type PlayableStoreOptions } from "./playableStore";
import {
  createFallbackEditPlan,
  parseUploadedPackage
} from "./uploadedPackageService";

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
        const service = createGenerationService({
          deepseekApiKey: env.DEEPSEEK_API_KEY,
          deepseekBaseUrl: env.DEEPSEEK_BASE_URL,
          fetcher: options.fetcher
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
          fetcher: options.fetcher
        });
        const referencePackageSummary = await readReferencePackageSummary(
          store,
          optionalString(request.body.referencePackageId),
          optionalString(request.body.referenceVersionId)
        );
        const result = await service.generateAssetCandidates({
          idea: requireString(request.body.idea, "idea"),
          templateFamily: parseTemplateFamily(request.body.templateFamily),
          model: parseModel(request.body.model),
          designBrief: parseOptionalDesignBrief(request.body.designBrief),
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

    if (request.method === "POST" && request.path === "/api/revision-analysis") {
      try {
        const service = createGenerationService({
          deepseekApiKey: env.DEEPSEEK_API_KEY,
          deepseekBaseUrl: env.DEEPSEEK_BASE_URL,
          fetcher: options.fetcher
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

    if (request.method === "POST" && request.path === "/api/guided-questions") {
      try {
        const service = createGenerationService({
          deepseekApiKey: env.DEEPSEEK_API_KEY,
          deepseekBaseUrl: env.DEEPSEEK_BASE_URL,
          fetcher: options.fetcher
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
      const service = createGenerationService({
        deepseekApiKey: env.DEEPSEEK_API_KEY,
        deepseekBaseUrl: env.DEEPSEEK_BASE_URL,
        fetcher: options.fetcher
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
        confirmedAssets: parseOptionalConfirmedAssets(request.body.confirmedAssets),
        revisionHistory: parseRevisionHistory(request.body.revisionHistory)
      });
      if (referencePackageId && referenceVersionId && !referencePackageSummary) {
        result.fallbacksUsed.push("reference_package_missing");
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

function parseModel(value: unknown): StartModelId {
  if (value === "deepseek-v4-flash" || value === "mock-designer" || value === "custom-provider") {
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
        typeof (answer as UserAnswer).value === "string" &&
        typeof (answer as UserAnswer).answeredAt === "string"
    )
    .map((answer) => ({
      questionId: answer.questionId,
      value: answer.value,
      answeredAt: answer.answeredAt
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
        approvalStatus:
          asset.approvalStatus === "pending" ||
          asset.approvalStatus === "approved" ||
          asset.approvalStatus === "rejected"
            ? asset.approvalStatus
            : "approved"
      }))
      .filter((asset) => asset.assetKey && asset.prompt)
  };
}

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
  if (value === "image" || value === "sfx" || value === "bgm" || value === "effect" || value === "ui" || value === "build") {
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
