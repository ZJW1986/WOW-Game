import type { TemplateFamily, UserAnswer } from "../core/types";
import type { StartModelId } from "../core/start";
import { createPublishRecord, runMockPipeline } from "../core/pipeline";
import { createGenerationService, type GenerationServiceOptions } from "./generationService";
import { createPlayableStore, type PlayableStoreOptions } from "./playableStore";

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
  storeIO?: Pick<PlayableStoreOptions, "writeText" | "readText" | "ensureDir">;
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
        const packageEntry = requireString(request.body.packageEntry, "packageEntry");
        if (packageEntry !== "index.html") {
          throw new Error("Uploaded package must provide index.html as the entry file");
        }
        if (!packageFileName.toLowerCase().endsWith(".zip")) {
          throw new Error("Uploaded package must be a .zip file");
        }

        const projectId = `package-${Date.now()}`;
        const project = runMockPipeline(optionalString(request.body.description) ?? packageName);
        project.id = projectId;
        project.title = packageName;
        project.contentType = "uploaded_package";
        project.editable = false;
        project.shareable = true;
        project.sourceLabel = "ZIP Package";

        const publishRecord = createPublishRecord(project.id, project.version.id, project.title, {
          visibility: "public",
          baseUrl: optionalString(request.body.baseUrl) ?? env.PUBLIC_BASE_URL ?? "http://localhost:5173"
        });
        project.playUrl = publishRecord.playUrl;

        await store.savePlayable({
          project,
          publishRecord,
          feedback: []
        });

        return {
          status: 201,
          body: {
            project,
            publishRecord,
            packageMeta: {
              packageFileName,
              packageEntry
            }
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
