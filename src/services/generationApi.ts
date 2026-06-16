import type { TemplateFamily, UserAnswer } from "../core/types";
import type { StartModelId } from "../core/start";
import { createGenerationService, type GenerationServiceOptions } from "./generationService";

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
}

export function createGenerationApiHandler(options: GenerationApiOptions = {}) {
  return async function handleGenerationRequest(
    request: GenerationApiRequest
  ): Promise<GenerationApiResponse> {
    if (request.method !== "POST" || request.path !== "/api/generate-playable") {
      return {
        status: 404,
        body: { error: `No route for ${request.method} ${request.path}` }
      };
    }

    try {
      const env = options.env ?? readRuntimeEnv();
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
