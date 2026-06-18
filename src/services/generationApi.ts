import type { TemplateFamily, UserAnswer } from "../core/types";
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

    if (request.method === "POST" && request.path === "/api/guided-questions") {
      try {
        const service = createGenerationService({
          deepseekApiKey: env.DEEPSEEK_API_KEY,
          deepseekBaseUrl: env.DEEPSEEK_BASE_URL,
          fetcher: options.fetcher
        });
        const result = await service.generateGuidedQuestions({
          idea: requireString(request.body.idea, "idea"),
          templateFamily: parseTemplateFamily(request.body.templateFamily),
          projectId: optionalString(request.body.projectId),
          model: parseModel(request.body.model)
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
      const result = await service.generatePlayableVersion({
        idea: requireString(request.body.idea, "idea"),
        answers: parseAnswers(request.body.answers),
        templateFamily: parseTemplateFamily(request.body.templateFamily),
        projectId: optionalString(request.body.projectId) ?? `project-${Date.now()}`,
        baseUrl: optionalString(request.body.baseUrl) ?? env.PUBLIC_BASE_URL ?? "http://localhost:5173",
        model: parseModel(request.body.model)
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

function readRuntimeEnv(): Record<string, string | undefined> {
  const maybeProcess = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  return maybeProcess.process?.env ?? {};
}
